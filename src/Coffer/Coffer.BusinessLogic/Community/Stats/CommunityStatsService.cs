using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.DataAccess.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Community.Stats
{
    public sealed record StatsTotals(int Members, int Items, int Pieces, int Collections, int Interactions);
    public sealed record PeriodCounts(int ThisWeek, int ThisMonth);
    /// <summary>Totals at the end of a week (the current week: so far), oldest first.</summary>
    public sealed record GrowthPoint(DateTime WeekStart, int Members, int Items, int Collections);
    public sealed record TopCollectorDto(Guid UserId, string Name, string? Avatar, int ActivityCount);
    public sealed record TrendingTypeDto(int Id, string Name, string Color, string Icon, int ItemsAdded);
    /// <summary>The viewer's part this week: items added (for "itemsAdded"), or 1/0 (for "activeUsers").</summary>
    public sealed record MyMilestoneDto(int Count, bool Active);
    public sealed record MilestoneDto(string Key, int Target, int Progress, int Streak, int BestTarget, int Rung, int Rungs, MyMilestoneDto Mine);
    public sealed record CommunityStatsDto(DateTime GeneratedAt, StatsTotals Totals, PeriodCounts Interactions, List<GrowthPoint> Growth,
        TopCollectorDto? TopCollector, TrendingTypeDto? TrendingType, List<MilestoneDto> Milestones);

    public interface ICommunityStatsService
    {
        Task<CommunityStatsDto> GetAsync(Guid viewerId);
    }

    /// <summary>
    /// Stats & facts of the Community tab, computed from data that already carries dates (members, collections, items,
    /// the activity log). Only visible things count: published item types, live rows, accounts not deleted. The shared
    /// part is cached for 5 minutes; the viewer's own contribution is read on every request.
    /// </summary>
    public sealed class CommunityStatsService : ICommunityStatsService
    {
        public const string CacheKey = "community-stats";
        public static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(5);
        public const int GrowthWeeks = 12;

        private static readonly string[] InteractionKinds = { "reaction.liked", "reaction.rated", "comment.posted", "comment.replied", "follow.followed" };
        private static readonly string[] ItemKinds = { "item.added", "item.addedToExisting" };

        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IMemoryCache _cache;

        public CommunityStatsService(CofferDbContext db, IClock clock, IMemoryCache cache)
        {
            _db = db;
            _clock = clock;
            _cache = cache;
        }

        public async Task<CommunityStatsDto> GetAsync(Guid viewerId)
        {
            var shared = await _cache.GetOrCreateAsync(CacheKey, entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheFor;
                return ComputeSharedAsync();
            });
            var mine = await MineAsync(viewerId, shared!.WeekStart);
            return shared.Stats with
            {
                Milestones = shared.Stats.Milestones.Select(m => m with
                {
                    Mine = m.Key == "itemsAdded" ? new MyMilestoneDto(mine.Items, mine.Active) : new MyMilestoneDto(mine.Active ? 1 : 0, mine.Active),
                }).ToList(),
            };
        }

        private sealed record Shared(DateTime WeekStart, CommunityStatsDto Stats);

        private sealed record EventRow(Guid UserId, string Kind, DateTime OccurredAt, Guid? ItemId, string Details);

        /// <summary>Items added by one event: 1 for a new item, the quantity for more pieces of an existing one.</summary>
        private static int ItemsOf(EventRow e) => e.Kind == "item.addedToExisting" ? Quantity(e.Details) : 1;

        private static int Quantity(string details)
        {
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(details) ? "{}" : details);
                return doc.RootElement.TryGetProperty("quantity", out var q) && q.TryGetInt32(out var n) && n > 0 ? n : 1;
            }
            catch (JsonException)
            {
                return 1;
            }
        }

        private static DateTime Utc(DateTime at) => DateTime.SpecifyKind(at, DateTimeKind.Utc);

        private async Task<Shared> ComputeSharedAsync()
        {
            var now = _clock.UtcNow;
            var weekStart = Weeks.StartOf(now);
            var monthStart = Weeks.MonthStartOf(now);

            // ------------------------------------------------------------ visible things
            var collections = _db.Collections.AsNoTracking().Where(c => c.DeletedAt == null && c.User.DeletedAt == null).WherePublished(_db);
            var items = _db.Items.AsNoTracking().Where(i => i.DeletedAt == null && i.Collection.DeletedAt == null && i.Collection.User.DeletedAt == null)
                .WherePublished(_db);
            var visibleItemIds = items.Select(i => i.Id);
            var visibleCollectionIds = collections.Select(c => c.Id);
            // Items of an unpublished type: their activity doesn't count either.
            var hiddenItemIds = (await _db.Items.AsNoTracking().Select(i => i.Id).Except(_db.Items.WherePublished(_db).Select(i => i.Id)).ToListAsync()).ToHashSet();

            var members = await _db.Users.CountAsync(u => u.DeletedAt == null);
            var itemRows = await items.Select(i => new { i.Id, i.Quantity, i.AcquiredAt, TypeId = i.Collection.CollectionTypeId }).ToListAsync();
            var collectionDates = await collections.Select(c => c.CreatedAt).ToListAsync();
            var likes = await _db.Reactions.CountAsync(r => r.Liked && visibleItemIds.Contains(r.ItemId));
            var ratings = await _db.Reactions.CountAsync(r => r.Rarity != null && visibleItemIds.Contains(r.ItemId));
            var comments = await _db.ItemComments.CountAsync(c => c.DeletedAt == null && !c.IsRemoved && visibleItemIds.Contains(c.ItemId));
            var follows = await _db.Follows.CountAsync(f => visibleCollectionIds.Contains(f.CollectionId));
            var totals = new StatsTotals(members, itemRows.Count, itemRows.Sum(i => i.Quantity), collectionDates.Count, likes + ratings + comments + follows);

            // ------------------------------------------------------------ activity log
            var counted = InteractionKinds.Concat(ItemKinds).ToList();
            var events = (await _db.ActivityEvents.AsNoTracking()
                    .Select(e => new EventRow(e.UserId, e.Kind, e.OccurredAt, e.ItemId, e.Details)).ToListAsync())
                .Select(e => e with { OccurredAt = Utc(e.OccurredAt) })
                .Where(e => e.ItemId == null || !hiddenItemIds.Contains(e.ItemId.Value))
                .ToList();

            var interactions = new PeriodCounts(
                events.Count(e => InteractionKinds.Contains(e.Kind) && e.OccurredAt >= weekStart),
                events.Count(e => InteractionKinds.Contains(e.Kind) && e.OccurredAt >= monthStart));

            // ------------------------------------------------------------ growth (cumulative, last 12 weeks)
            var firstAdded = events.Where(e => e.Kind == "item.added" && e.ItemId != null)
                .GroupBy(e => e.ItemId!.Value).ToDictionary(g => g.Key, g => g.Min(e => e.OccurredAt));
            var itemDates = itemRows.Select(i => firstAdded.TryGetValue(i.Id, out var at) ? at : Utc(i.AcquiredAt)).ToList();
            var memberDates = (await _db.Users.Where(u => u.DeletedAt == null).Select(u => u.CreatedAt).ToListAsync()).Select(Utc).ToList();
            var collectionDatesUtc = collectionDates.Select(Utc).ToList();
            var growth = Enumerable.Range(0, GrowthWeeks).Select(i =>
            {
                var start = weekStart.AddDays(-7 * (GrowthWeeks - 1 - i));
                var end = start.AddDays(7);
                return new GrowthPoint(start, memberDates.Count(d => d < end), itemDates.Count(d => d < end), collectionDatesUtc.Count(d => d < end));
            }).ToList();

            // ------------------------------------------------------------ this week's highlights
            var thisWeek = events.Where(e => e.OccurredAt >= weekStart).ToList();
            var suspended = (await _db.UserSuspensions.Where(s => s.RevokedAt == null && s.StartsAt <= now && s.EndsAt > now)
                .Select(s => s.UserId).ToListAsync()).ToHashSet();
            var top = thisWeek.Where(e => !suspended.Contains(e.UserId))
                .GroupBy(e => e.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count(), Items = g.Where(e => ItemKinds.Contains(e.Kind)).Sum(ItemsOf), Latest = g.Max(e => e.OccurredAt) })
                .OrderByDescending(x => x.Count).ThenByDescending(x => x.Items).ThenBy(x => x.Latest)
                .FirstOrDefault();
            TopCollectorDto? topCollector = null;
            if (top != null)
            {
                var user = await _db.Users.AsNoTracking().Where(u => u.Id == top.UserId && u.DeletedAt == null)
                    .Select(u => new { u.Name, u.Avatar }).FirstOrDefaultAsync();
                if (user != null) topCollector = new TopCollectorDto(top.UserId, user.Name, user.Avatar, top.Count);
            }

            var typeOfItem = itemRows.ToDictionary(i => i.Id, i => i.TypeId);
            var trending = thisWeek.Where(e => ItemKinds.Contains(e.Kind) && e.ItemId != null && typeOfItem.ContainsKey(e.ItemId.Value))
                .GroupBy(e => typeOfItem[e.ItemId!.Value])
                .Select(g => new { TypeId = g.Key, Items = g.Sum(ItemsOf) })
                .OrderByDescending(x => x.Items).ThenBy(x => x.TypeId)
                .FirstOrDefault();
            TrendingTypeDto? trendingType = null;
            if (trending != null)
            {
                var type = await _db.CollectionTypes.AsNoTracking().Where(t => t.Id == trending.TypeId && t.Published)
                    .Select(t => new { t.Id, t.Name, t.Color, t.Icon }).FirstOrDefaultAsync();
                if (type != null) trendingType = new TrendingTypeDto(type.Id, type.Name, type.Color, type.Icon ?? "", trending.Items);
            }

            // ------------------------------------------------------------ milestones
            var milestones = new List<MilestoneDto>
            {
                Milestone("itemsAdded", MilestoneLadder.ItemsAdded, events.Where(e => ItemKinds.Contains(e.Kind)).ToList(), weekStart,
                    week => week.Sum(ItemsOf)),
                Milestone("activeUsers", MilestoneLadder.ActiveUsers, events, weekStart,
                    week => week.Select(e => e.UserId).Distinct().Count()),
            };

            var stats = new CommunityStatsDto(now, totals, interactions, growth, topCollector, trendingType, milestones);
            return new Shared(weekStart, stats);
        }

        /// <summary>Replays every completed week since the first activity through the ladder; progress is this week so far.</summary>
        private static MilestoneDto Milestone(string key, int[] rungs, List<EventRow> events, DateTime weekStart, Func<IEnumerable<EventRow>, int> count)
        {
            var byWeek = events.GroupBy(e => Weeks.StartOf(e.OccurredAt)).ToDictionary(g => g.Key, g => count(g));
            var completed = new List<int>();
            if (byWeek.Count > 0)
            {
                for (var week = byWeek.Keys.Min(); week < weekStart; week = week.AddDays(7))
                    completed.Add(byWeek.GetValueOrDefault(week));
            }
            var state = MilestoneLadder.Replay(completed, rungs);
            return new MilestoneDto(key, rungs[state.Rung], byWeek.GetValueOrDefault(weekStart), state.Streak, rungs[state.BestRung],
                state.Rung, rungs.Length, new MyMilestoneDto(0, false));
        }

        private async Task<(int Items, bool Active)> MineAsync(Guid viewerId, DateTime weekStart)
        {
            var mine = (await _db.ActivityEvents.AsNoTracking().Where(e => e.UserId == viewerId && e.OccurredAt >= weekStart)
                .Select(e => new EventRow(e.UserId, e.Kind, e.OccurredAt, e.ItemId, e.Details)).ToListAsync());
            return (mine.Where(e => ItemKinds.Contains(e.Kind)).Sum(ItemsOf), mine.Count > 0);
        }
    }
}
