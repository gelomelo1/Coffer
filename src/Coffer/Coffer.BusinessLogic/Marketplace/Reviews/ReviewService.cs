using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Reputation;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Reviews
{
    public record ReviewInput(int Stars, ReviewReasonTag? ReasonTag, string? Comment);
    public record TextInput(string Text);

    public record ReviewDto(
        Guid Id,
        Guid DealId,
        string ListingTitle,
        UserSummaryDto? Reviewer,
        UserSummaryDto Reviewee,
        ReviewerRole ReviewerRole,
        int Stars,
        ReviewReasonTag? ReasonTag,
        string? Comment,
        DateTime CreatedAt,
        DateTime? PublishedAt,
        string? Reply,
        DateTime? RepliedAt,
        /// <summary>Reported and waiting for a moderator: shown with a notice, excluded from the average.</summary>
        bool IsFrozen);

    public record DealReviewsDto(ReviewDto? Mine, ReviewDto? Theirs, bool TheyHaveSubmitted, bool CanReview, DateTime? Deadline);

    public record ReputationDto(double? Average, int Count, int CompletedDeals, double? ResponseRate, int? TypicalResponseMinutes);

    public interface IReviewService
    {
        Task<ReviewDto> SubmitAsync(Guid userId, Guid dealId, ReviewInput input);
        Task<DealReviewsDto> GetForDealAsync(Guid userId, Guid dealId);
        Task<ReviewDto> ReplyAsync(Guid userId, Guid reviewId, string text);
        Task<List<ReviewDto>> GetForUserAsync(Guid userId);
        Task<Coffer.Domain.Paging.PagedList<ReviewDto>> GetForUserPageAsync(Guid userId, int? page, int? pageSize);
        Task<ReputationDto> GetReputationAsync(Guid userId);
    }

    /// <summary>
    /// Reviews are unlocked only by a completed (or disputed) deal between exactly these two users, during a 14-day window.
    /// Double-blind: a review stays hidden until the other party also reviews, or the window closes.
    /// </summary>
    public class ReviewService : IReviewService, IMarketplaceSweep
    {
        public const int MinLowRatingComment = 20;
        public const int MaxComment = 1000;
        public const int MaxReply = 500;

        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IDealService _deals;
        private readonly ResponsivenessService _responsiveness;

        public ReviewService(CofferDbContext db, IClock clock, IDealService deals, ResponsivenessService responsiveness)
        {
            _db = db;
            _clock = clock;
            _deals = deals;
            _responsiveness = responsiveness;
        }

        public async Task<ReviewDto> SubmitAsync(Guid userId, Guid dealId, ReviewInput input)
        {
            var deal = await PartyDealAsync(userId, dealId);
            await _deals.GetAsync(userId, dealId); // applies lazy time rules (shipping auto-complete)
            await _db.Entry(deal).ReloadAsync();

            if (deal.Status is not (DealStatus.Completed or DealStatus.Disputed) || deal.ReviewDeadline == null)
                throw MarketplaceException.Conflict("reviewsUnlockWhenTheDealIsCompleted", "Reviews unlock when the deal is completed or closed as disputed.");
            var now = _clock.UtcNow;
            if (now >= deal.ReviewDeadline) throw MarketplaceException.Conflict("the14DayReviewWindowHasClosed", "The 14-day review window has closed.");
            if (await _db.Reviews.AnyAsync(r => r.DealId == dealId && r.ReviewerId == userId))
                throw MarketplaceException.Conflict("youAlreadyReviewedThisDeal", "You already reviewed this deal.");

            if (input.Stars is < 1 or > 5) throw MarketplaceException.Validation("choose1To5Stars", "Choose 1 to 5 stars.");
            if (input.ReasonTag.HasValue && !Enum.IsDefined(input.ReasonTag.Value)) throw MarketplaceException.Validation("unknownReason", "Unknown reason.");
            var comment = Text.Optional(input.Comment, MaxComment, "Comment");
            if (input.Stars <= 2)
            {
                if (input.ReasonTag == null) throw MarketplaceException.Validation("pickAReasonForA12", "Pick a reason for a 1–2 star rating.");
                if (comment == null || comment.Length < MinLowRatingComment)
                    throw MarketplaceException.Validation("explainA12StarRatingIn", $"Explain a 1–2 star rating in at least {MinLowRatingComment} characters.", ErrorArgs.Of($"{MinLowRatingComment}"));
            }

            var isBuyer = deal.BuyerId == userId;
            var review = new Review
            {
                DealId = dealId,
                ReviewerId = userId,
                RevieweeId = isBuyer ? deal.SellerId : deal.BuyerId,
                ReviewerRole = isBuyer ? ReviewerRole.Buyer : ReviewerRole.Seller,
                Stars = input.Stars,
                ReasonTag = input.ReasonTag,
                Comment = comment,
                CreatedAt = now,
            };
            _db.Reviews.Add(review);

            var theirs = await _db.Reviews.FirstOrDefaultAsync(r => r.DealId == dealId && r.ReviewerId != userId);
            if (theirs != null)
            {
                review.PublishedAt = now;
                theirs.PublishedAt ??= now;
            }

            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { throw MarketplaceException.Conflict("youAlreadyReviewedThisDeal", "You already reviewed this deal."); }
            return await ToDtoAsync(review.Id);
        }

        public async Task<DealReviewsDto> GetForDealAsync(Guid userId, Guid dealId)
        {
            var deal = await PartyDealAsync(userId, dealId);
            await _deals.GetAsync(userId, dealId);
            await _db.Entry(deal).ReloadAsync();
            await PublishDueAsync();

            var reviews = await Query().Where(r => r.DealId == dealId).ToListAsync();
            var mine = reviews.FirstOrDefault(r => r.ReviewerId == userId);
            var theirs = reviews.FirstOrDefault(r => r.ReviewerId != userId);
            var canReview = deal.Status is DealStatus.Completed or DealStatus.Disputed && mine == null && _clock.UtcNow < deal.ReviewDeadline;
            return new DealReviewsDto(
                mine == null ? null : ToDto(mine),
                theirs is { PublishedAt: not null, IsRemoved: false } ? ToDto(theirs) : null,
                theirs != null, canReview, deal.ReviewDeadline);
        }

        public async Task<ReviewDto> ReplyAsync(Guid userId, Guid reviewId, string text)
        {
            var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == reviewId && !r.IsRemoved)
                ?? throw MarketplaceException.NotFound("reviewNotFound", "Review not found.");
            if (review.RevieweeId != userId) throw MarketplaceException.Forbidden("onlyTheReviewedPersonCanReply", "Only the reviewed person can reply.");
            await PublishDueAsync();
            if (review.PublishedAt == null) throw MarketplaceException.Conflict("youCanReplyOnceTheReviewIs", "You can reply once the review is published.");
            if (review.Reply != null) throw MarketplaceException.Conflict("youAlreadyRepliedToThisReview", "You already replied to this review.");

            review.Reply = Text.Required(text, 1, MaxReply, "Reply");
            review.RepliedAt = _clock.UtcNow;
            await _db.SaveChangesAsync();
            return await ToDtoAsync(reviewId);
        }

        public async Task<List<ReviewDto>> GetForUserAsync(Guid userId)
        {
            await PublishDueAsync();
            var reviews = await Query()
                .Where(r => r.RevieweeId == userId && r.PublishedAt != null && !r.IsRemoved)
                .OrderByDescending(r => r.PublishedAt)
                .ToListAsync();
            return reviews.Select(ToDto).ToList();
        }

        public async Task<Coffer.Domain.Paging.PagedList<ReviewDto>> GetForUserPageAsync(Guid userId, int? page, int? pageSize)
        {
            await PublishDueAsync();
            var reviews = await Coffer.DataAccess.Extensions.PagingExtensions.ToPagedListAsync(Query()
                .Where(r => r.RevieweeId == userId && r.PublishedAt != null && !r.IsRemoved)
                .OrderByDescending(r => r.PublishedAt).ThenBy(r => r.Id), page, pageSize);
            return new Coffer.Domain.Paging.PagedList<ReviewDto>(reviews.Items.Select(ToDto).ToList(), reviews.Page, reviews.PageSize, reviews.Total);
        }

        public async Task<ReputationDto> GetReputationAsync(Guid userId)
        {
            await PublishDueAsync();
            var stars = await _db.Reviews
                .Where(r => r.RevieweeId == userId && r.PublishedAt != null && !r.IsFrozen && !r.IsRemoved)
                .Select(r => r.Stars).ToListAsync();
            var completed = await _db.Deals.CountAsync(d => d.Status == DealStatus.Completed && (d.SellerId == userId || d.BuyerId == userId));
            var responsiveness = await _responsiveness.GetAsync(userId);
            return new ReputationDto(
                stars.Count == 0 ? null : Math.Round(stars.Average(), 2), stars.Count, completed,
                responsiveness.ResponseRate, responsiveness.TypicalResponseMinutes);
        }

        public Task SweepAsync() => PublishDueAsync();

        /// <summary>
        /// Publishes reviews whose deal's review window has closed, and reviews whose counterpart exists
        /// (covers two simultaneous submits that each missed the other).
        /// </summary>
        public async Task PublishDueAsync()
        {
            var now = _clock.UtcNow;
            var due = await _db.Reviews
                .Where(r => r.PublishedAt == null
                    && (_db.Deals.Any(d => d.Id == r.DealId && d.ReviewDeadline != null && d.ReviewDeadline <= now)
                        || _db.Reviews.Any(o => o.DealId == r.DealId && o.Id != r.Id)))
                .ToListAsync();
            if (due.Count == 0) return;
            foreach (var r in due) r.PublishedAt = now;
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ helpers

        private async Task<Deal> PartyDealAsync(Guid userId, Guid dealId)
        {
            var deal = await _db.Deals.FirstOrDefaultAsync(d => d.Id == dealId) ?? throw MarketplaceException.NotFound("dealNotFound", "Deal not found.");
            if (deal.SellerId != userId && deal.BuyerId != userId)
                throw MarketplaceException.Forbidden("onlyTheBuyerAndTheSellerOf", "Only the buyer and the seller of this deal can review it.");
            return deal;
        }

        private IQueryable<Review> Query() => _db.Reviews.AsNoTracking()
            .Include(r => r.Reviewer).Include(r => r.Reviewee).Include(r => r.Deal).ThenInclude(d => d.Listing);

        private async Task<ReviewDto> ToDtoAsync(Guid reviewId) => ToDto(await Query().FirstAsync(r => r.Id == reviewId));

        private static ReviewDto ToDto(Review r) => new(
            r.Id, r.DealId, r.Deal.Listing.Title,
            r.Reviewer == null ? null : UserSummaryDto.From(r.Reviewer), UserSummaryDto.From(r.Reviewee),
            r.ReviewerRole, r.Stars, r.ReasonTag, r.Comment, r.CreatedAt, r.PublishedAt, r.Reply, r.RepliedAt, r.IsFrozen);
    }
}
