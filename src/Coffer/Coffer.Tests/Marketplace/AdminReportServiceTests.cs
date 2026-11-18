using System.Net;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Community;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.BusinessLogic.Moderation;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Marketplace
{
    public class AdminReportServiceTests : ReportTestBase
    {
        private static ResolveReportInput Remove(ReportRule rule = ReportRule.ScamOrFraud, int? hours = null) =>
            new(ReportDecision.Removed, rule, "Breaks the scam and fraud rule.", hours);

        private (CollectionProvided Collection, ItemProvided Item) SellerItem()
        {
            var collection = Db.AddCollection(Seller);
            return (collection, Db.AddItem(collection));
        }

        [Fact]
        public async Task List_FiltersByStatusAndType_GetIncludesSnapshotAndState()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            var (_, message) = await BuyerMessage();
            await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Message, message.Id, ReportRule.Harassment));

            Assert.Equal(2, (await AdminReports().ListAsync(ReportStatus.Open, null)).Total);
            Assert.Single((await AdminReports().ListAsync(null, ReportTargetType.Message)).Items);
            Assert.Empty((await AdminReports().ListAsync(ReportStatus.Resolved, null)).Items);

            var detail = await AdminReports().GetAsync(report.Id);
            Assert.Equal(Buyer.Id, detail.Reporter.Id);
            Assert.Equal(Seller.Id, detail.TargetOwner.Id);
            Assert.Contains(listing.Title, detail.Snapshot.ToString());
            Assert.Contains("active", detail.CurrentState.ToString());
        }

        [Fact]
        public async Task ReportedContent_GroupsReportsByTarget_WithCountsReasonsReportersAndStatuses()
        {
            var (_, item) = SellerItem();
            var lonely = AddListing(Seller);
            var reporters = new[] { Buyer, Db.AddUser("r2"), Db.AddUser("r3") };
            await Reports().CreateAsync(reporters[0].Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.Counterfeit, "This cap is a printed replica."));
            await Reports().CreateAsync(reporters[1].Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.Counterfeit, "Replica, the print is blurry."));
            await Reports().CreateAsync(reporters[2].Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.OffTopic, "This is not a bottle cap at all."));
            Clock.Advance(TimeSpan.FromMinutes(5));
            await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, lonely.Id));

            var page = await AdminReports().ListContentAsync(ReportStatus.Open, null);

            Assert.Equal(2, page.Total);
            var top = page.Items[0];
            Assert.Equal(ReportTargetType.Item, top.TargetType);
            Assert.Equal(item.Id, top.TargetId);
            Assert.Equal(3, top.ReportCount);
            Assert.Equal(3, top.OpenCount);
            Assert.Equal(new[] { ReportRule.Counterfeit, ReportRule.OffTopic }, top.Rules.OrderBy(r => r).ToArray());
            Assert.Equal(3, top.Reporters.Count);
            Assert.Equal(3, top.Statuses["open"]);
            Assert.Equal(Seller.Id, top.Owner.Id);
            Assert.Equal("item", top.Thumbnail!.Kind);
            Assert.Equal(1, page.Items[1].ReportCount);

            var detail = await AdminReports().GetContentAsync(ReportTargetType.Item, item.Id);
            Assert.Equal(3, detail.Reports.Count);
            Assert.All(detail.Reports, r => Assert.Equal(item.Id, r.TargetId));
            Assert.Contains("\"exists\":true", detail.CurrentState.GetRawText());
        }

        [Fact]
        public async Task BulkResolve_AppliesSameStatementToEveryReport_AndIsAudited()
        {
            var (_, item) = SellerItem();
            var a = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.OffTopic, "Not a collectible at all."));
            var b = await Reports().CreateAsync(Db.AddUser("r2").Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.OffTopic, "This photo is a selfie."));
            var listing = AddListing(Seller);
            var c = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id, ReportRule.Spam, "Posted ten times today."));

            var result = await AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(new List<Guid> { a.Id, b.Id, c.Id },
                ReportDecision.NoViolation, null, "Checked: the content follows the rules."));

            Assert.Equal(3, result.ResolvedCount);
            var ctx = Db.NewContext();
            Assert.All(ctx.Reports.ToList(), r =>
            {
                Assert.Equal(ReportStatus.Resolved, r.Status);
                Assert.Equal(ReportDecision.NoViolation, r.Decision);
                Assert.Equal("Checked: the content follows the rules.", r.Statement);
                Assert.Equal(Admin.Id, r.ResolvedBy);
            });
            Assert.Single(ctx.AdminAuditLog.Where(x => x.Action == "reports.resolve"));
            Assert.Empty(ctx.ModerationActions);
            Assert.True(ctx.Items.Any(i => i.Id == item.Id));
        }

        [Fact]
        public async Task BulkResolve_RequiresExplanation_AndOpenReports_AndIsAllOrNothing()
        {
            var listing = AddListing(Seller);
            var a = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            var b = await Reports().CreateAsync(Db.AddUser("r2").Id, ReportOf(ReportTargetType.Listing, listing.Id));
            var ids = new List<Guid> { a.Id, b.Id };

            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(ids, ReportDecision.NoViolation, null, "  "))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(new List<Guid>(), ReportDecision.NoViolation, null, "Fine content here."))));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(new List<Guid> { a.Id, Guid.NewGuid() }, ReportDecision.NoViolation, null, "Fine content here."))));

            await AdminReports().ResolveAsync(Admin.Id, a.Id, new ResolveReportInput(ReportDecision.NoViolation, null, "Fine content here."));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(ids, ReportDecision.NoViolation, null, "Fine content here."))));
            Assert.Equal(ReportStatus.Open, Db.NewContext().Reports.Single(r => r.Id == b.Id).Status);
        }

        [Fact]
        public async Task ResolveTarget_RemovesListingOnce_AndClosesEveryOpenReport()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            await Reports().CreateAsync(Db.AddUser("other").Id, ReportOf(ReportTargetType.Listing, deal.ListingId));
            await Reports().CreateAsync(Db.AddUser("third").Id, ReportOf(ReportTargetType.Listing, deal.ListingId));

            var result = await AdminReports().ResolveTargetAsync(Admin.Id, ReportTargetType.Listing, deal.ListingId,
                new ResolveTargetInput(ReportDecision.Removed, ReportRule.Counterfeit, "Replicas sold as originals."));

            Assert.Equal(2, result.ResolvedCount);
            Assert.Equal(1, result.RemovedTargets);
            var ctx = Db.NewContext();
            Assert.Equal(ListingStatus.Removed, ctx.Listings.Single(l => l.Id == deal.ListingId).Status);
            Assert.Equal(DealStatus.Cancelled, ctx.Deals.Single().Status);
            var action = Assert.Single(ctx.ModerationActions);
            Assert.Equal(Seller.Id, action.UserId);
            Assert.Equal(ReportRule.Counterfeit, action.Rule);
            Assert.All(ctx.Reports.ToList(), r => Assert.Equal(ReportStatus.Resolved, r.Status));
        }

        [Fact]
        public async Task Remove_SingleReport_AlsoAnswersOtherOpenReportsOnSameContent()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            var duplicate = await Reports().CreateAsync(Db.AddUser("third").Id, ReportOf(ReportTargetType.Listing, listing.Id));

            await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove(ReportRule.Counterfeit));

            Assert.Equal(ReportStatus.Resolved, Db.NewContext().Reports.Single(r => r.Id == duplicate.Id).Status);
        }

        [Fact]
        public async Task SuspendItemOwner_ThroughItemReport_KeepsItem_AndNotifiesOwner()
        {
            var (_, item) = SellerItem();
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.Other, "Owner keeps posting insults in the descriptions."));

            var result = await AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(new List<Guid> { report.Id },
                ReportDecision.Suspended, ReportRule.Other, "Repeated insults in item descriptions.", 72));

            var applied = Assert.Single(result.Suspensions);
            Assert.Equal(Seller.Id, applied.UserId);
            Assert.True(applied.New);
            var ctx = Db.NewContext();
            var suspension = ctx.UserSuspensions.Single();
            Assert.Equal(Seller.Id, suspension.UserId);
            Assert.Equal("Repeated insults in item descriptions.", suspension.Reason);
            Assert.Equal(Clock.UtcNow.AddHours(72), suspension.EndsAt);
            Assert.Equal(report.Id, suspension.SourceReportId);
            Assert.Equal(suspension.Id, ctx.Reports.Single().SuspensionId);
            Assert.True(ctx.Items.Any(i => i.Id == item.Id));
            Assert.NotNull(await Suspensions().GetActiveAsync(Seller.Id));
            Assert.Contains("suspended until", Assert.Single(await Reports().GetAgainstMeAsync(Seller.Id)).Statement);
        }

        [Fact]
        public async Task SuspendCommentAuthor_AndRemoveComment()
        {
            var (_, item) = SellerItem();
            var comment = await Comments().CreateAsync(Buyer.Id, item.Id, new CreateCommentInput("You are an idiot, this cap is junk"));
            var report = await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Comment, comment.Id, ReportRule.Harassment, "Insulting me under my own item."));

            await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove(ReportRule.Harassment, 24));

            var ctx = Db.NewContext();
            Assert.True(ctx.ItemComments.Single().IsRemoved);
            Assert.Equal(Buyer.Id, ctx.UserSuspensions.Single().UserId);
            var page = await Comments().ListAsync(Seller.Id, item.Id);
            Assert.Empty(page.Threads);
        }

        [Fact]
        public async Task SameOwner_InSeveralReports_IsSuspendedOnlyOnce()
        {
            var (_, item) = SellerItem();
            var listing = AddListing(Seller);
            var a = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.Counterfeit, "Printed replica shown as real."));
            var b = await Reports().CreateAsync(Db.AddUser("r2").Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.Counterfeit, "Fake, same as the listing."));
            var c = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id, ReportRule.Counterfeit, "Selling replicas as originals."));

            var result = await AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(new List<Guid> { a.Id, b.Id, c.Id },
                ReportDecision.Suspended, ReportRule.Counterfeit, "Replicas presented as originals.", 48));

            Assert.Single(result.Suspensions);
            Assert.Single(Db.NewContext().UserSuspensions);

            // A later decision with a shorter suspension doesn't stack another one on top.
            var d = await Reports().CreateAsync(Db.AddUser("r4").Id, ReportOf(ReportTargetType.Listing, listing.Id, ReportRule.Counterfeit, "Still selling replicas."));
            var again = await AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(new List<Guid> { d.Id }, ReportDecision.Suspended, ReportRule.Counterfeit, "Replicas presented as originals.", 24));
            Assert.False(Assert.Single(again.Suspensions).New);
            Assert.Single(Db.NewContext().UserSuspensions);
        }

        [Fact]
        public async Task Suspension_NeedsDuration_AndNoViolationCantSuspend()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            var ids = new List<Guid> { report.Id };

            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(ids, ReportDecision.Suspended, null, "Scam listing again."))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(ids, ReportDecision.NoViolation, null, "Nothing wrong here.", 24))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveManyAsync(Admin.Id, new ResolveReportsInput(ids, ReportDecision.Suspended, null, "Scam listing again.", 0))));
        }

        [Fact]
        public async Task RemoveItem_DeletesItemAndEmbedding()
        {
            var (_, item) = SellerItem();
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Item, item.Id, ReportRule.IllegalItem, "This shows a real weapon."));

            await AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.Removed, ReportRule.IllegalItem, "Weapons are not allowed on Coffer."));

            Assert.False(Db.NewContext().Items.Any(i => i.Id == item.Id));
            Assert.Contains(Python.Calls, c => c.Method == HttpMethod.Delete && c.Path == $"/delete_embeddings/{item.Id}");
            var detail = await AdminReports().GetAsync(report.Id);
            Assert.Contains("\"exists\":false", detail.CurrentState.GetRawText());
            Assert.Contains(item.Image, detail.Snapshot.GetRawText());
        }

        [Fact]
        public async Task RemovedListing_NotSearchable_NotEditable_NotReactivatable()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove());

            Assert.Empty(await Listings().SearchAsync(Buyer.Id, new ListingQuery()));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Listings().GetAsync(Buyer.Id, listing.Id)));
            Assert.Equal(ListingStatus.Removed, (await Listings().GetAsync(Seller.Id, listing.Id)).Status);
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Listings().ReactivateAsync(Seller.Id, listing.Id)));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Listings().ArchiveAsync(Seller.Id, listing.Id)));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Conversations().OpenAsync(Db.AddUser("late").Id, "listing", listing.Id)));
        }

        [Fact]
        public async Task RemovedMessage_IsMasked()
        {
            var (conversationId, message) = await BuyerMessage();
            var report = await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Message, message.Id, ReportRule.ScamOrFraud));

            await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove());

            var seen = (await Conversations().GetMessagesAsync(Seller.Id, conversationId, null)).Single(m => m.Id == message.Id);
            Assert.DoesNotContain("bank password", seen.Body);
            Assert.True(seen.IsRemoved);
            var action = Assert.Single(await Reports().GetAgainstMeAsync(Buyer.Id));
            Assert.Equal(conversationId, action.ConversationId);
            Assert.Contains("bank password", action.ContentExcerpt); // the author may see what was removed
        }

        [Fact]
        public async Task Remove_Review_HidesAndUnfreezes()
        {
            var bad = await PublishedBadReviewOfSeller();
            var report = await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Review, bad.Id, ReportRule.FakeReview));

            await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove(ReportRule.FakeReview));

            var stored = Db.NewContext().Reviews.Single(r => r.Id == bad.Id);
            Assert.True(stored.IsRemoved);
            Assert.False(stored.IsFrozen);
            Assert.DoesNotContain(await Reviews().GetForUserAsync(Seller.Id), r => r.Id == bad.Id);
            Assert.Single(await Reports().GetAgainstMeAsync(Buyer.Id));
        }

        [Fact]
        public async Task NoViolation_UnfreezesReview_NoAction()
        {
            var bad = await PublishedBadReviewOfSeller();
            var report = await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Review, bad.Id, ReportRule.FakeReview));

            await AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.NoViolation, null, "The review describes this deal."));

            Assert.False(Db.NewContext().Reviews.Single(r => r.Id == bad.Id).IsFrozen);
            Assert.Equal(1, (await Reviews().GetReputationAsync(Seller.Id)).Average);
            Assert.Empty(Db.NewContext().ModerationActions);
        }

        [Fact]
        public async Task Resolve_Twice_Conflicts_AndExplanationIsRequired()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));

            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.Removed, ReportRule.Spam, "short"))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.NoViolation, null, null))));
            await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove());
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => AdminReports().ResolveAsync(Admin.Id, report.Id, Remove())));
        }
    }

    /// <summary>Fake GitHub for Manager sign-in tests: the next poll returns <see cref="Next"/>.</summary>
    public sealed class FakeGithubDeviceFlow : IGithubDeviceFlowClient
    {
        public GithubDevicePoll Next { get; set; } = new(GithubDevicePollStatus.Pending);
        public GithubIdentity Identity { get; set; } = new("1001", "octo-admin");

        public Task<GithubDeviceCode> StartAsync(CancellationToken ct = default) =>
            Task.FromResult(new GithubDeviceCode("device-123", "ABCD-1234", "https://github.com/login/device", 900, 5));

        public Task<GithubDevicePoll> PollAsync(string deviceCode, CancellationToken ct = default) => Task.FromResult(Next);

        public Task<GithubIdentity> GetUserAsync(string accessToken, CancellationToken ct = default) => Task.FromResult(Identity);
    }

    [Collection("api")]
    public class AdminReportApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        public AdminReportApiTests()
        {
            _api.Overrides = services =>
            {
                services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
            };
        }

        [Fact]
        public async Task AdminEndpoints_RejectAnonymousAndUserTokens_EvenAdminRoleUsers()
        {
            var roleAdmin = _api.Db.AddUser("legacy-admin", UserRole.Admin);
            var endpoints = new[] { "api/Admin/Reports", "api/Admin/ReportedContent", "api/Admin/Suspensions", "api/Admin/Users", "api/Admin/Reports/Rules" };

            foreach (var url in endpoints)
            {
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync(url)).StatusCode);
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(roleAdmin).GetAsync(url)).StatusCode);
            }
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(roleAdmin).PostAsJsonAsync("api/Admin/Reports/Resolve",
                new { reportIds = new[] { Guid.NewGuid() }, decision = "removed", rule = "spam", statement = "Spam listing everywhere." })).StatusCode);
        }

        [Fact]
        public async Task ManagerAdmin_CanUseEndpoints_ButNotOnceRemovedFromConfig()
        {
            var admin = _api.Db.AddManagerAdmin("1001");
            var former = _api.Db.AddManagerAdmin("2002", "former");

            var client = _api.ManagerClientFor(admin);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("api/Admin/Reports?status=open&targetType=listing")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("api/Admin/ReportedContent?status=open")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("api/Admin/Suspensions?status=active")).StatusCode);
            Assert.Contains("fake_review", await client.GetStringAsync("api/Admin/Reports/Rules"));

            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ManagerClientFor(former).GetAsync("api/Admin/Reports")).StatusCode);
        }

        [Fact]
        public async Task ManagerToken_IsNotAUserToken()
        {
            var admin = _api.Db.AddManagerAdmin("1001");
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ManagerClientFor(admin).GetAsync("api/Reports/Mine")).StatusCode);
        }

        [Fact]
        public async Task UserReportEndpoints_RoundTrip()
        {
            var user = _api.Db.AddUser("user");
            var client = _api.ClientFor(user);
            Assert.Contains("fake_review", await client.GetStringAsync("api/Reports/Rules"));
            Assert.Equal("{\"items\":[],\"page\":1,\"pageSize\":20,\"total\":0}", await client.GetStringAsync("api/Reports/Mine"));
            Assert.Equal("{\"items\":[],\"page\":1,\"pageSize\":20,\"total\":0}", await client.GetStringAsync("api/Moderation/AgainstMe"));
            Assert.Contains("\"count\":0", await client.GetStringAsync("api/Moderation/AgainstMe/UnseenCount"));
            var bad = await client.PostAsJsonAsync("api/Reports", new { targetType = "listing", targetId = Guid.NewGuid(), rule = "spam", reason = "Spam listing everywhere." });
            Assert.Equal(HttpStatusCode.NotFound, bad.StatusCode);
        }

        [Fact]
        public async Task BulkResolve_OverHttp_ResolvesGroupedContent()
        {
            var admin = _api.Db.AddManagerAdmin("1001");
            var owner = _api.Db.AddUser("owner");
            var item = _api.Db.AddItem(_api.Db.AddCollection(owner));
            var r1 = _api.Db.AddUser("r1");
            var r2 = _api.Db.AddUser("r2");
            foreach (var reporter in new[] { r1, r2 })
            {
                var created = await _api.ClientFor(reporter).PostAsJsonAsync("api/Reports",
                    new { targetType = "item", targetId = item.Id, rule = "off_topic", reason = "This is not a collectible item." });
                Assert.Equal(HttpStatusCode.OK, created.StatusCode);
            }

            var client = _api.ManagerClientFor(admin);
            var groups = await client.GetStringAsync("api/Admin/ReportedContent?status=open");
            Assert.Contains("\"reportCount\":2", groups);

            var resolved = await client.PostAsJsonAsync($"api/Admin/ReportedContent/item/{item.Id}/Resolve",
                new { decision = "no_violation", statement = "It is a cap collection photo." });
            Assert.Equal(HttpStatusCode.OK, resolved.StatusCode);
            Assert.Contains("\"resolvedCount\":2", await resolved.Content.ReadAsStringAsync());
            Assert.Contains("It is a cap collection photo.", await _api.ClientFor(r1).GetStringAsync("api/Reports/Mine"));
        }

        public void Dispose() => _api.Dispose();
    }
}
