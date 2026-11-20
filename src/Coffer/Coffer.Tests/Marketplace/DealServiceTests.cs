using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Services;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    public abstract class DealTestBase : MarketplaceTestBase
    {
        protected readonly string Folder = Path.Combine(Path.GetTempPath(), "coffer-deals-" + Guid.NewGuid().ToString("N"));
        protected readonly User Seller;
        protected readonly User Buyer;

        protected DealTestBase()
        {
            Seller = Db.AddUser("seller");
            Buyer = Db.AddUser("buyer");
        }

        protected ConversationService Conversations() => new(Db.Context, Clock, new IConversationSubjectPolicy[] { new ListingConversationPolicy(Db.Context) }, new Coffer.BusinessLogic.Activity.ActivityLog(Db.Context, Clock));
        protected DealService Sut() => new(Db.Context, Clock, Conversations(), new ImageService(), new MarketplaceStorage(Folder, Folder), new Coffer.BusinessLogic.Activity.ActivityLog(Db.Context, Clock));

        protected static async Task<MarketplaceError> ErrorOf(Func<Task> act)
            => (await Assert.ThrowsAsync<MarketplaceException>(act)).Error;

        protected async Task<(Listing listing, Guid conversationId)> Chat(ListingKind kind = ListingKind.Sell, bool pickup = true, bool shipping = true)
        {
            var listing = AddListing(Seller, kind, pickup, shipping);
            var conversation = await Conversations().OpenAsync(Buyer.Id, "listing", listing.Id);
            return (listing, conversation.Id);
        }

        protected async Task<DealDto> ActiveDeal(DeliveryMethod method)
        {
            var (_, conversationId) = await Chat();
            var deal = await Sut().ProposeAsync(Seller.Id, conversationId, method);
            return await Sut().AcceptAsync(Buyer.Id, deal.Id);
        }

        protected async Task<DealDto> CompletedPickupDeal()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            return await Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, deal.HandoffPin!);
        }

        public override void Dispose()
        {
            base.Dispose();
            if (Directory.Exists(Folder)) Directory.Delete(Folder, true);
        }
    }

    public class DealServiceTests : DealTestBase
    {
        private Listing ListingOf(Guid id) => Db.NewContext().Listings.Single(l => l.Id == id);

        // ---------- propose ----------

        [Fact]
        public async Task Propose_BySellerOnly()
        {
            var (_, conversationId) = await Chat();
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().ProposeAsync(Buyer.Id, conversationId, DeliveryMethod.LocalPickup)));
            Assert.Equal(DealStatus.Proposed, (await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup)).Status);
        }

        [Fact]
        public async Task Propose_ByStranger_NotFound()
        {
            var (_, conversationId) = await Chat();
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Sut().ProposeAsync(Db.AddUser("x").Id, conversationId, DeliveryMethod.LocalPickup)));
        }

        [Fact]
        public async Task Propose_MethodNotAllowedByListing_Validation()
        {
            var (_, conversationId) = await Chat(shipping: false);
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.Shipping)));
        }

        [Fact]
        public async Task Propose_SecondOpenDealOnListing_Conflicts()
        {
            var (listing, conversationId) = await Chat();
            await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);
            var other = Db.AddUser("other");
            var otherConversation = await Conversations().OpenAsync(other.Id, "listing", listing.Id);

            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().ProposeAsync(Seller.Id, otherConversation.Id, DeliveryMethod.LocalPickup)));
        }

        [Fact]
        public async Task Propose_UsesAgreedPriceElseListingPrice()
        {
            var (_, conversationId) = await Chat();
            Assert.Equal(1000, (await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup)).AgreedPriceCents);

            var (_, second) = await Chat();
            var offer = await Conversations().PostAsync(Buyer.Id, second, new PostMessageInput(MessageKind.PriceOffer, null, 750, null, null));
            await Conversations().RespondAsync(Seller.Id, second, offer.Id, "accept");
            Assert.Equal(750, (await Sut().ProposeAsync(Seller.Id, second, DeliveryMethod.LocalPickup)).AgreedPriceCents);
        }

        [Fact]
        public async Task WantedListing_InquirerIsSeller()
        {
            // Buyer posts "searching for"; Seller answers it.
            var wanted = AddListing(Buyer, ListingKind.Wanted);
            var conversation = await Conversations().OpenAsync(Seller.Id, "listing", wanted.Id);

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().ProposeAsync(Buyer.Id, conversation.Id, DeliveryMethod.LocalPickup)));
            var deal = await Sut().ProposeAsync(Seller.Id, conversation.Id, DeliveryMethod.LocalPickup);
            Assert.Equal(Seller.Id, deal.Seller.Id);
            Assert.Equal(Buyer.Id, deal.Buyer.Id);
            Assert.Equal(ReviewerRole.Seller, deal.MyRole);
        }

        // ---------- accept / decline / cancel ----------

        [Fact]
        public async Task Accept_ByBuyerOnly_SetsListingPendingAndGeneratesPin()
        {
            var (listing, conversationId) = await Chat();
            var proposed = await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().AcceptAsync(Seller.Id, proposed.Id)));
            var accepted = await Sut().AcceptAsync(Buyer.Id, proposed.Id);

            Assert.Equal(DealStatus.AwaitingHandoff, accepted.Status);
            Assert.Matches("^[0-9]{4}$", accepted.HandoffPin);
            Assert.Equal($"coffer-handoff:{accepted.Id}:{accepted.HandoffPin}", accepted.HandoffQr);
            Assert.Equal(ListingStatus.PendingPickup, ListingOf(listing.Id).Status);
        }

        [Fact]
        public async Task Accept_Shipping_SetsPendingShipmentWithoutPin()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            Assert.Equal(DealStatus.AwaitingShipment, deal.Status);
            Assert.Null(deal.HandoffPin);
            Assert.Equal(ListingStatus.PendingShipment, ListingOf(deal.ListingId).Status);
        }

        [Fact]
        public async Task Decline_ReturnsListingActive()
        {
            var (listing, conversationId) = await Chat();
            var proposed = await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);

            var declined = await Sut().DeclineAsync(Buyer.Id, proposed.Id);

            Assert.Equal(DealStatus.Cancelled, declined.Status);
            Assert.Equal(ListingStatus.Active, ListingOf(listing.Id).Status);
            // a new deal can be proposed again
            Assert.Equal(DealStatus.Proposed, (await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup)).Status);
        }

        [Fact]
        public async Task Cancel_ActiveDeal_ReactivatesListing()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            var cancelled = await Sut().CancelAsync(Buyer.Id, deal.Id, "Changed my mind");
            Assert.Equal(DealStatus.Cancelled, cancelled.Status);
            Assert.Equal(ListingStatus.Active, ListingOf(deal.ListingId).Status);
        }

        [Fact]
        public async Task Cancel_AfterShipped_Conflicts()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().CancelAsync(Seller.Id, deal.Id, null)));
        }

        // ---------- pickup ----------

        [Fact]
        public async Task GetDeal_PinHiddenFromSeller()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            var sellerView = await Sut().GetAsync(Seller.Id, deal.Id);
            Assert.Null(sellerView.HandoffPin);
            Assert.Null(sellerView.HandoffQr);
            Assert.Contains("enter_pin", sellerView.NextActions);
            Assert.Contains("show_pin", (await Sut().GetAsync(Buyer.Id, deal.Id)).NextActions);
        }

        [Fact]
        public async Task ConfirmHandoff_CorrectPin_CompletesAndOpensReviewWindow()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);

            var done = await Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, deal.HandoffPin!);

            Assert.Equal(DealStatus.Completed, done.Status);
            Assert.Equal(CompletionReason.HandoffVerified, done.CompletionReason);
            Assert.Equal(Clock.UtcNow.AddDays(14), done.ReviewDeadline!.Value, TimeSpan.FromSeconds(1));
            Assert.Equal(ListingStatus.Sold, ListingOf(deal.ListingId).Status);
            Assert.Contains("review", done.NextActions);
        }

        [Fact]
        public async Task ConfirmHandoff_AcceptsScannedQrPayload()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            Assert.Equal(DealStatus.Completed, (await Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, deal.HandoffQr!)).Status);
        }

        [Fact]
        public async Task ConfirmHandoff_QrOfAnotherDeal_Validation()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, $"coffer-handoff:{Guid.NewGuid()}:{deal.HandoffPin}")));
        }

        [Fact]
        public async Task ConfirmHandoff_ByBuyer_Forbidden()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().ConfirmHandoffAsync(Buyer.Id, deal.Id, deal.HandoffPin!)));
        }

        [Fact]
        public async Task ConfirmHandoff_FiveWrong_LocksAndRegenerates()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            var oldPin = deal.HandoffPin!;
            var wrong = oldPin == "0000" ? "1111" : "0000";

            for (var i = 0; i < 5; i++)
                Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, wrong)));

            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, oldPin)));

            Clock.Advance(TimeSpan.FromMinutes(16));
            var newPin = (await Sut().GetAsync(Buyer.Id, deal.Id)).HandoffPin!;
            if (newPin != oldPin)
                Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, oldPin)));
            Assert.Equal(DealStatus.Completed, (await Sut().ConfirmHandoffAsync(Seller.Id, deal.Id, newPin)).Status);
        }

        // ---------- shipping ----------

        [Fact]
        public async Task Ship_RequiresKnownCarrierAndTrackingNumber()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().ShipAsync(Seller.Id, deal.Id, "gls", "  ", null)));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().ShipAsync(Seller.Id, deal.Id, "pigeon", "ABC12345", null)));
        }

        [Fact]
        public async Task Ship_BySellerOnly_ShowsTrackingToBoth()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().ShipAsync(Buyer.Id, deal.Id, "gls", "GLS123456", null)));

            var shipped = await Sut().ShipAsync(Seller.Id, deal.Id, "magyar_posta", "RL123456789HU", TestImages.File());

            Assert.Equal(DealStatus.Shipped, shipped.Status);
            Assert.NotNull(shipped.ShipmentPhoto);
            var buyerView = await Sut().GetAsync(Buyer.Id, deal.Id);
            Assert.Equal("RL123456789HU", buyerView.TrackingNumber);
            Assert.Contains("RL123456789HU", buyerView.TrackingUrl);
            Assert.Equal(Clock.UtcNow.AddDays(14), buyerView.AutoCompleteAt!.Value, TimeSpan.FromSeconds(1));
            Assert.Contains("confirm_receipt", buyerView.NextActions);
        }

        [Fact]
        public async Task ConfirmReceipt_ByBuyerOnly_Completes()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().ConfirmReceiptAsync(Seller.Id, deal.Id, null)));
            var done = await Sut().ConfirmReceiptAsync(Buyer.Id, deal.Id, TestImages.File());

            Assert.Equal(DealStatus.Completed, done.Status);
            Assert.Equal(CompletionReason.ReceiptConfirmed, done.CompletionReason);
            Assert.NotNull(done.ReceiptPhoto);
        }

        [Fact]
        public async Task ConfirmReceipt_BeforeShipped_Conflicts()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().ConfirmReceiptAsync(Buyer.Id, deal.Id, null)));
        }

        [Fact]
        public async Task Dispute_EndsDealAsDisputed_OpensReviews_ArchivesListing()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);

            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().DisputeAsync(Buyer.Id, deal.Id, "too short")));
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().DisputeAsync(Seller.Id, deal.Id, "The parcel never arrived, tracking stuck.")));
            var disputed = await Sut().DisputeAsync(Buyer.Id, deal.Id, "The parcel never arrived, tracking stuck for 10 days.");

            Assert.Equal(DealStatus.Disputed, disputed.Status);
            Assert.Equal("The parcel never arrived, tracking stuck for 10 days.", disputed.DisputeReason);
            Assert.Equal(Clock.UtcNow.AddDays(14), disputed.ReviewDeadline!.Value, TimeSpan.FromSeconds(1));
            Assert.Contains("review", disputed.NextActions);
            Assert.Equal(ListingStatus.Archived, Db.NewContext().Listings.Single(l => l.Id == deal.ListingId).Status);
            Assert.Empty(Db.NewContext().Reports); // Coffer does not arbitrate
            var transcript = await Conversations().GetTranscriptAsync(deal.ConversationId);
            Assert.Contains(transcript, m => m.Kind == MessageKind.System && m.Body.Contains("tracking stuck for 10 days"));
        }

        [Fact]
        public async Task Dispute_FreesListingForNewDeal()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            await Sut().DisputeAsync(Buyer.Id, deal.Id, "The parcel never arrived, tracking stuck for 10 days.");

            var listing = Db.Context.Listings.Single(l => l.Id == deal.ListingId);
            listing.Status = ListingStatus.Active; // owner reactivated it
            Db.Context.SaveChanges();
            var other = Db.AddUser("other");
            var conversation = await Conversations().OpenAsync(other.Id, "listing", listing.Id);

            Assert.Equal(DealStatus.Proposed, (await Sut().ProposeAsync(Seller.Id, conversation.Id, DeliveryMethod.Shipping)).Status);
        }

        [Fact]
        public async Task Shipped_AutoCompletesAfter14Days()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);

            Clock.Advance(TimeSpan.FromDays(14).Add(TimeSpan.FromMinutes(1)));
            var view = await Sut().GetAsync(Seller.Id, deal.Id);

            Assert.Equal(DealStatus.Completed, view.Status);
            Assert.Equal(CompletionReason.AutoCompleted, view.CompletionReason);
            Assert.Equal(ListingStatus.Sold, ListingOf(deal.ListingId).Status);
        }

        [Fact]
        public async Task Shipped_NotYet14Days_StaysShipped()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            Clock.Advance(TimeSpan.FromDays(13));
            Assert.Equal(DealStatus.Shipped, (await Sut().GetAsync(Seller.Id, deal.Id)).Status);
        }

        [Fact]
        public async Task Disputed_DoesNotAutoComplete()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            await Sut().DisputeAsync(Buyer.Id, deal.Id, "The parcel never arrived, tracking stuck for 10 days.");

            Clock.Advance(TimeSpan.FromDays(30));
            Assert.Equal(DealStatus.Disputed, (await Sut().GetAsync(Seller.Id, deal.Id)).Status);
        }

        [Fact]
        public async Task Sweeper_AutoCompletesDueDeals()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            Clock.Advance(TimeSpan.FromDays(15));

            await Sut().ApplyDueTimeRulesAsync();

            Assert.Equal(DealStatus.Completed, Db.NewContext().Deals.Single().Status);
        }

        [Fact]
        public async Task Stranger_CannotReadDeal()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Sut().GetAsync(Db.AddUser("stranger").Id, deal.Id)));
        }

        [Fact]
        public async Task Mine_ListsDealsForBothParties()
        {
            await ActiveDeal(DeliveryMethod.LocalPickup);
            Assert.Single(await Sut().GetMineAsync(Seller.Id));
            Assert.Single(await Sut().GetMineAsync(Buyer.Id));
            Assert.Empty(await Sut().GetMineAsync(Db.AddUser("x").Id));
        }
    }
}
