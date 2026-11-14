using System.Net;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Community;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Marketplace;

namespace Coffer.Tests.Community
{
    public class CommentServiceTests : ReportTestBase
    {
        private readonly CollectionProvided _collection;
        private readonly ItemProvided _item;

        public CommentServiceTests()
        {
            _collection = Db.AddCollection(Seller);
            _item = Db.AddItem(_collection);
        }

        [Fact]
        public async Task Create_PlainTextWithEmojiAndLineBreaks_IsStoredAsIs()
        {
            var body = "Gorgeous cap! 😍\nWhere did you find it?";

            var comment = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput(body));

            Assert.Equal(body, comment.Body);
            Assert.Equal(Buyer.Id, comment.Author!.Id);
            Assert.False(comment.IsOwner);
            Assert.True(comment.CanEdit);
            var page = await Comments().ListAsync(Seller.Id, _item.Id);
            Assert.Equal(body, Assert.Single(page.Threads).Body);
            Assert.False(page.Threads[0].CanEdit);
        }

        [Fact]
        public async Task Create_RejectsEmptyOrTooLongOrControlCharacters_AndUnknownItem()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("   "))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput(new string('a', 2001)))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("bad \u0007 bell"))));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Comments().CreateAsync(Buyer.Id, Guid.NewGuid(), new CreateCommentInput("Hello"))));
        }

        [Fact]
        public async Task OwnerComment_IsMarkedOwner_FromRealOwnership()
        {
            await Comments().CreateAsync(Seller.Id, _item.Id, new CreateCommentInput("Thanks! Found it in Prague."));
            await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("Nice one"));

            var threads = (await Comments().ListAsync(Buyer.Id, _item.Id)).Threads;

            Assert.True(threads.Single(t => t.Author!.Id == Seller.Id).IsOwner);
            Assert.False(threads.Single(t => t.Author!.Id == Buyer.Id).IsOwner);
        }

        [Fact]
        public async Task NestedReplies_FormATree_AndMustStayOnTheSameItem()
        {
            var root = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("Is this the 1998 edition?"));
            var reply = await Comments().CreateAsync(Seller.Id, _item.Id, new CreateCommentInput("Yes, 1998.", root.Id));
            var deeper = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("Thought so, thanks!", reply.Id));

            var thread = Assert.Single((await Comments().ListAsync(Buyer.Id, _item.Id)).Threads);
            Assert.Equal(root.Id, thread.Id);
            var level2 = Assert.Single(thread.Replies);
            Assert.Equal(reply.Id, level2.Id);
            Assert.Equal(root.Id, level2.ParentId);
            Assert.Equal(deeper.Id, Assert.Single(level2.Replies).Id);
            Assert.Equal(root.Id, Db.NewContext().ItemComments.Single(c => c.Id == deeper.Id).RootId);

            var otherItem = Db.AddItem(_collection);
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Comments().CreateAsync(Buyer.Id, otherItem.Id, new CreateCommentInput("Wrong item", root.Id))));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("No parent", Guid.NewGuid()))));
        }

        [Fact]
        public async Task Edit_OnlyByAuthor()
        {
            var comment = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("First version"));

            var edited = await Comments().UpdateAsync(Buyer.Id, _item.Id, comment.Id, new UpdateCommentInput("Second version"));
            Assert.Equal("Second version", edited.Body);
            Assert.NotNull(edited.EditedAt);

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Comments().UpdateAsync(Seller.Id, _item.Id, comment.Id, new UpdateCommentInput("Hijacked"))));
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Comments().DeleteAsync(Seller.Id, _item.Id, comment.Id)));
            Assert.Equal("Second version", Db.NewContext().ItemComments.Single().Body);
        }

        [Fact]
        public async Task Delete_LeafIsGone_ParentWithRepliesBecomesTombstone()
        {
            var root = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("Parent comment"));
            await Comments().CreateAsync(Seller.Id, _item.Id, new CreateCommentInput("Reply stays", root.Id));
            var leaf = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("Lonely leaf"));

            await Comments().DeleteAsync(Buyer.Id, _item.Id, leaf.Id);
            await Comments().DeleteAsync(Buyer.Id, _item.Id, root.Id);

            var ctx = Db.NewContext();
            Assert.DoesNotContain(ctx.ItemComments, c => c.Id == leaf.Id);
            var tomb = ctx.ItemComments.Single(c => c.Id == root.Id);
            Assert.NotNull(tomb.DeletedAt);
            Assert.Equal("", tomb.Body);

            var thread = Assert.Single((await Comments().ListAsync(Seller.Id, _item.Id)).Threads);
            Assert.True(thread.IsDeleted);
            Assert.Null(thread.Author);
            Assert.Equal("Reply stays", Assert.Single(thread.Replies).Body);
            Assert.Equal(1, (await Comments().CountAsync(new[] { _item.Id }))[_item.Id]);
        }

        [Fact]
        public async Task Mentions_AreStoredById_SpoofedOnesDropped_DeletedUsersVanish()
        {
            var anna = Db.AddUser("Anna");
            var bence = Db.AddUser("Bence");

            var comment = await Comments().CreateAsync(Buyer.Id, _item.Id,
                new CreateCommentInput("@Anna look at this one! 😍", null, new List<Guid> { anna.Id, bence.Id, Guid.NewGuid() }));

            var mention = Assert.Single(comment.Mentions);
            Assert.Equal(anna.Id, mention.UserId);
            Assert.Equal("Anna", mention.Name);

            // "@Annabel" is not a mention of Anna.
            Assert.Empty((await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("@Annabel hi", null, new List<Guid> { anna.Id }))).Mentions);

            var ctx = Db.NewContext();
            ctx.Users.Remove(ctx.Users.Single(u => u.Id == anna.Id));
            ctx.SaveChanges();
            var stored = (await Comments().ListAsync(Buyer.Id, _item.Id)).Threads.Single(t => t.Id == comment.Id);
            Assert.Empty(stored.Mentions);
            Assert.Equal("@Anna look at this one! 😍", stored.Body);
        }

        [Fact]
        public async Task Mentionable_SuggestsByPrefix_ExcludingMe()
        {
            Db.AddUser("Anna");
            Db.AddUser("Annabel");
            Db.AddUser("Bence");

            var names = (await Comments().MentionableAsync(Buyer.Id, "@ann")).Select(m => m.Name).ToList();

            Assert.Equal(new[] { "Anna", "Annabel" }, names);
        }

        [Fact]
        public async Task ReportComment_ResolvesThroughExistingReportWorkflow()
        {
            var comment = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("Buy followers at spam.example"));

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Comment, comment.Id, ReportRule.Spam))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Comment, comment.Id, ReportRule.Counterfeit))));
            var report = await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Comment, comment.Id, ReportRule.Spam, "Advertising under my item."));
            Assert.Equal(_item.Id, report.ItemId);
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Comment, comment.Id, ReportRule.Spam, "Advertising under my item."))));

            // Editing after the report doesn't change the evidence.
            await Comments().UpdateAsync(Buyer.Id, _item.Id, comment.Id, new UpdateCommentInput("Nice cap"));
            var detail = await AdminReports().GetAsync(report.Id);
            Assert.Contains("spam.example", detail.Snapshot.GetRawText());
            Assert.Equal(Buyer.Id, detail.TargetOwner.Id);

            await AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.Removed, ReportRule.Spam, "Advertising is not allowed in comments."));
            Assert.True(Db.NewContext().ItemComments.Single().IsRemoved);
            var action = Assert.Single(await Reports().GetAgainstMeAsync(Buyer.Id));
            Assert.Equal(_item.Id, action.ItemId);
        }

        [Fact]
        public async Task DeletedReportedComment_StaysAsTombstone_SoTheReportKeepsItsTarget()
        {
            var comment = await Comments().CreateAsync(Buyer.Id, _item.Id, new CreateCommentInput("Rude words here"));
            await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Comment, comment.Id, ReportRule.Harassment, "Rude words under my item."));

            await Comments().DeleteAsync(Buyer.Id, _item.Id, comment.Id);

            Assert.NotNull(Db.NewContext().ItemComments.Single().DeletedAt);
            Assert.Empty((await Comments().ListAsync(Seller.Id, _item.Id)).Threads);
        }

        [Fact]
        public async Task ReportItem_ByOthersOnly()
        {
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Item, _item.Id, ReportRule.Counterfeit, "Reporting my own item."))));
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Item, _item.Id, ReportRule.Counterfeit, "This is a printed replica."));
            Assert.Equal(Seller.Id, (await AdminReports().GetAsync(report.Id)).TargetOwner.Id);
        }
    }

    [Collection("api")]
    public class CommentApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        [Fact]
        public async Task Comments_RoundTrip_OverHttp()
        {
            var owner = _api.Db.AddUser("owner");
            var visitor = _api.Db.AddUser("visitor");
            var item = _api.Db.AddItem(_api.Db.AddCollection(owner));
            var client = _api.ClientFor(visitor);

            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync($"api/Items/{item.Id}/Comments")).StatusCode);

            var created = await client.PostAsJsonAsync($"api/Items/{item.Id}/Comments", new { body = "@owner what a find 🎉", mentionUserIds = new[] { owner.Id } });
            Assert.Equal(HttpStatusCode.OK, created.StatusCode);
            var comment = await created.Content.ReadFromJsonAsync<CommentDto>();
            Assert.Equal("owner", Assert.Single(comment!.Mentions).Name);

            var reply = await _api.ClientFor(owner).PostAsJsonAsync($"api/Items/{item.Id}/Comments", new { body = "Thanks!", parentId = comment.Id });
            Assert.Contains("\"isOwner\":true", await reply.Content.ReadAsStringAsync());

            var list = await client.GetStringAsync($"api/Items/{item.Id}/Comments");
            Assert.Contains("Thanks!", list);
            Assert.Contains($"\"{item.Id}\":2", await client.GetStringAsync($"api/Comments/Counts?itemIds={item.Id}"));
            Assert.Contains("owner", await client.GetStringAsync("api/Comments/Mentionable?query=ow"));

            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ClientFor(owner).PutAsJsonAsync($"api/Items/{item.Id}/Comments/{comment.Id}", new { body = "hijack" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"api/Items/{item.Id}/Comments/{comment.Id}", new { body = "edited" })).StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"api/Items/{item.Id}/Comments/{comment.Id}")).StatusCode);

            var report = await _api.ClientFor(owner).PostAsJsonAsync("api/Reports", new { targetType = "comment", targetId = Guid.NewGuid(), rule = "spam", reason = "Advertising in comments." });
            Assert.Equal(HttpStatusCode.NotFound, report.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
