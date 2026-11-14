using System.Net;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.Domain.Constants;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    public class AdminReportServiceTests : ReportTestBase
    {
        private static ResolveReportInput Remove(ReportRule rule = ReportRule.ScamOrFraud) =>
            new(ReportDecision.Removed, rule, "Breaks the scam and fraud rule.");

        [Fact]
        public async Task NonAdmin_Forbidden_EvenModerator()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            var moderator = Db.AddUser("mod", UserRole.Moderator);

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => AdminReports().ListAsync(moderator.Id, null, null)));
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => AdminReports().GetAsync(Buyer.Id, report.Id)));
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => AdminReports().ResolveAsync(moderator.Id, report.Id, Remove())));
        }

        [Fact]
        public async Task List_FiltersByStatusAndType_GetIncludesSnapshotAndState()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            var (_, message) = await BuyerMessage();
            await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Message, message.Id, ReportRule.Harassment));

            Assert.Equal(2, (await AdminReports().ListAsync(Admin.Id, ReportStatus.Open, null)).Count);
            Assert.Single(await AdminReports().ListAsync(Admin.Id, null, ReportTargetType.Message));
            Assert.Empty(await AdminReports().ListAsync(Admin.Id, ReportStatus.Resolved, null));

            var detail = await AdminReports().GetAsync(Admin.Id, report.Id);
            Assert.Equal(Buyer.Id, detail.Reporter.Id);
            Assert.Equal(Seller.Id, detail.TargetOwner.Id);
            Assert.Contains(listing.Title, detail.Snapshot.ToString());
            Assert.Contains("active", detail.CurrentState.ToString());
        }

        [Fact]
        public async Task Remove_Listing_SetsRemoved_CancelsPreShipmentDeal_CreatesAction_ClosesDuplicates()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            var other = Db.AddUser("other");
            var report = await Reports().CreateAsync(other.Id, ReportOf(ReportTargetType.Listing, deal.ListingId));
            var duplicate = await Reports().CreateAsync(Db.AddUser("third").Id, ReportOf(ReportTargetType.Listing, deal.ListingId));

            var resolved = await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove(ReportRule.Counterfeit));

            Assert.Equal(ReportStatus.Resolved, resolved.Status);
            var ctx = Db.NewContext();
            Assert.Equal(ListingStatus.Removed, ctx.Listings.Single(l => l.Id == deal.ListingId).Status);
            Assert.Equal(DealStatus.Cancelled, ctx.Deals.Single().Status);
            var action = Assert.Single(ctx.ModerationActions);
            Assert.Equal(Seller.Id, action.UserId);
            Assert.Equal(ReportRule.Counterfeit, action.Rule);
            Assert.Equal(ReportStatus.Resolved, ctx.Reports.Single(r => r.Id == duplicate.Id).Status);
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

            await AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.NoViolation, null, null));

            Assert.False(Db.NewContext().Reviews.Single(r => r.Id == bad.Id).IsFrozen);
            Assert.Equal(1, (await Reviews().GetReputationAsync(Seller.Id)).Average);
            Assert.Empty(Db.NewContext().ModerationActions);
        }

        [Fact]
        public async Task Resolve_Twice_Conflicts_AndRemoveRequiresStatement()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));

            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.Removed, ReportRule.Spam, "short"))));
            await AdminReports().ResolveAsync(Admin.Id, report.Id, Remove());
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => AdminReports().ResolveAsync(Admin.Id, report.Id, Remove())));
        }
    }

    [Collection("api")]
    public class AdminReportApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        [Fact]
        public async Task AdminEndpoints_OnlyForAdmins()
        {
            var admin = _api.Db.AddUser("admin", UserRole.Admin);
            var moderator = _api.Db.AddUser("mod", UserRole.Moderator);

            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync("api/Admin/Reports")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ClientFor(moderator).GetAsync("api/Admin/Reports")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await _api.ClientFor(admin).GetAsync("api/Admin/Reports?status=open&targetType=listing")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ClientFor(moderator).PostAsJsonAsync($"api/Admin/Reports/{Guid.NewGuid()}/Resolve",
                new { decision = "removed", rule = "spam", statement = "Spam listing everywhere." })).StatusCode);
        }

        [Fact]
        public async Task UserReportEndpoints_RoundTrip()
        {
            var user = _api.Db.AddUser("user");
            var client = _api.ClientFor(user);
            Assert.Contains("fake_review", await client.GetStringAsync("api/Reports/Rules"));
            Assert.Equal("[]", await client.GetStringAsync("api/Reports/Mine"));
            Assert.Equal("[]", await client.GetStringAsync("api/Moderation/AgainstMe"));
            Assert.Contains("\"count\":0", await client.GetStringAsync("api/Moderation/AgainstMe/UnseenCount"));
            var bad = await client.PostAsJsonAsync("api/Reports", new { targetType = "listing", targetId = Guid.NewGuid(), rule = "spam", reason = "Spam listing everywhere." });
            Assert.Equal(HttpStatusCode.NotFound, bad.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
