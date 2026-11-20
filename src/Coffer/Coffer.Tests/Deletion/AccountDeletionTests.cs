using System.Net;
using System.Text.Json;
using Coffer.Domain.Marketplace;
using Coffer.Domain.Moderation;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Deletion
{
    /// <summary>
    /// DELETE api/Account: blocked while trades are open; wipes the user's own content and personal data, keeps every
    /// row other users (and moderation) rely on, and makes the old login token useless.
    /// </summary>
    [Collection("api")]
    public class AccountDeletionTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private MarketRows Rows => new(Db);

        private static JsonElement Json(string body) => JsonDocument.Parse(body).RootElement;

        [Fact]
        public async Task OpenTradesBlockDeletion()
        {
            var me = Db.AddUser("me");
            var other = Db.AddUser("other");
            var shippedAt = DateTime.UtcNow.AddDays(-2);
            var handoff = Rows.Deal(Rows.Listing(me), other, DealStatus.AwaitingHandoff);
            var shipped = Rows.Deal(Rows.Listing(other), me, DealStatus.Shipped, shippedAt);
            var client = _api.ClientFor(me);

            var status = Json(await (await client.GetAsync("api/Account/Deletion")).Content.ReadAsStringAsync());
            var delete = await client.DeleteAsync("api/Account");

            Assert.False(status.GetProperty("canDelete").GetBoolean());
            var blocking = status.GetProperty("blockingDeals").EnumerateArray().ToDictionary(d => d.GetProperty("dealId").GetGuid());
            Assert.Equal(2, blocking.Count);
            Assert.True(blocking[handoff.Id].GetProperty("canCancel").GetBoolean());
            Assert.Equal(JsonValueKind.Null, blocking[handoff.Id].GetProperty("endsLatestAt").ValueKind);
            Assert.False(blocking[shipped.Id].GetProperty("canCancel").GetBoolean());
            // SQLite hands back unspecified-kind times (Npgsql: UTC), so compare the wall-clock value.
            Assert.Equal(shippedAt.AddDays(14), DateTime.SpecifyKind(blocking[shipped.Id].GetProperty("endsLatestAt").GetDateTime(), DateTimeKind.Utc), TimeSpan.FromSeconds(1));
            Assert.Equal("other", blocking[shipped.Id].GetProperty("other").GetProperty("name").GetString());

            Assert.Equal(HttpStatusCode.Conflict, delete.StatusCode);
            Assert.Equal("accountHasOpenTrades", Json(await delete.Content.ReadAsStringAsync()).GetProperty("code").GetString());
            using var fresh = Db.NewContext();
            Assert.Null(fresh.Users.Single(u => u.Id == me.Id).DeletedAt);
        }

        [Fact]
        public async Task FinishedTradesDoNotBlock()
        {
            var me = Db.AddUser("me");
            var other = Db.AddUser("other");
            Rows.Deal(Rows.Listing(me, ListingStatus.Sold), other, DealStatus.Completed);
            Rows.Deal(Rows.Listing(me), other, DealStatus.Cancelled);
            Rows.Deal(Rows.Listing(other, ListingStatus.Archived), me, DealStatus.Disputed, DateTime.UtcNow.AddDays(-1));

            var status = Json(await (await _api.ClientFor(me).GetAsync("api/Account/Deletion")).Content.ReadAsStringAsync());

            Assert.True(status.GetProperty("canDelete").GetBoolean());
            Assert.Empty(status.GetProperty("blockingDeals").EnumerateArray());
        }

        [Fact]
        public async Task DeletingAccountWipesOwnContentAndKeepsOthers()
        {
            var a = Db.AddUser("anna");
            var b = Db.AddUser("bela");
            a.Avatar = "https://lh3.googleusercontent.com/a/photo";
            a.Summary = "I collect coins";
            Db.Context.SaveChanges();

            var aCollection = Db.AddCollection(a);
            var aItem = Db.AddItem(aCollection);
            var bOnAItem = Rows.Comment(aItem, b, "Nice one!");
            var bReaction = new Coffer.Domain.Entities.ReactionProvided(b.Id, aItem.Id, true);
            Db.Context.Reactions.Add(bReaction);
            var aListing = Rows.Listing(a, ListingStatus.Sold);
            var deal = Rows.Deal(aListing, b, DealStatus.Completed);
            var aMessage = Rows.Say(Db.Context.Conversations.Single(c => c.Id == deal.ConversationId), a, "Meet at the station at 5?");
            var bMessage = Rows.Say(Db.Context.Conversations.Single(c => c.Id == deal.ConversationId), b, "Yes, see you there.");
            var bReview = Rows.Review(deal, b, a);

            var bItem = Db.AddItem(Db.AddCollection(b));
            var aOnBItem = Rows.Comment(bItem, a, "I have the same one, @bela", mention: b);
            var aFollow = Db.Follow(a, Db.Context.Collections.Single(c => c.Id == bItem.CollectionId));
            var aReport = new Report
            {
                Id = Guid.NewGuid(), ReporterId = a.Id, TargetType = ReportTargetType.Item, TargetId = bItem.Id, TargetOwnerId = b.Id,
                ItemId = bItem.Id, TargetSummary = "cap", Rule = ReportRule.OffTopic, Reason = "Not a collectible at all.", CreatedAt = DateTime.UtcNow,
            };
            Db.Context.Reports.Add(aReport);
            var admin = Db.AddManagerAdmin();
            var suspension = new UserSuspension
            {
                Id = Guid.NewGuid(), UserId = a.Id, Reason = "Spam", StartsAt = DateTime.UtcNow.AddDays(-10), EndsAt = DateTime.UtcNow.AddDays(-9),
                CreatedByAdminId = admin.Id, CreatedAt = DateTime.UtcNow.AddDays(-10),
            };
            Db.Context.UserSuspensions.Add(suspension);
            Db.Context.SaveChanges();

            var response = await _api.ClientFor(a).DeleteAsync("api/Account");

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            using var fresh = Db.NewContext();
            var user = fresh.Users.Single(u => u.Id == a.Id);
            Assert.NotNull(user.DeletedAt);
            Assert.DoesNotContain("anna", user.Name);
            Assert.DoesNotContain("anna", user.Email);
            Assert.StartsWith("deleted-", user.ProviderUserId);
            Assert.Null(user.Avatar);
            Assert.Null(user.Summary);
            Assert.Null(user.MarketTermsVersion);

            // A's own content: tombstoned.
            Assert.NotNull(fresh.Collections.Single(c => c.Id == aCollection.Id).DeletedAt);
            Assert.NotNull(fresh.Items.Single(i => i.Id == aItem.Id).DeletedAt);
            var listing = fresh.Listings.Single(l => l.Id == aListing.Id);
            Assert.NotNull(listing.DeletedAt);
            Assert.Equal("", listing.Title);
            Assert.Null(listing.Description);
            Assert.Equal(ListingStatus.Archived, listing.Status);
            Assert.Empty(fresh.ListingLines.Where(l => l.ListingId == aListing.Id));
            Assert.Empty(fresh.ListingImages.Where(l => l.ListingId == aListing.Id));

            // Other users' data and the records: kept, still linked.
            Assert.Equal(aItem.Id, fresh.ItemComments.Single(c => c.Id == bOnAItem.Id).ItemId);
            Assert.True(fresh.Reactions.Any(r => r.Id == bReaction.Id));
            Assert.Equal(DealStatus.Completed, fresh.Deals.Single(d => d.Id == deal.Id).Status);
            Assert.Equal("Meet at the station at 5?", fresh.Messages.Single(m => m.Id == aMessage.Id).Body);
            Assert.Equal(a.Id, fresh.Messages.Single(m => m.Id == aMessage.Id).SenderId);
            Assert.True(fresh.Messages.Any(m => m.Id == bMessage.Id));
            Assert.Equal(a.Id, fresh.Reviews.Single(r => r.Id == bReview.Id).RevieweeId);
            Assert.Equal(a.Id, fresh.Reports.Single(r => r.Id == aReport.Id).ReporterId);
            Assert.True(fresh.UserSuspensions.Any(s => s.Id == suspension.Id));

            // A's comment: a placeholder in its place; A's follow: gone.
            var comment = fresh.ItemComments.Single(c => c.Id == aOnBItem.Id);
            Assert.Equal("", comment.Body);
            Assert.NotNull(comment.DeletedAt);
            Assert.Empty(fresh.ItemCommentMentions.Where(m => m.CommentId == aOnBItem.Id));
            Assert.False(fresh.Follows.Any(f => f.Id == aFollow.Id));
        }

        [Fact]
        public async Task DeletedUsersCommentsBecomePlaceholdersInThreads()
        {
            var a = Db.AddUser("anna");
            var b = Db.AddUser("bela");
            var bItem = Db.AddItem(Db.AddCollection(b));
            var bThread = Rows.Comment(bItem, b, "Found it at a flea market.");
            var aReply = Rows.Comment(bItem, a, "Lucky find!", bThread);
            var aThread = Rows.Comment(bItem, a, "What year is it from?");
            var bReply = Rows.Comment(bItem, b, "From 1968.", aThread);

            Assert.Equal(HttpStatusCode.NoContent, (await _api.ClientFor(a).DeleteAsync("api/Account")).StatusCode);
            var page = Json(await (await _api.ClientFor(b).GetAsync($"api/Items/{bItem.Id}/Comments")).Content.ReadAsStringAsync());

            var threads = page.GetProperty("threads").EnumerateArray().ToDictionary(t => t.GetProperty("id").GetGuid());
            Assert.Equal(2, threads.Count);
            var aReplyDto = threads[bThread.Id].GetProperty("replies").EnumerateArray().Single(r => r.GetProperty("id").GetGuid() == aReply.Id);
            Assert.True(aReplyDto.GetProperty("isDeleted").GetBoolean());
            Assert.Equal("", aReplyDto.GetProperty("body").GetString());
            Assert.True(threads[aThread.Id].GetProperty("isDeleted").GetBoolean());
            Assert.Contains(threads[aThread.Id].GetProperty("replies").EnumerateArray(), r => r.GetProperty("id").GetGuid() == bReply.Id);
        }

        [Fact]
        public async Task OldTokenIsRejectedAfterDeletion()
        {
            var a = Db.AddUser("anna");
            var client = _api.ClientFor(a);

            Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("api/Account")).StatusCode);
            var me = await client.GetAsync("api/Auth/currentUser");
            var again = await client.DeleteAsync("api/Account");

            Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
            Assert.Equal("accountDeleted", Json(await me.Content.ReadAsStringAsync()).GetProperty("code").GetString());
            Assert.Equal(HttpStatusCode.Unauthorized, again.StatusCode);
        }

        [Fact]
        public async Task SameLoginAfterDeletionIsANewUser()
        {
            var a = Db.AddUser("anna");

            Assert.Equal(HttpStatusCode.NoContent, (await _api.ClientFor(a).DeleteAsync("api/Account")).StatusCode);

            Assert.Null(await Db.Users.GetUserByLogin("google", "sub-anna"));
            Assert.Null(await Db.Users.GetUserByName("anna"));
            Assert.Null(await Db.Users.GetUserById(a.Id));
        }

        [Fact]
        public async Task GenericUserDeleteRouteIsGone()
        {
            var a = Db.AddUser("anna");

            var response = await _api.ClientFor(a).DeleteAsync($"api/Users/{a.Id}");

            Assert.True(response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed, response.StatusCode.ToString());
            using var fresh = Db.NewContext();
            Assert.Null(fresh.Users.Single(u => u.Id == a.Id).DeletedAt);
        }

        public void Dispose() => _api.Dispose();
    }
}
