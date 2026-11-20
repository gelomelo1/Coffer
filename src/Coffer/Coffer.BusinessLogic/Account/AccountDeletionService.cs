using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Moderation;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Account
{
    /// <summary>
    /// A trade that keeps the account from being deleted until it ends. <see cref="CanCancel"/>: not shipped yet, so
    /// either side may cancel it now. <see cref="EndsLatestAt"/>: shipped, so it completes by itself at the latest at
    /// this time (earlier when the buyer confirms receipt or disputes).
    /// </summary>
    public sealed record BlockingDealDto(Guid DealId, Guid ConversationId, string ListingTitle, UserSummaryDto Other, DealStatus Status,
        bool CanCancel, DateTime? EndsLatestAt);

    public sealed record AccountDeletionStatusDto(bool CanDelete, List<BlockingDealDto> BlockingDeals);

    public interface IAccountDeletionService
    {
        Task<AccountDeletionStatusDto> GetDeletionStatusAsync(Guid userId);

        /// <summary>
        /// Deletes the account: personal data wiped, collections / items / listings tombstoned, comments emptied,
        /// own follows and reactions removed. Chats, deals, reviews, reports, suspensions and the admin log stay.
        /// Refused (409 accountHasOpenTrades) while a trade is still running.
        /// </summary>
        Task DeleteAccountAsync(Guid userId);
    }

    public sealed class AccountDeletionService : IAccountDeletionService
    {
        public static readonly DealStatus[] OpenStatuses = { DealStatus.Proposed, DealStatus.AwaitingHandoff, DealStatus.AwaitingShipment, DealStatus.Shipped };

        private readonly CofferDbContext _db;
        private readonly IContentTombstoneService _tombstones;
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;
        private readonly ISuspensionService _suspensions;
        private readonly IDeletedAccounts _deleted;

        public AccountDeletionService(CofferDbContext db, IContentTombstoneService tombstones, IImageService images, MarketplaceStorage storage,
            ISuspensionService suspensions, IDeletedAccounts deleted)
        {
            _db = db;
            _tombstones = tombstones;
            _images = images;
            _storage = storage;
            _suspensions = suspensions;
            _deleted = deleted;
        }

        public async Task<AccountDeletionStatusDto> GetDeletionStatusAsync(Guid userId)
        {
            var deals = await BlockingDealsAsync(userId);
            return new AccountDeletionStatusDto(deals.Count == 0, deals);
        }

        private async Task<List<BlockingDealDto>> BlockingDealsAsync(Guid userId)
        {
            var deals = await _db.Deals.AsNoTracking()
                .Include(d => d.Listing).Include(d => d.Seller).Include(d => d.Buyer)
                .Where(d => (d.SellerId == userId || d.BuyerId == userId) && OpenStatuses.Contains(d.Status))
                .ToListAsync();
            return deals
                .OrderBy(d => d.CreatedAt)
                .Select(d => new BlockingDealDto(d.Id, d.ConversationId, d.Listing.Title,
                    UserSummaryDto.From(d.SellerId == userId ? d.Buyer : d.Seller), d.Status,
                    d.Status != DealStatus.Shipped,
                    d.Status == DealStatus.Shipped && d.ShippedAt.HasValue ? d.ShippedAt.Value + DealService.AutoCompleteAfter : null))
                .ToList();
        }

        public async Task DeleteAccountAsync(Guid userId)
        {
            var cleanup = new TombstoneCleanup();
            var listingFiles = new List<string>();

            await using (var tx = await _db.Database.BeginTransactionAsync())
            {
                // Checked inside the transaction, so a trade that moves on meanwhile can't slip through.
                if ((await BlockingDealsAsync(userId)).Count > 0)
                    throw MarketplaceException.Conflict("accountHasOpenTrades", "Finish or cancel your open trades before deleting your account.");

                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null)
                    ?? throw MarketplaceException.NotFound("userDeleted", "This account was deleted.");
                var now = DateTime.UtcNow;
                var tag = $"deleted-{userId:N}";

                // Personal data. The placeholders are unique and never shown (the app shows "Deleted user"); a new
                // sign-in with the same Google / GitHub account creates a fresh user.
                user.Name = tag;
                user.Email = $"{tag}@deleted.invalid";
                user.ProviderUserId = tag;
                user.Avatar = null;
                user.Summary = null;
                user.Country = "";
                user.MarketTermsVersion = null;
                user.MarketTermsAcceptedAt = null;
                user.DeletedAt = now;

                // Collections and their items: tombstones, so other users' comments, reactions and reports stay linked.
                var collectionIds = await _db.Collections.Where(c => c.UserId == userId && c.DeletedAt == null).Select(c => c.Id).ToListAsync();
                foreach (var id in collectionIds) cleanup.Add(await _tombstones.TombstoneCollectionAsync(id));

                // Listings: tombstones too, because deals and chats point at them.
                var listings = await _db.Listings.Include(l => l.Lines).Include(l => l.Images)
                    .Where(l => l.OwnerId == userId && l.DeletedAt == null).ToListAsync();
                foreach (var listing in listings)
                {
                    listingFiles.AddRange(listing.Images.Select(i => i.FileName));
                    _db.ListingLines.RemoveRange(listing.Lines);
                    _db.ListingImages.RemoveRange(listing.Images);
                    listing.Title = "";
                    listing.Description = null;
                    listing.ExchangeFor = null;
                    if (listing.Status != ListingStatus.Removed) listing.Status = ListingStatus.Archived;
                    listing.UpdatedAt = now;
                    listing.DeletedAt = now;
                }

                // Comments keep their place in threads as "Comment deleted"; the text goes.
                var comments = await _db.ItemComments.Include(c => c.Mentions).Where(c => c.AuthorId == userId).ToListAsync();
                foreach (var comment in comments)
                {
                    _db.ItemCommentMentions.RemoveRange(comment.Mentions);
                    comment.Body = "";
                    comment.DeletedAt ??= now;
                }

                // The user's own subscriptions and likes: nothing else points at them.
                _db.Follows.RemoveRange(await _db.Follows.Where(f => f.UserId == userId).ToListAsync());
                _db.Reactions.RemoveRange(await _db.Reactions.Where(r => r.UserId == userId).ToListAsync());

                await _db.SaveChangesAsync();
                await tx.CommitAsync();
            }

            _deleted.MarkDeleted(userId);
            _suspensions.Forget(userId);
            await _tombstones.CleanupAsync(cleanup);
            foreach (var file in listingFiles)
            {
                try { await _images.DeleteImageAsync(file, _storage.ListingImages); }
                catch (Exception e) { Console.WriteLine($"Failed to delete listing image '{file}': {e.GetType().Name}"); }
            }
        }
    }

    /// <summary>Whether a token's user deleted their account (cached; checked on every request).</summary>
    public interface IDeletedAccounts
    {
        Task<bool> IsDeletedAsync(Guid userId);
        void MarkDeleted(Guid userId);
    }

    public sealed class DeletedAccounts : IDeletedAccounts
    {
        private static readonly TimeSpan LiveFor = TimeSpan.FromMinutes(1);
        private readonly CofferDbContext _db;
        private readonly IMemoryCache _cache;

        public DeletedAccounts(CofferDbContext db, IMemoryCache cache)
        {
            _db = db;
            _cache = cache;
        }

        private static string Key(Guid userId) => $"account-deleted:{userId}";

        public async Task<bool> IsDeletedAsync(Guid userId)
        {
            if (_cache.TryGetValue(Key(userId), out bool deleted)) return deleted;
            deleted = await _db.Users.AnyAsync(u => u.Id == userId && u.DeletedAt != null);
            // A deletion is final; a live account is re-checked shortly (this process marks its own deletions at once).
            if (deleted) _cache.Set(Key(userId), true);
            else _cache.Set(Key(userId), false, LiveFor);
            return deleted;
        }

        public void MarkDeleted(Guid userId) => _cache.Set(Key(userId), true);
    }
}
