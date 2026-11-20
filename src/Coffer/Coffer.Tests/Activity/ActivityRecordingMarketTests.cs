using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.BusinessLogic.Marketplace.Reviews;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Marketplace;

namespace Coffer.Tests.Activity
{
    /// <summary>Listings, chats, offers, deal steps, reviews and reports land in the acting user's activity log only.</summary>
    public class ActivityRecordingMarketTests : ReportTestBase
    {
        private List<ActivityEvent> Events(User user)
        {
            using var fresh = Db.NewContext();
            return fresh.ActivityEvents.Where(e => e.UserId == user.Id).OrderBy(e => e.OccurredAt).ThenBy(e => e.Kind).ToList();
        }

        private List<string> Kinds(User user) => Events(user).Select(e => e.Kind).ToList();

        private void Tick() => Clock.Advance(TimeSpan.FromSeconds(1));

        private ListingInput Input() => new(
            Kind: ListingKind.Sell, CollectionTypeId: CollectionTypeId(), Title: "Silver coins", Description: "Two coins",
            PriceCents: 2500, ExchangeFor: null, Condition: ListingCondition.Good, CityId: Budapest.Id,
            AllowsLocalPickup: true, AllowsShipping: true, Lines: new List<ListingLineInput> { new("Silver coin", 2) },
            KeepImageIds: null, PrivateSellerDeclared: true);

        [Fact]
        public async Task ListingKindsRecorded()
        {
            var created = await Listings().CreateAsync(Seller.Id, Input(), TestImages.Many(1));
            Tick();
            await Listings().UpdateAsync(Seller.Id, created.Id, Input() with { Title = "Silver coins (2)", KeepImageIds = created.Images.Select(i => i.Id).ToList() }, Array.Empty<Microsoft.AspNetCore.Http.IFormFile>());
            Tick();
            await Listings().ArchiveAsync(Seller.Id, created.Id);
            Tick();
            await Listings().ReactivateAsync(Seller.Id, created.Id);

            var events = Events(Seller);
            Assert.Equal(new[] { "listing.posted", "listing.edited", "listing.archived", "listing.reactivated" }, events.Select(e => e.Kind));
            Assert.All(events, e => Assert.Equal(created.Id, e.ListingId));
        }

        [Fact]
        public async Task ChatAndProposalKindsRecorded()
        {
            var (listing, conversationId) = await Chat();
            Tick();
            var offer = await Conversations().PostAsync(Buyer.Id, conversationId, new PostMessageInput(MessageKind.PriceOffer, null, 1500, null, null));
            Tick();
            await Conversations().RespondAsync(Seller.Id, conversationId, offer.Id, "decline");
            Tick();
            var meetup = await Conversations().PostAsync(Buyer.Id, conversationId, new PostMessageInput(MessageKind.MeetupProposal, null, null, Clock.UtcNow.AddDays(2), "Deák tér"));
            Tick();
            await Conversations().RespondAsync(Buyer.Id, conversationId, meetup.Id, "withdraw");
            Tick();
            await Conversations().PostAsync(Buyer.Id, conversationId, new PostMessageInput(MessageKind.Text, "Still there?", null, null, null)); // not logged

            var buyer = Events(Buyer);
            Assert.Equal(new[] { "chat.started", "offer.sent", "meetup.proposed", "proposal.withdrawn" }, buyer.Select(e => e.Kind));
            Assert.All(buyer, e => Assert.Equal(conversationId, e.ConversationId));
            Assert.All(buyer, e => Assert.Equal(listing.Id, e.ListingId));
            Assert.All(buyer, e => Assert.Equal(Seller.Id, e.OtherUserId));
            Assert.Equal(1500, JsonDocument.Parse(buyer[1].Details).RootElement.GetProperty("priceCents").GetInt32());
            Assert.Equal(new[] { "proposal.declined" }, Kinds(Seller));
        }

        [Fact]
        public async Task DealStepsRecordedForTheActorOnly()
        {
            var (_, conversationId) = await Chat();
            var deal = await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.Shipping);
            Tick();
            await Sut().AcceptAsync(Buyer.Id, deal.Id);
            Tick();
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            Tick();
            await Sut().ConfirmReceiptAsync(Buyer.Id, deal.Id, null);

            Assert.Equal(new[] { "deal.proposed", "deal.shipped" }, Kinds(Seller));
            Assert.Equal(new[] { "chat.started", "deal.accepted", "deal.receiptConfirmed" }, Kinds(Buyer));
            var shipped = Events(Seller)[1];
            Assert.Equal(deal.Id, shipped.DealId);
            Assert.Equal(conversationId, shipped.ConversationId);
            Assert.Equal(Buyer.Id, shipped.OtherUserId);
        }

        [Fact]
        public async Task HandoffDeclineCancelAndDisputeRecorded()
        {
            var handoff = await ActiveDeal(DeliveryMethod.LocalPickup);
            Tick();
            await Sut().ConfirmHandoffAsync(Seller.Id, handoff.Id, handoff.HandoffPin!);
            Assert.Contains("deal.handoffConfirmed", Kinds(Seller));

            var (_, chat2) = await Chat();
            var declined = await Sut().ProposeAsync(Seller.Id, chat2, DeliveryMethod.LocalPickup);
            Tick();
            await Sut().DeclineAsync(Buyer.Id, declined.Id);
            Assert.Contains("deal.declined", Kinds(Buyer));

            var (_, chat3) = await Chat();
            var cancelled = await Sut().ProposeAsync(Seller.Id, chat3, DeliveryMethod.LocalPickup);
            Tick();
            await Sut().CancelAsync(Seller.Id, cancelled.Id, null);
            Assert.Contains("deal.cancelled", Kinds(Seller));

            var shipping = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, shipping.Id, "gls", "GLS1", null);
            Tick();
            await Sut().DisputeAsync(Buyer.Id, shipping.Id, "The parcel arrived empty, nothing inside it.");
            Assert.Contains("deal.disputed", Kinds(Buyer));
        }

        [Fact]
        public async Task AutoCompletionRecordsNothing()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS1", null);
            var before = Events(Seller).Count + Events(Buyer).Count;

            Clock.Advance(TimeSpan.FromDays(15));
            await Sut().ApplyDueTimeRulesAsync();

            Assert.Equal(before, Events(Seller).Count + Events(Buyer).Count);
        }

        [Fact]
        public async Task FailedDealStepRecordsNothing()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS1", null);
            var before = Events(Seller).Count;

            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().CancelAsync(Seller.Id, deal.Id, null)));

            Assert.Equal(before, Events(Seller).Count);
        }

        [Fact]
        public async Task ReviewKindsRecorded()
        {
            var deal = await CompletedPickupDeal();
            Tick();
            var review = await Reviews().SubmitAsync(Buyer.Id, deal.Id, new ReviewInput(5, null, "Great!"));
            await Reviews().SubmitAsync(Seller.Id, deal.Id, new ReviewInput(5, null, null)); // publishes both
            Tick();
            await Reviews().ReplyAsync(Seller.Id, review.Id, "Thank you!");

            var written = Events(Buyer).Single(e => e.Kind == "review.written");
            Assert.Equal(review.Id, written.ReviewId);
            Assert.Equal(5, JsonDocument.Parse(written.Details).RootElement.GetProperty("stars").GetInt32());
            Assert.Contains("review.replied", Kinds(Seller));
        }

        [Fact]
        public async Task ReportFiledRecorded()
        {
            var listing = AddListing(Seller);

            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));

            var e = Events(Buyer).Single(x => x.Kind == "report.filed");
            Assert.Equal(report.Id, e.ReportId);
            Assert.Equal(listing.Id, e.ListingId);
        }
    }
}
