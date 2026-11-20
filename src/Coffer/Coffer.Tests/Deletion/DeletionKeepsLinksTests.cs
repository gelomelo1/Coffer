using System.Net;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.Domain.Community;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Deletion
{
    /// <summary>
    /// Deletion audit: whatever deletes a user's item or collection (the owner, or an admin acting on a report), the
    /// rows other users made about it — comments, replies, reactions, reports — stay, linked to the now empty item.
    /// </summary>
    [Collection("api")]
    public class DeletionKeepsLinksTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        /// <summary>What another user (and the owner, replying) attached to one item.</summary>
        private sealed record Linked(Guid CommentId, Guid OwnerReplyId, Guid ReactionId, Guid ReportId);

        private Linked AttachOthersData(User owner, User other, ItemProvided item)
        {
            var now = DateTime.UtcNow;
            var comment = new ItemComment { Id = Guid.NewGuid(), ItemId = item.Id, AuthorId = other.Id, Body = "Lovely cap!", CreatedAt = now };
            comment.RootId = comment.Id;
            var reply = new ItemComment { Id = Guid.NewGuid(), ItemId = item.Id, AuthorId = owner.Id, ParentId = comment.Id, RootId = comment.Id, Body = "Thanks!", CreatedAt = now };
            var reaction = new ReactionProvided(other.Id, item.Id, true);
            var report = new Report
            {
                Id = Guid.NewGuid(), ReporterId = other.Id, TargetType = ReportTargetType.Item, TargetId = item.Id, TargetOwnerId = owner.Id,
                ItemId = item.Id, TargetSummary = "cap", Rule = ReportRule.IllegalItem, Reason = "This shows a real weapon.", CreatedAt = now,
            };
            Db.Context.ItemComments.AddRange(comment, reply);
            Db.Context.Reactions.Add(reaction);
            Db.Context.Reports.Add(report);
            Db.Context.SaveChanges();
            return new Linked(comment.Id, reply.Id, reaction.Id, report.Id);
        }

        private void AssertTombstonedAndStillLinked(ItemProvided item, Linked linked)
        {
            using var fresh = Db.NewContext();
            var row = fresh.Items.Single(i => i.Id == item.Id);
            Assert.NotNull(row.DeletedAt);
            Assert.Equal("", row.Image);
            Assert.Null(row.Description);
            Assert.Null(row.PrivateNote);
            Assert.Empty(fresh.ItemTags.Where(t => t.ItemId == item.Id));
            Assert.Equal(item.Id, fresh.ItemComments.Single(c => c.Id == linked.CommentId).ItemId);
            Assert.Equal(linked.CommentId, fresh.ItemComments.Single(c => c.Id == linked.OwnerReplyId).ParentId);
            Assert.Equal(item.Id, fresh.Reactions.Single(r => r.Id == linked.ReactionId).ItemId);
            Assert.Equal(item.Id, fresh.Reports.Single(r => r.Id == linked.ReportId).ItemId);
        }

        private ItemProvided AddTaggedItem(CollectionProvided collection)
        {
            var item = Db.AddItem(collection, privateNote: "bought at the flea market");
            item.Description = "A rare cap";
            Db.Context.ItemTags.Add(new ItemTags { ItemId = item.Id, Tag = "rare" });
            Db.Context.SaveChanges();
            return item;
        }

        [Fact]
        public async Task OwnerDeletingItemKeepsOthersCommentsReactionsAndReports()
        {
            var owner = Db.AddUser("owner");
            var other = Db.AddUser("other");
            var item = AddTaggedItem(Db.AddCollection(owner));
            var linked = AttachOthersData(owner, other, item);

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Items/{item.Id}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            AssertTombstonedAndStillLinked(item, linked);
            Assert.Contains(_api.Python.Calls, c => c.Method == HttpMethod.Delete && c.Path == $"/delete_embeddings/{item.Id}");
        }

        [Fact]
        public async Task OwnerDeletingCollectionKeepsOthersDataOnAllItsItems()
        {
            var owner = Db.AddUser("owner");
            var other = Db.AddUser("other");
            var collection = Db.AddCollection(owner);
            var first = AddTaggedItem(collection);
            var second = AddTaggedItem(collection);
            var linkedFirst = AttachOthersData(owner, other, first);
            var linkedSecond = AttachOthersData(owner, other, second);
            var follow = Db.Follow(other, collection);

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Collections/{collection.Id}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            AssertTombstonedAndStillLinked(first, linkedFirst);
            AssertTombstonedAndStillLinked(second, linkedSecond);
            using var fresh = Db.NewContext();
            var row = fresh.Collections.Single(c => c.Id == collection.Id);
            Assert.NotNull(row.DeletedAt);
            Assert.Equal("", row.Name);
            Assert.Null(row.Image);
            Assert.False(fresh.Follows.Any(f => f.Id == follow.Id));
            Assert.Contains(_api.Python.Calls, c => c.Method == HttpMethod.Delete && c.Path == $"/delete_collection_embeddings/{collection.Id}");
        }

        [Fact]
        public async Task AdminRemovingItemKeepsOthersData()
        {
            var owner = Db.AddUser("owner");
            var other = Db.AddUser("other");
            var item = AddTaggedItem(Db.AddCollection(owner));
            var linked = AttachOthersData(owner, other, item);
            var admin = Db.AddManagerAdmin();

            using (var scope = _api.Services.CreateScope())
            {
                await scope.ServiceProvider.GetRequiredService<IAdminReportService>().ResolveAsync(admin.Id, linked.ReportId,
                    new ResolveReportInput(ReportDecision.Removed, ReportRule.IllegalItem, "Weapons are not allowed on Coffer."));
            }

            AssertTombstonedAndStillLinked(item, linked);
            Assert.Contains(_api.Python.Calls, c => c.Method == HttpMethod.Delete && c.Path == $"/delete_embeddings/{item.Id}");
        }

        [Fact]
        public async Task TombstoneSurvivesAiServiceFailure()
        {
            var owner = Db.AddUser("owner");
            var other = Db.AddUser("other");
            var item = AddTaggedItem(Db.AddCollection(owner));
            var linked = AttachOthersData(owner, other, item);
            _api.Python.StatusCode = HttpStatusCode.InternalServerError;

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Items/{item.Id}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            AssertTombstonedAndStillLinked(item, linked);
        }

        public void Dispose() => _api.Dispose();
    }
}
