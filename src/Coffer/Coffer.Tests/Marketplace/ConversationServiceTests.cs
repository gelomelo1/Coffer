using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Marketplace.Reputation;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    public class ConversationServiceTests : MarketplaceTestBase
    {
        private readonly User _seller;
        private readonly User _buyer;
        private readonly Listing _listing;

        public ConversationServiceTests()
        {
            _seller = Db.AddUser("seller");
            _buyer = Db.AddUser("buyer");
            _listing = AddListing(_seller);
        }

        private ConversationService Sut() => new(Db.Context, Clock, new IConversationSubjectPolicy[] { new ListingConversationPolicy(Db.Context) });

        private static PostMessageInput Text(string body) => new(MessageKind.Text, body, null, null, null);
        private static PostMessageInput Offer(int cents) => new(MessageKind.PriceOffer, null, cents, null, null);
        private PostMessageInput Meetup(TimeSpan fromNow, string place = "Deák tér") => new(MessageKind.MeetupProposal, null, null, Clock.UtcNow.Add(fromNow), place);

        private static async Task<MarketplaceError> ErrorOf(Func<Task> act)
            => (await Assert.ThrowsAsync<MarketplaceException>(act)).Error;

        private async Task<Guid> OpenAsBuyer(Listing? listing = null)
            => (await Sut().OpenAsync(_buyer.Id, "listing", (listing ?? _listing).Id)).Id;

        [Fact]
        public async Task Open_IsIdempotentPerInquirer()
        {
            var first = await OpenAsBuyer();
            var second = await OpenAsBuyer();
            var other = (await Sut().OpenAsync(Db.AddUser("other").Id, "listing", _listing.Id)).Id;

            Assert.Equal(first, second);
            Assert.NotEqual(first, other);
            Assert.Equal(2, Db.NewContext().Conversations.Count());
        }

        [Fact]
        public async Task Open_SetsRolesAndListingSubject()
        {
            var dto = await Sut().OpenAsync(_buyer.Id, "listing", _listing.Id);

            Assert.Equal(ParticipantRole.Inquirer, dto.MyRole);
            Assert.Equal(_seller.Id, dto.Other.Id);
            Assert.Equal(_listing.Title, dto.Subject.Title);
        }

        [Fact]
        public async Task Open_OwnerCannotStartOwnConversation()
        {
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().OpenAsync(_seller.Id, "listing", _listing.Id)));
        }

        [Fact]
        public async Task Open_ArchivedOrSoldListing_Conflicts()
        {
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().OpenAsync(_buyer.Id, "listing", AddListing(_seller, status: ListingStatus.Archived).Id)));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().OpenAsync(_buyer.Id, "listing", AddListing(_seller, status: ListingStatus.Sold).Id)));
        }

        [Fact]
        public async Task Open_UnknownSubjectType_Validation()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().OpenAsync(_buyer.Id, "item", _listing.Id)));
        }

        [Fact]
        public async Task NonParticipant_CannotReadOrPost()
        {
            var id = await OpenAsBuyer();
            var stranger = Db.AddUser("stranger");

            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Sut().GetAsync(stranger.Id, id)));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Sut().GetMessagesAsync(stranger.Id, id, null)));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Sut().PostAsync(stranger.Id, id, Text("hi"))));
        }

        [Fact]
        public async Task Text_IsStoredAndListed()
        {
            var id = await OpenAsBuyer();
            await Sut().PostAsync(_buyer.Id, id, Text("  Is it still available?  "));

            var messages = await Sut().GetMessagesAsync(_seller.Id, id, null);
            var message = Assert.Single(messages);
            Assert.Equal("Is it still available?", message.Body);
            Assert.Equal(_buyer.Id, message.SenderId);
        }

        [Fact]
        public async Task Text_EmptyOrTooLong_Rejected()
        {
            var id = await OpenAsBuyer();
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().PostAsync(_buyer.Id, id, Text("   "))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().PostAsync(_buyer.Id, id, Text(new string('x', 2001)))));
        }

        [Fact]
        public async Task Offer_NonPositive_Rejected()
        {
            var id = await OpenAsBuyer();
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().PostAsync(_buyer.Id, id, Offer(0))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().PostAsync(_buyer.Id, id, Offer(-5))));
        }

        [Fact]
        public async Task Offer_OnExchangeListing_Rejected()
        {
            var id = await OpenAsBuyer(AddListing(_seller, kind: ListingKind.Exchange));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().PostAsync(_buyer.Id, id, Offer(500))));
        }

        [Fact]
        public async Task Offer_AcceptedByRecipient_SetsAgreedPrice()
        {
            var id = await OpenAsBuyer();
            var offer = await Sut().PostAsync(_buyer.Id, id, Offer(800));

            await Sut().RespondAsync(_seller.Id, id, offer.Id, "accept");

            Assert.Equal(800, Db.NewContext().Conversations.Single().AgreedPriceCents);
            var stored = (await Sut().GetMessagesAsync(_buyer.Id, id, null)).First(m => m.Id == offer.Id);
            Assert.Equal(ProposalStatus.Accepted, stored.Status);
            Assert.Equal(800, stored.AmountCents);
        }

        [Fact]
        public async Task Offer_SenderCannotAccept_RecipientCannotWithdraw()
        {
            var id = await OpenAsBuyer();
            var offer = await Sut().PostAsync(_buyer.Id, id, Offer(800));

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().RespondAsync(_buyer.Id, id, offer.Id, "accept")));
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().RespondAsync(_seller.Id, id, offer.Id, "withdraw")));
        }

        [Fact]
        public async Task Offer_AlreadyAnswered_Conflicts()
        {
            var id = await OpenAsBuyer();
            var offer = await Sut().PostAsync(_buyer.Id, id, Offer(800));
            await Sut().RespondAsync(_seller.Id, id, offer.Id, "decline");

            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().RespondAsync(_seller.Id, id, offer.Id, "accept")));
        }

        [Fact]
        public async Task Offer_NewOfferWithdrawsOlderPending()
        {
            var id = await OpenAsBuyer();
            var older = await Sut().PostAsync(_buyer.Id, id, Offer(500));
            await Sut().PostAsync(_buyer.Id, id, Offer(700));

            var stored = (await Sut().GetMessagesAsync(_buyer.Id, id, null)).First(m => m.Id == older.Id);
            Assert.Equal(ProposalStatus.Withdrawn, stored.Status);
        }

        [Fact]
        public async Task Meetup_InPast_Rejected()
        {
            var id = await OpenAsBuyer();
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().PostAsync(_buyer.Id, id, Meetup(TimeSpan.FromMinutes(-5)))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().PostAsync(_buyer.Id, id, Meetup(TimeSpan.FromDays(1), place: " "))));
        }

        [Fact]
        public async Task Meetup_AcceptedCopiesToOpenDeal()
        {
            var id = await OpenAsBuyer();
            var deal = new Deal
            {
                ListingId = _listing.Id, ConversationId = id, SellerId = _seller.Id, BuyerId = _buyer.Id,
                Method = DeliveryMethod.LocalPickup, Status = DealStatus.AwaitingHandoff, CreatedAt = Clock.UtcNow, UpdatedAt = Clock.UtcNow,
            };
            Db.Context.Deals.Add(deal);
            Db.Context.SaveChanges();
            var meetup = await Sut().PostAsync(_seller.Id, id, Meetup(TimeSpan.FromDays(2), "Keleti station"));

            await Sut().RespondAsync(_buyer.Id, id, meetup.Id, "accept");

            var stored = Db.NewContext().Deals.Single();
            Assert.Equal("Keleti station", stored.MeetupPlace);
            Assert.Equal(Clock.UtcNow.AddDays(2), stored.MeetupAt!.Value, TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task OwnerFirstReply_StampsResponseTime()
        {
            var id = await OpenAsBuyer();
            await Sut().PostAsync(_buyer.Id, id, Text("hi"));
            Clock.Advance(TimeSpan.FromMinutes(42));
            await Sut().PostAsync(_seller.Id, id, Text("hello"));
            var stamp = Clock.UtcNow;
            Clock.Advance(TimeSpan.FromMinutes(5));
            await Sut().PostAsync(_seller.Id, id, Text("again"));

            Assert.Equal(stamp, Db.NewContext().Conversations.Single().OwnerFirstResponseAt!.Value, TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task OwnerAnsweringAnOffer_CountsAsFirstResponse()
        {
            var id = await OpenAsBuyer();
            var offer = await Sut().PostAsync(_buyer.Id, id, Offer(800));
            Clock.Advance(TimeSpan.FromMinutes(10));

            await Sut().RespondAsync(_seller.Id, id, offer.Id, "accept");

            Assert.Equal(Clock.UtcNow, Db.NewContext().Conversations.Single().OwnerFirstResponseAt!.Value, TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task Responsiveness_RateAndMedian()
        {
            async Task Inquiry(TimeSpan? replyAfter)
            {
                var listing = AddListing(_seller);
                var id = (await Sut().OpenAsync(Db.AddUser($"b{Guid.NewGuid():N}").Id, "listing", listing.Id)).Id;
                var conversation = Db.Context.Conversations.Single(c => c.Id == id);
                var inquirer = conversation.Participants.Single(p => p.Role == ParticipantRole.Inquirer).UserId;
                await Sut().PostAsync(inquirer, id, Text("hi"));
                if (replyAfter.HasValue)
                {
                    Clock.Advance(replyAfter.Value);
                    await Sut().PostAsync(_seller.Id, id, Text("hello"));
                }
            }

            await Inquiry(TimeSpan.FromMinutes(30));
            await Inquiry(TimeSpan.FromMinutes(90));
            await Inquiry(null);

            var stats = await new ResponsivenessService(Db.Context, Clock).GetAsync(_seller.Id);
            Assert.Equal(3, stats.ConversationsReceived);
            Assert.Equal(0.67, stats.ResponseRate!.Value, 2);
            Assert.Equal(60, stats.TypicalResponseMinutes);
        }

        [Fact]
        public async Task Responsiveness_NoInquiries_ReturnsNulls()
        {
            var stats = await new ResponsivenessService(Db.Context, Clock).GetAsync(_seller.Id);
            Assert.Equal(0, stats.ConversationsReceived);
            Assert.Null(stats.ResponseRate);
            Assert.Null(stats.TypicalResponseMinutes);
        }

        [Fact]
        public async Task Inbox_UnreadCountAndMarkRead()
        {
            var id = await OpenAsBuyer();
            await Sut().PostAsync(_buyer.Id, id, Text("one"));
            Clock.Advance(TimeSpan.FromSeconds(1));
            await Sut().PostAsync(_buyer.Id, id, Text("two"));

            var inbox = await Sut().ListMineAsync(_seller.Id);
            Assert.Equal(2, Assert.Single(inbox).UnreadCount);
            Assert.Equal("two", inbox[0].LastMessagePreview);
            Assert.Equal(0, (await Sut().ListMineAsync(_buyer.Id))[0].UnreadCount);

            Clock.Advance(TimeSpan.FromSeconds(1));
            await Sut().MarkReadAsync(_seller.Id, id);
            Assert.Equal(0, (await Sut().ListMineAsync(_seller.Id))[0].UnreadCount);
        }

        [Fact]
        public async Task SystemMessage_AppearsInTranscript()
        {
            var id = await OpenAsBuyer();
            await Sut().PostSystemAsync(id, "dealProposed", "Deal proposed.");

            var transcript = await Sut().GetTranscriptAsync(id);
            var message = Assert.Single(transcript);
            Assert.Equal(MessageKind.System, message.Kind);
            Assert.Null(message.SenderId);
        }
    }
}
