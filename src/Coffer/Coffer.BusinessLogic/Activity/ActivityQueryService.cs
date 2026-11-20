using System.Globalization;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.DataAccess.Extensions;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Domain.Paging;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Activity
{
    /// <summary>
    /// What an entry points at, looked up when the log is read (names and images are never stored in the log).
    /// <see cref="Type"/> is the main target the app opens; when it is gone, <see cref="Available"/> is false and the
    /// title, image and excerpt are empty, so a deleted thing or person leaves nothing behind.
    /// </summary>
    public sealed record ActivityTargetDto(string Type, Guid? Id, Guid? ItemId, Guid? CollectionId, Guid? CommentId, Guid? ListingId,
        Guid? ConversationId, Guid? DealId, string Title, string? Image, string? Excerpt, bool Available, string? OtherName);

    public sealed record ActivityEntryDto(Guid Id, string Kind, string Category, DateTime OccurredAt, JsonElement Details, ActivityTargetDto Target);

    public sealed record ActivityCategoryDto(string Category, int Count, DateTime? LatestAt);

    public interface IActivityQueryService
    {
        /// <summary>The user's own log, newest first; <paramref name="category"/> null = all. Unknown category → 400.</summary>
        Task<PagedList<ActivityEntryDto>> GetPageAsync(Guid userId, string? category, int? page, int? pageSize);

        /// <summary>Every category (zeros included) with its count and latest time, in menu order.</summary>
        Task<List<ActivityCategoryDto>> GetSummaryAsync(Guid userId);
    }

    public sealed class ActivityQueryService : IActivityQueryService
    {
        private readonly CofferDbContext _db;

        public ActivityQueryService(CofferDbContext db)
        {
            _db = db;
        }

        public async Task<PagedList<ActivityEntryDto>> GetPageAsync(Guid userId, string? category, int? page, int? pageSize)
        {
            var query = _db.ActivityEvents.AsNoTracking().Where(e => e.UserId == userId);
            if (!string.IsNullOrWhiteSpace(category))
            {
                if (!ActivityKinds.Categories.Contains(category))
                    throw MarketplaceException.Validation("unknownActivityCategory", "Unknown activity category.");
                query = query.Where(e => e.Category == category);
            }
            var events = await query.OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.Id).ToPagedListAsync(page, pageSize);
            var targets = await Targets.LoadAsync(_db, events.Items);
            var entries = events.Items.Select(e => new ActivityEntryDto(e.Id, e.Kind, e.Category, Utc(e.OccurredAt), Details(e.Details), targets.Resolve(userId, e))).ToList();
            return new PagedList<ActivityEntryDto>(entries, events.Page, events.PageSize, events.Total);
        }

        public async Task<List<ActivityCategoryDto>> GetSummaryAsync(Guid userId)
        {
            var rows = await _db.ActivityEvents.AsNoTracking().Where(e => e.UserId == userId)
                .GroupBy(e => e.Category)
                .Select(g => new { Category = g.Key, Count = g.Count(), LatestAt = g.Max(e => e.OccurredAt) })
                .ToListAsync();
            return ActivityKinds.Categories.Select(c =>
            {
                var row = rows.FirstOrDefault(r => r.Category == c);
                return new ActivityCategoryDto(c, row?.Count ?? 0, row == null ? null : Utc(row.LatestAt));
            }).ToList();
        }

        /// <summary>Times are stored as UTC; say so in the JSON ("Z") whatever the database hands back.</summary>
        private static DateTime Utc(DateTime at) => DateTime.SpecifyKind(at, DateTimeKind.Utc);

        private static JsonElement Details(string json)
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            return doc.RootElement.Clone();
        }

        /// <summary>Everything one page of entries points at, loaded with one query per kind of target.</summary>
        private sealed class Targets
        {
            private sealed record ItemRow(Guid Id, Guid CollectionId, string Image, bool Gone, string Title);
            private sealed record CollectionRow(Guid Id, string Name, string? Image, bool Gone);
            private sealed record CommentRow(Guid Id, Guid ItemId, Guid AuthorId, string Body, bool Gone);
            private sealed record ListingRow(Guid Id, string Title, string? Image, bool Gone);
            private sealed record DealRow(Guid Id, Guid ListingId, Guid ConversationId);
            private sealed record ReviewRow(Guid Id, Guid DealId, bool Gone);
            private sealed record ReportRow(Guid Id, string Summary);
            private sealed record UserRow(Guid Id, string Name, bool Gone);

            private Dictionary<Guid, ItemRow> _items = new();
            private Dictionary<Guid, CollectionRow> _collections = new();
            private Dictionary<Guid, CommentRow> _comments = new();
            private Dictionary<Guid, ListingRow> _listings = new();
            private Dictionary<Guid, DealRow> _deals = new();
            private HashSet<Guid> _conversations = new();
            private Dictionary<Guid, ReviewRow> _reviews = new();
            private Dictionary<Guid, ReportRow> _reports = new();
            private Dictionary<Guid, UserRow> _users = new();

            private static List<Guid> Ids(IEnumerable<Guid?> ids) => ids.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();

            public static async Task<Targets> LoadAsync(CofferDbContext db, List<ActivityEvent> events)
            {
                var t = new Targets();

                var commentIds = Ids(events.Select(e => e.CommentId));
                t._comments = (await db.ItemComments.AsNoTracking().Where(c => commentIds.Contains(c.Id))
                        .Select(c => new CommentRow(c.Id, c.ItemId, c.AuthorId, c.Body, c.DeletedAt != null || c.IsRemoved)).ToListAsync())
                    .ToDictionary(c => c.Id);

                var reviewIds = Ids(events.Select(e => e.ReviewId));
                t._reviews = (await db.Reviews.AsNoTracking().Where(r => reviewIds.Contains(r.Id))
                    .Select(r => new ReviewRow(r.Id, r.DealId, r.IsRemoved)).ToListAsync()).ToDictionary(r => r.Id);

                var dealIds = Ids(events.Select(e => e.DealId).Concat(t._reviews.Values.Select(r => (Guid?)r.DealId)));
                t._deals = (await db.Deals.AsNoTracking().Where(d => dealIds.Contains(d.Id))
                    .Select(d => new DealRow(d.Id, d.ListingId, d.ConversationId)).ToListAsync()).ToDictionary(d => d.Id);

                var itemIds = Ids(events.Select(e => e.ItemId).Concat(t._comments.Values.Select(c => (Guid?)c.ItemId)));
                var items = await db.Items.AsNoTracking().Where(i => itemIds.Contains(i.Id))
                    .Select(i => new { i.Id, i.CollectionId, i.Image, i.Description, Gone = i.DeletedAt != null }).ToListAsync();
                var primary = await db.ItemAttributes.AsNoTracking().Where(a => itemIds.Contains(a.ItemId) && a.Attribute.Primary)
                    .Select(a => new { a.ItemId, a.ValueString, a.ValueNumber, a.ValueDate, a.ValueBoolean }).ToListAsync();
                var titles = primary.GroupBy(a => a.ItemId).ToDictionary(g => g.Key, g =>
                {
                    var a = g.First();
                    return a.ValueString ?? a.ValueNumber?.ToString(CultureInfo.InvariantCulture)
                        ?? a.ValueDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? a.ValueBoolean?.ToString() ?? "";
                });

                var collectionIds = Ids(events.Select(e => e.CollectionId).Concat(items.Select(i => (Guid?)i.CollectionId)));
                t._collections = (await db.Collections.AsNoTracking().Where(c => collectionIds.Contains(c.Id))
                    .Select(c => new CollectionRow(c.Id, c.Name, c.Image, c.DeletedAt != null)).ToListAsync()).ToDictionary(c => c.Id);

                // An item in a deleted collection is gone too.
                t._items = items.ToDictionary(i => i.Id, i => new ItemRow(i.Id, i.CollectionId, i.Image,
                    i.Gone || !t._collections.TryGetValue(i.CollectionId, out var c) || c.Gone,
                    titles.TryGetValue(i.Id, out var title) && title != "" ? title : i.Description ?? ""));

                var listingIds = Ids(events.Select(e => e.ListingId).Concat(t._deals.Values.Select(d => (Guid?)d.ListingId)));
                t._listings = (await db.Listings.AsNoTracking().Where(l => listingIds.Contains(l.Id))
                        .Select(l => new ListingRow(l.Id, l.Title, l.Images.OrderBy(i => i.Position).Select(i => i.FileName).FirstOrDefault(),
                            l.DeletedAt != null || l.Status == ListingStatus.Removed)).ToListAsync())
                    .ToDictionary(l => l.Id);

                var conversationIds = Ids(events.Select(e => e.ConversationId));
                t._conversations = (await db.Conversations.AsNoTracking().Where(c => conversationIds.Contains(c.Id)).Select(c => c.Id).ToListAsync()).ToHashSet();

                var reportIds = Ids(events.Select(e => e.ReportId));
                t._reports = (await db.Reports.AsNoTracking().Where(r => reportIds.Contains(r.Id))
                    .Select(r => new ReportRow(r.Id, r.TargetSummary)).ToListAsync()).ToDictionary(r => r.Id);

                var userIds = Ids(events.Select(e => e.OtherUserId));
                t._users = (await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id))
                    .Select(u => new UserRow(u.Id, u.Name, u.DeletedAt != null)).ToListAsync()).ToDictionary(u => u.Id);
                return t;
            }

            private static T? Find<T>(Dictionary<Guid, T> rows, Guid? id) where T : class =>
                id.HasValue && rows.TryGetValue(id.Value, out var row) ? row : null;

            public ActivityTargetDto Resolve(Guid viewerId, ActivityEvent e)
            {
                var comment = Find(_comments, e.CommentId);
                var item = Find(_items, e.ItemId ?? comment?.ItemId);
                var collection = Find(_collections, e.CollectionId ?? item?.CollectionId);
                var review = Find(_reviews, e.ReviewId);
                var deal = Find(_deals, e.DealId ?? review?.DealId);
                var listing = Find(_listings, e.ListingId ?? deal?.ListingId);
                var conversationId = e.ConversationId ?? deal?.ConversationId;

                string type;
                Guid? id;
                bool available;
                string title = "";
                string? image = null, excerpt = null;

                // A report opens Settings › Reports even when the reported thing was removed afterwards.
                if (e.Kind == "report.filed" && e.ReportId.HasValue)
                {
                    var report = Find(_reports, e.ReportId);
                    (type, id, available, title) = ("report", e.ReportId, report != null, report?.Summary ?? "");
                }
                else if (e.CommentId.HasValue)
                {
                    (type, id) = ("comment", e.CommentId);
                    available = comment is { Gone: false } && item is { Gone: false };
                    (title, image) = (item?.Title ?? "", item?.Image);
                    excerpt = comment != null && comment.AuthorId == viewerId ? comment.Body : null;
                }
                else if (e.ItemId.HasValue)
                {
                    (type, id, available) = ("item", e.ItemId, item is { Gone: false });
                    (title, image) = (item?.Title ?? "", item?.Image);
                }
                else if (e.CollectionId.HasValue)
                {
                    (type, id, available) = ("collection", e.CollectionId, collection is { Gone: false });
                    (title, image) = (collection?.Name ?? "", collection?.Image);
                }
                else if (e.DealId.HasValue)
                {
                    (type, id, available) = ("deal", e.DealId, deal != null);
                    (title, image) = (listing?.Title ?? "", listing?.Image);
                }
                else if (e.ConversationId.HasValue)
                {
                    (type, id, available) = ("conversation", e.ConversationId, _conversations.Contains(e.ConversationId.Value));
                    (title, image) = (listing?.Title ?? "", listing?.Image);
                }
                else if (e.ListingId.HasValue)
                {
                    (type, id, available) = ("listing", e.ListingId, listing is { Gone: false });
                    (title, image) = (listing?.Title ?? "", listing?.Image);
                }
                else if (e.ReviewId.HasValue)
                {
                    (type, id, available) = ("review", e.ReviewId, review is { Gone: false });
                    (title, image) = (listing?.Title ?? "", listing?.Image);
                }
                else
                {
                    (type, id, available) = ("none", null, false);
                }

                string? otherName = null;
                if (e.OtherUserId.HasValue)
                {
                    var other = Find(_users, e.OtherUserId);
                    var gone = other == null || other.Gone;
                    otherName = gone ? "" : other!.Name;
                    if (gone) available = false;
                }

                if (!available) (title, image, excerpt) = ("", null, null);
                return new ActivityTargetDto(type, id, e.ItemId ?? comment?.ItemId, e.CollectionId ?? item?.CollectionId, e.CommentId,
                    e.ListingId ?? deal?.ListingId, conversationId, e.DealId ?? review?.DealId, title, image, excerpt, available, otherName);
            }
        }
    }
}
