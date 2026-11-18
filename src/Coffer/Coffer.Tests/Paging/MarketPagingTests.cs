using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Marketplace;

namespace Coffer.Tests.Paging
{
    /// <summary>Marketplace lists come a page at a time with totals; chats page backwards from the newest message.</summary>
    public class MarketPagingTests : DealTestBase
    {
        private static PostMessageInput Text(string body) => new(MessageKind.Text, body, null, null, null);

        [Fact]
        public async Task Messages_PageBackwardsFromTheNewest()
        {
            var (_, conversationId) = await Chat();
            for (var i = 0; i < 45; i++)
            {
                Clock.Advance(TimeSpan.FromSeconds(1));
                await Conversations().PostAsync(Buyer.Id, conversationId, Text($"m{i}"));
            }

            var newest = await Conversations().GetMessagesPageAsync(Buyer.Id, conversationId, null, 20);
            Assert.Equal(45, newest.Total);
            Assert.True(newest.HasMore);
            Assert.Equal("m25", newest.Items.First().Body); // oldest first within the page
            Assert.Equal("m44", newest.Items.Last().Body);

            var older = await Conversations().GetMessagesPageAsync(Buyer.Id, conversationId, newest.Items.First().CreatedAt, 20);
            Assert.Equal("m5", older.Items.First().Body);
            Assert.Equal("m24", older.Items.Last().Body);

            var oldest = await Conversations().GetMessagesPageAsync(Buyer.Id, conversationId, older.Items.First().CreatedAt, 20);
            Assert.Equal(5, oldest.Items.Count);
            Assert.False(oldest.HasMore);
        }

        [Fact]
        public async Task Inbox_PagesAndCanBeLimitedToOneListing()
        {
            var listings = Enumerable.Range(0, 22).Select(_ => AddListing(Seller)).ToList();
            foreach (var listing in listings)
            {
                Clock.Advance(TimeSpan.FromSeconds(1));
                await Conversations().OpenAsync(Buyer.Id, "listing", listing.Id);
            }

            var first = await Conversations().ListMinePageAsync(Buyer.Id, 1, 20);
            var second = await Conversations().ListMinePageAsync(Buyer.Id, 2, 20);
            Assert.Equal(22, first.Total);
            Assert.Equal(2, second.Items.Count);
            Assert.Equal(22, first.Items.Concat(second.Items).Select(c => c.Id).Distinct().Count());

            var aboutOne = await Conversations().ListMinePageAsync(Buyer.Id, 1, 20, listings[3].Id);
            Assert.Equal(listings[3].Id, Assert.Single(aboutOne.Items).Subject.Id);
        }

        [Fact]
        public async Task Deals_PageWithTotalAndConversationKnowsItsLatestDeal()
        {
            var (_, conversationId) = await Chat();
            var proposed = await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);
            await Sut().DeclineAsync(Buyer.Id, proposed.Id);

            var page = await Sut().GetMinePageAsync(Buyer.Id, 1, 20);
            Assert.Equal(1, page.Total);
            var conversation = await Conversations().GetAsync(Buyer.Id, conversationId);
            Assert.Null(conversation.OpenDealId); // closed …
            Assert.Equal(proposed.Id, conversation.LatestDealId); // … but still the one the chat shows
        }
    }
}
