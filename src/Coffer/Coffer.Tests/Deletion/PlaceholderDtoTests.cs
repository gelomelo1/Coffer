using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Deletion
{
    /// <summary>
    /// After an account is deleted, other users still see their chats, deals, reviews and comments, with the deleted
    /// user (and their listing) coming back as a placeholder: isDeleted / listingDeleted set, no name, no avatar.
    /// </summary>
    [Collection("api")]
    public class PlaceholderDtoTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private MarketRows Rows => new(Db);

        private User _anna = null!;
        private User _bela = null!;
        private Deal _deal = null!;
        private Message _annasMessage = null!;
        private ItemProvided _belasItem = null!;

        private async Task<HttpClient> AnnaDeletedAsync()
        {
            _anna = Db.AddUser("anna");
            _bela = Db.AddUser("bela");
            _anna.Avatar = "https://example.com/anna.png";
            Db.Context.SaveChanges();
            _deal = Rows.Deal(Rows.Listing(_anna, ListingStatus.Sold, "Silver coins"), _bela, DealStatus.Completed);
            var chat = Db.Context.Conversations.Single(c => c.Id == _deal.ConversationId);
            _annasMessage = Rows.Say(chat, _anna, "Meet at the station at 5?");
            Rows.Say(chat, _bela, "Yes, see you there.");
            Rows.Review(_deal, _anna, _bela);
            _belasItem = Db.AddItem(Db.AddCollection(_bela));
            Rows.Comment(_belasItem, _bela, "Thanks @anna for the tip", mention: _anna);

            Assert.Equal(HttpStatusCode.NoContent, (await _api.ClientFor(_anna).DeleteAsync("api/Account")).StatusCode);
            return _api.ClientFor(_bela);
        }

        private static async Task<JsonElement> Get(HttpClient client, string url)
        {
            var response = await client.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        }

        private static void AssertPlaceholderUser(JsonElement user)
        {
            Assert.True(user.GetProperty("isDeleted").GetBoolean());
            Assert.Equal("", user.GetProperty("name").GetString());
            Assert.Equal(JsonValueKind.Null, user.GetProperty("avatar").ValueKind);
        }

        private static void AssertPlaceholderSubject(JsonElement subject)
        {
            Assert.True(subject.GetProperty("isDeleted").GetBoolean());
            Assert.Equal("", subject.GetProperty("title").GetString());
            Assert.Equal(JsonValueKind.Null, subject.GetProperty("image").ValueKind);
        }

        [Fact]
        public async Task DeletedCounterpartIsAPlaceholderEverywhere()
        {
            var bela = await AnnaDeletedAsync();

            var inbox = (await Get(bela, "api/Conversations?page=1")).GetProperty("items")[0];
            AssertPlaceholderUser(inbox.GetProperty("other"));
            AssertPlaceholderSubject(inbox.GetProperty("subject"));

            var conversation = await Get(bela, $"api/Conversations/{_deal.ConversationId}");
            AssertPlaceholderUser(conversation.GetProperty("other"));
            AssertPlaceholderSubject(conversation.GetProperty("subject"));

            foreach (var deal in new[] { (await Get(bela, "api/Deals/Mine?page=1")).GetProperty("items")[0], await Get(bela, $"api/Deals/{_deal.Id}") })
            {
                AssertPlaceholderUser(deal.GetProperty("seller"));
                Assert.False(deal.GetProperty("buyer").GetProperty("isDeleted").GetBoolean());
                Assert.True(deal.GetProperty("listingDeleted").GetBoolean());
                Assert.Equal("", deal.GetProperty("listingTitle").GetString());
            }

            var review = (await Get(bela, $"api/Users/{_bela.Id}/MarketReviews?page=1")).GetProperty("items")[0];
            AssertPlaceholderUser(review.GetProperty("reviewer"));
            Assert.True(review.GetProperty("listingDeleted").GetBoolean());
        }

        [Fact]
        public async Task ChatWithDeletedUserLoadsButCannotSend()
        {
            var bela = await AnnaDeletedAsync();

            var messages = await Get(bela, $"api/Conversations/{_deal.ConversationId}/Messages");
            var send = await bela.PostAsJsonAsync($"api/Conversations/{_deal.ConversationId}/Messages", new { kind = "text", body = "Are you there?" });

            var annas = messages.GetProperty("items").EnumerateArray().Single(m => m.GetProperty("id").GetGuid() == _annasMessage.Id);
            Assert.Equal("Meet at the station at 5?", annas.GetProperty("body").GetString());
            Assert.Equal(HttpStatusCode.Conflict, send.StatusCode);
            Assert.Equal("otherUserDeleted", JsonDocument.Parse(await send.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString());
        }

        [Fact]
        public async Task MentionOfDeletedUserIsPlaceholder()
        {
            var bela = await AnnaDeletedAsync();

            var page = await Get(bela, $"api/Items/{_belasItem.Id}/Comments");

            var mention = page.GetProperty("threads")[0].GetProperty("mentions")[0];
            Assert.True(mention.GetProperty("isDeleted").GetBoolean());
            Assert.Equal("", mention.GetProperty("name").GetString());
        }

        [Fact]
        public async Task AdminsSeeDeletedUserByLabel()
        {
            await AnnaDeletedAsync();
            var report = new Report
            {
                Id = Guid.NewGuid(), ReporterId = _bela.Id, TargetType = ReportTargetType.Message, TargetId = _annasMessage.Id, TargetOwnerId = _anna.Id,
                ConversationId = _deal.ConversationId, TargetSummary = "Meet at", Rule = ReportRule.Harassment, Reason = "Rude message in the chat.", CreatedAt = DateTime.UtcNow,
            };
            Db.Context.Reports.Add(report);
            Db.Context.SaveChanges();

            using var scope = Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.CreateScope(_api.Services);
            var detail = await Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions
                .GetRequiredService<Coffer.BusinessLogic.Marketplace.Reports.IAdminReportService>(scope.ServiceProvider).GetAsync(report.Id);

            Assert.Equal("Deleted user", detail.TargetOwner.Name);
            Assert.True(detail.TargetOwner.IsDeleted);
            Assert.Equal("bela", detail.Reporter.Name);
        }

        public void Dispose() => _api.Dispose();
    }
}
