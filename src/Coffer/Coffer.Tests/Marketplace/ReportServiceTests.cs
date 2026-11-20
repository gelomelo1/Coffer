using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.BusinessLogic.Marketplace.Reputation;
using Coffer.BusinessLogic.Marketplace.Reviews;
using Coffer.BusinessLogic.Services;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    /// <summary>Shared helpers for user-side and admin-side report tests.</summary>
    public abstract class ReportTestBase : DealTestBase
    {
        /// <summary>The Coffer.Manager admin identity that resolves reports.</summary>
        protected readonly Coffer.Domain.Moderation.ManagerAdmin Admin;
        protected readonly FakePythonHandler Python = new();
        private readonly Microsoft.Extensions.Caching.Memory.MemoryCache _cache = new(new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions());

        protected ReportTestBase()
        {
            Admin = Db.AddManagerAdmin();
        }

        protected ReportService Reports() => new(Db.Context, Clock, new ReportSnapshotBuilder(Db.Context, Conversations()));
        protected Coffer.BusinessLogic.Moderation.SuspensionService Suspensions() => new(Db.Context, Clock, _cache);
        protected Coffer.BusinessLogic.Account.ContentTombstoneService Tombstones() => new(Db.Context, new ImageService(), new HttpClient(Python, false),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<Coffer.BusinessLogic.Account.ContentTombstoneService>.Instance);
        protected Coffer.BusinessLogic.Community.ItemRemovalService ItemRemoval() => new(Db.Context, Tombstones(), new ImageService());
        protected AdminReportService AdminReports() => new(Db.Context, Clock, Conversations(), Suspensions(), ItemRemoval());
        protected Coffer.BusinessLogic.Community.ItemCommentService Comments() => new(Db.Context, Clock);
        protected ReviewService Reviews() => new(Db.Context, Clock, Sut(), new ResponsivenessService(Db.Context, Clock));
        protected ListingService Listings() => new(Db.Context, Clock, new ImageService(), new MarketplaceStorage(Folder, Folder));

        protected static CreateReportInput ReportOf(ReportTargetType type, Guid id, ReportRule rule = ReportRule.ScamOrFraud,
            string reason = "This looks like a scam to me.") => new(type, id, rule, reason);

        /// <summary>Completed deal where Buyer gave Seller a published 1-star review.</summary>
        protected async Task<ReviewDto> PublishedBadReviewOfSeller()
        {
            var deal = await CompletedPickupDeal();
            var bad = await Reviews().SubmitAsync(Buyer.Id, deal.Id, new ReviewInput(1, ReviewReasonTag.ItemNotAsDescribed, "The coins were replicas, not originals."));
            await Reviews().SubmitAsync(Seller.Id, deal.Id, new ReviewInput(5, null, null));
            return bad;
        }

        protected async Task<(Guid conversationId, MessageDto message)> BuyerMessage(string body = "Send me your bank password please")
        {
            var (_, conversationId) = await Chat();
            var message = await Conversations().PostAsync(Buyer.Id, conversationId, new PostMessageInput(MessageKind.Text, body, null, null, null));
            return (conversationId, message);
        }
    }

    public class ReportServiceTests : ReportTestBase
    {
        [Fact]
        public async Task ReportListing_ByNonOwner_CreatesOpenReportWithSnapshot()
        {
            var listing = AddListing(Seller);

            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));

            Assert.Equal(ReportStatus.Open, report.Status);
            Assert.Equal(listing.Id, report.ListingId);
            var stored = Db.NewContext().Reports.Single();
            Assert.Equal(Seller.Id, stored.TargetOwnerId);
            Assert.Contains(listing.Title, stored.Snapshot);
        }

        [Fact]
        public async Task ReportListing_ByOwner_Forbidden()
        {
            var listing = AddListing(Seller);
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Listing, listing.Id))));
        }

        [Fact]
        public async Task ReportMessage_OnlyParticipant_NotOwnOrSystem()
        {
            var (conversationId, message) = await BuyerMessage();
            await Conversations().PostSystemAsync(conversationId, "listingSold", "system line");
            var system = (await Conversations().GetTranscriptAsync(conversationId)).Single(m => m.Kind == MessageKind.System);

            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Reports().CreateAsync(Db.AddUser("stranger").Id, ReportOf(ReportTargetType.Message, message.Id))));
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Message, message.Id))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Message, system.Id))));

            var report = await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Message, message.Id, ReportRule.ScamOrFraud));
            Assert.Equal(conversationId, report.ConversationId);
            Assert.Contains("bank password", Db.NewContext().Reports.Single().Snapshot);
        }

        [Fact]
        public async Task ReportReview_OnlyReviewee_FreezesReview_ExcludedFromAverage()
        {
            var bad = await PublishedBadReviewOfSeller();
            Assert.Equal(1, (await Reviews().GetReputationAsync(Seller.Id)).Average);

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Review, bad.Id, ReportRule.FakeReview))));
            await Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Review, bad.Id, ReportRule.FakeReview, "They are originals, see the chat photos."));

            Assert.True(Db.NewContext().Reviews.Single(r => r.Id == bad.Id).IsFrozen);
            Assert.Null((await Reviews().GetReputationAsync(Seller.Id)).Average);
        }

        [Fact]
        public async Task ReportReview_Unpublished_Conflicts()
        {
            var deal = await CompletedPickupDeal();
            var review = await Reviews().SubmitAsync(Buyer.Id, deal.Id, new ReviewInput(5, null, null));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reports().CreateAsync(Seller.Id, ReportOf(ReportTargetType.Review, review.Id, ReportRule.FakeReview))));
        }

        [Fact]
        public async Task Report_DuplicateOpen_Conflicts()
        {
            var listing = AddListing(Seller);
            await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id))));
            // someone else may still report it
            await Reports().CreateAsync(Db.AddUser("other").Id, ReportOf(ReportTargetType.Listing, listing.Id));
        }

        [Fact]
        public async Task Report_ReasonTooShortOrUnknownTarget_Validation()
        {
            var listing = AddListing(Seller);
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id, reason: "short"))));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, Guid.NewGuid()))));
        }

        [Fact]
        public async Task Mine_ShowsOutcomeAndStatement()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id, ReportRule.Counterfeit));
            await AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.Removed, ReportRule.Counterfeit, "Replica items sold as originals."));

            var mine = Assert.Single(await Reports().GetMineAsync(Buyer.Id));
            Assert.Equal(ReportStatus.Resolved, mine.Status);
            Assert.Equal(ReportDecision.Removed, mine.Decision);
            Assert.Equal("Replica items sold as originals.", mine.Statement);
            Assert.Equal(listing.Title, mine.TargetSummary);
            Assert.Empty(await Reports().GetMineAsync(Seller.Id));
        }

        [Fact]
        public async Task AgainstMe_DoesNotRevealReporter_AndTracksSeen()
        {
            var listing = AddListing(Seller);
            var report = await Reports().CreateAsync(Buyer.Id, ReportOf(ReportTargetType.Listing, listing.Id, ReportRule.Counterfeit));
            await AdminReports().ResolveAsync(Admin.Id, report.Id, new ResolveReportInput(ReportDecision.Removed, ReportRule.Counterfeit, "Replica items sold as originals."));

            var actions = await Reports().GetAgainstMeAsync(Seller.Id);
            var action = Assert.Single(actions);
            Assert.Equal(ReportRule.Counterfeit, action.Rule);
            Assert.Equal(listing.Title, action.ContentExcerpt);
            Assert.False(action.Seen);
            var json = JsonSerializer.Serialize(actions);
            Assert.DoesNotContain(Buyer.Id.ToString(), json);
            Assert.DoesNotContain(Buyer.Name, json);
            Assert.DoesNotContain(report.Id.ToString(), json);

            Assert.Equal(1, await Reports().CountUnseenAgainstMeAsync(Seller.Id));
            await Reports().MarkAgainstMeSeenAsync(Seller.Id);
            Assert.Equal(0, await Reports().CountUnseenAgainstMeAsync(Seller.Id));
            Assert.Empty(await Reports().GetAgainstMeAsync(Buyer.Id));
        }

        [Fact]
        public void Rules_AreListedWithLabels()
        {
            var rules = Reports().GetRules();
            Assert.Equal(Enum.GetValues<ReportRule>().Length, rules.Count);
            Assert.All(rules, r => Assert.False(string.IsNullOrWhiteSpace(r.Label)));
            Assert.Contains(rules, r => r.Rule == ReportRule.FakeReview && r.AppliesTo.SequenceEqual(new[] { ReportTargetType.Review }));
        }
    }
}
