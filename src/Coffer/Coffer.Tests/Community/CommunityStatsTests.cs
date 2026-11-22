using System.Net;
using System.Text.Json;
using Coffer.BusinessLogic.Community.Stats;
using Coffer.Domain.Community;
using Coffer.Domain.Entities;
using Coffer.Domain.Moderation;
using Coffer.Tests.Marketplace;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.Tests.Community
{
    /// <summary>Stats & facts: only visible things count; weeks are Monday-based UTC; the shared part is cached 5 minutes.</summary>
    public class CommunityStatsTests : IDisposable
    {
        private readonly TestDb Db = new();
        /// <summary>Friday 2026-11-13 12:00 UTC: this week started Monday 2026-11-09, this month on 2026-11-01.</summary>
        private readonly FakeClock Clock = new();
        private readonly MemoryCache Cache = new(new MemoryCacheOptions());
        private static readonly DateTime WeekStart = new(2026, 11, 9, 0, 0, 0, DateTimeKind.Utc);

        private CommunityStatsService Sut() => new(Db.Context, Clock, Cache);

        private User User(string name, DateTime? createdAt = null)
        {
            var user = Db.AddUser(name);
            user.CreatedAt = createdAt ?? WeekStart.AddDays(-60);
            Db.Context.SaveChanges();
            return user;
        }

        private void Event(User user, string kind, DateTime at, Guid? itemId = null, Guid? collectionId = null, string details = "{}")
        {
            Db.Context.ActivityEvents.Add(new ActivityEvent
            {
                Id = Guid.NewGuid(), UserId = user.Id, Kind = kind, Category = Coffer.BusinessLogic.Activity.ActivityKinds.Category[kind],
                OccurredAt = at, ItemId = itemId, CollectionId = collectionId, Details = details,
            });
            Db.Context.SaveChanges();
        }

        private void ItemsAdded(User user, DateTime at, int count)
        {
            for (var i = 0; i < count; i++) Event(user, "item.added", at.AddMinutes(i));
        }

        private static MilestoneDto Milestone(CommunityStatsDto stats, string key) => stats.Milestones.Single(m => m.Key == key);

        [Fact]
        public async Task TotalsCountVisibleThings()
        {
            var anna = User("anna");
            var bob = User("bob");
            var annas = Db.AddCollection(anna);
            var bobs = Db.AddCollection(bob);
            var one = Db.AddItem(annas);
            var three = Db.AddItem(annas);
            three.Quantity = 3;
            var other = Db.AddItem(bobs);
            Db.Context.Reactions.Add(new ReactionProvided(bob.Id, one.Id, true, 4)); // a like and a rating
            var commentId = Guid.NewGuid();
            Db.Context.ItemComments.Add(new ItemComment { Id = commentId, RootId = commentId, ItemId = one.Id, AuthorId = bob.Id, Body = "Nice", CreatedAt = Clock.UtcNow });
            Db.Context.SaveChanges();
            Db.Follow(anna, bobs);

            var totals = (await Sut().GetAsync(anna.Id)).Totals;

            Assert.Equal(new StatsTotals(Members: 2, Items: 3, Pieces: 5, Collections: 2, Interactions: 4), totals);
        }

        [Fact]
        public async Task HiddenAndDeletedAreNotCounted()
        {
            var anna = User("anna");
            var gone = User("gone");
            var shown = Db.AddCollection(anna);
            Db.AddItem(shown);
            var hiddenType = Db.AddCollectionType("Stamps");
            hiddenType.Published = false;
            var hiddenItem = Db.AddItem(Db.AddCollection(anna, hiddenType.Id, "Stamps"));
            var tombstoned = Db.AddItem(shown);
            tombstoned.DeletedAt = Clock.UtcNow;
            var deletedCollection = Db.AddCollection(anna, shown.CollectionTypeId, "Old");
            Db.AddItem(deletedCollection);
            deletedCollection.DeletedAt = Clock.UtcNow;
            gone.DeletedAt = Clock.UtcNow;
            Db.Context.Reactions.Add(new ReactionProvided(anna.Id, hiddenItem.Id, true, null));
            Db.Context.SaveChanges();

            var totals = (await Sut().GetAsync(anna.Id)).Totals;

            Assert.Equal(new StatsTotals(Members: 1, Items: 1, Pieces: 1, Collections: 1, Interactions: 0), totals);
        }

        [Fact]
        public async Task InteractionsThisWeekAndMonth()
        {
            var anna = User("anna");
            Event(anna, "reaction.liked", WeekStart.AddHours(1));
            Event(anna, "comment.posted", WeekStart.AddDays(2));
            Event(anna, "follow.followed", WeekStart.AddSeconds(-1));          // last week, this month
            Event(anna, "reaction.rated", new DateTime(2026, 10, 31, 23, 0, 0, DateTimeKind.Utc)); // last month
            Event(anna, "item.added", WeekStart.AddHours(2));                 // not an interaction
            Event(anna, "reaction.unliked", WeekStart.AddHours(3));           // not an interaction

            var interactions = (await Sut().GetAsync(anna.Id)).Interactions;

            Assert.Equal(new PeriodCounts(ThisWeek: 2, ThisMonth: 3), interactions);
        }

        [Fact]
        public async Task GrowthIsTwelveCumulativeWeeks()
        {
            var early = User("early", WeekStart.AddDays(-100));
            User("mid", WeekStart.AddDays(-20));
            User("now", WeekStart.AddDays(1));
            var collection = Db.AddCollection(early);
            collection.CreatedAt = WeekStart.AddDays(-30);
            var item = Db.AddItem(collection);
            Event(early, "item.added", WeekStart.AddDays(-14), itemId: item.Id);
            Db.Context.SaveChanges();

            var growth = (await Sut().GetAsync(early.Id)).Growth;

            Assert.Equal(12, growth.Count);
            Assert.Equal(WeekStart, growth[^1].WeekStart);
            Assert.Equal(WeekStart.AddDays(-77), growth[0].WeekStart);
            Assert.Equal((3, 1, 1), (growth[^1].Members, growth[^1].Items, growth[^1].Collections));
            Assert.Equal(1, growth[0].Members);
            Assert.Equal(2, growth[^2].Members);
            Assert.Equal(0, growth[^4].Items);
            Assert.Equal(1, growth[^2].Items);
        }

        [Fact]
        public async Task TopCollectorIsMostActiveThisWeek()
        {
            var anna = User("anna");
            var bob = User("bob");
            var cleo = User("cleo");
            Event(anna, "reaction.liked", WeekStart.AddHours(1));
            Event(anna, "comment.posted", WeekStart.AddHours(2));
            Event(anna, "follow.followed", WeekStart.AddHours(3));
            ItemsAdded(bob, WeekStart.AddHours(4), 3);                         // same count as anna, but items added
            for (var i = 0; i < 9; i++) Event(cleo, "reaction.liked", WeekStart.AddDays(-2).AddMinutes(i)); // last week

            var top = (await Sut().GetAsync(anna.Id)).TopCollector;

            Assert.NotNull(top);
            Assert.Equal((bob.Id, "bob", 3), (top!.UserId, top.Name, top.ActivityCount));
        }

        [Fact]
        public async Task SuspendedUserIsNotCollectorOfTheWeek()
        {
            var anna = User("anna");
            var bob = User("bob");
            ItemsAdded(bob, WeekStart.AddHours(1), 5);
            ItemsAdded(anna, WeekStart.AddHours(2), 2);
            Db.Context.UserSuspensions.Add(new UserSuspension
            {
                Id = Guid.NewGuid(), UserId = bob.Id, Reason = "Spam", StartsAt = Clock.UtcNow.AddHours(-1), EndsAt = Clock.UtcNow.AddDays(1),
                CreatedByAdminId = Db.AddManagerAdmin().Id, CreatedAt = Clock.UtcNow,
            });
            Db.Context.SaveChanges();

            Assert.Equal(anna.Id, (await Sut().GetAsync(anna.Id)).TopCollector!.UserId);
        }

        [Fact]
        public async Task TrendingTypeCountsItemsAddedThisWeek()
        {
            var anna = User("anna");
            var caps = Db.AddCollectionType("Caps");
            var coins = Db.AddCollectionType("Coins of Europe");
            var hidden = Db.AddCollectionType("Stamps");
            hidden.Published = false;
            Db.Context.SaveChanges();
            var capItem = Db.AddItem(Db.AddCollection(anna, caps.Id, "Caps"));
            var coinItem = Db.AddItem(Db.AddCollection(anna, coins.Id, "Coins"));
            var stampItem = Db.AddItem(Db.AddCollection(anna, hidden.Id, "Stamps"));
            Event(anna, "item.added", WeekStart.AddHours(1), itemId: capItem.Id);
            Event(anna, "item.added", WeekStart.AddHours(2), itemId: capItem.Id);
            Event(anna, "item.addedToExisting", WeekStart.AddHours(3), itemId: coinItem.Id, details: "{\"quantity\":3}");
            for (var i = 0; i < 9; i++) Event(anna, "item.added", WeekStart.AddHours(4), itemId: stampItem.Id);
            Event(anna, "item.added", WeekStart.AddDays(-3), itemId: capItem.Id);   // last week

            var trending = (await Sut().GetAsync(anna.Id)).TrendingType;

            Assert.NotNull(trending);
            Assert.Equal((coins.Id, "Coins of Europe", 3), (trending!.Id, trending.Name, trending.ItemsAdded));
        }

        [Fact]
        public async Task MilestonesReplayPastWeeks()
        {
            var anna = User("anna");
            var bob = User("bob");
            ItemsAdded(anna, WeekStart.AddDays(-21), 10);  // met 10 → 15
            ItemsAdded(bob, WeekStart.AddDays(-14), 15);   // met 15 → 25
            // the week before this one: silent → missed → back to 15
            ItemsAdded(anna, WeekStart.AddHours(1), 4);    // this week so far

            var stats = await Sut().GetAsync(anna.Id);
            var items = Milestone(stats, "itemsAdded");
            var active = Milestone(stats, "activeUsers");

            Assert.Equal((15, 4, 0, 25, 1, MilestoneLadder.ItemsAdded.Length), (items.Target, items.Progress, items.Streak, items.BestTarget, items.Rung, items.Rungs));
            // active users: 1, 1, 0 → missed every week, stays on the first rung (3); this week 1 so far
            Assert.Equal((3, 1, 0), (active.Target, active.Progress, active.Streak));
        }

        [Fact]
        public async Task MineCountsMyItemsAndActivity()
        {
            var anna = User("anna");
            var bob = User("bob");
            ItemsAdded(anna, WeekStart.AddHours(1), 2);
            Event(anna, "item.addedToExisting", WeekStart.AddHours(2), details: "{\"quantity\":3}");
            ItemsAdded(bob, WeekStart.AddHours(3), 4);

            var annas = await Sut().GetAsync(anna.Id);
            var cleos = await Sut().GetAsync(User("cleo").Id);

            Assert.Equal(new MyMilestoneDto(5, true), Milestone(annas, "itemsAdded").Mine);
            Assert.Equal(9, Milestone(annas, "itemsAdded").Progress);
            Assert.Equal(new MyMilestoneDto(1, true), Milestone(annas, "activeUsers").Mine);
            Assert.Equal(new MyMilestoneDto(0, false), Milestone(cleos, "itemsAdded").Mine);
            Assert.Equal(new MyMilestoneDto(0, false), Milestone(cleos, "activeUsers").Mine);
        }

        [Fact]
        public async Task EmptyDatabaseGivesZerosAndRungZero()
        {
            var anna = User("anna");

            var stats = await Sut().GetAsync(anna.Id);

            Assert.Equal(new StatsTotals(1, 0, 0, 0, 0), stats.Totals);
            Assert.Equal(new PeriodCounts(0, 0), stats.Interactions);
            Assert.Null(stats.TopCollector);
            Assert.Null(stats.TrendingType);
            Assert.All(stats.Milestones, m => Assert.Equal((0, 0, 0), (m.Rung, m.Progress, m.Streak)));
            Assert.Equal(10, Milestone(stats, "itemsAdded").Target);
            Assert.Equal(3, Milestone(stats, "activeUsers").Target);
        }

        [Fact]
        public async Task MineIsPerUserWhileSharedPartIsCached()
        {
            var anna = User("anna");
            var bob = User("bob");
            ItemsAdded(anna, WeekStart.AddHours(1), 2);
            var first = await Sut().GetAsync(anna.Id);

            ItemsAdded(bob, WeekStart.AddHours(2), 3);
            Clock.Advance(TimeSpan.FromMinutes(2));
            var cached = await Sut().GetAsync(bob.Id);
            Clock.Advance(TimeSpan.FromMinutes(4));
            Cache.Compact(1.0); // the 5 minutes passed (the cache runs on real time)
            var fresh = await Sut().GetAsync(bob.Id);

            Assert.Equal(2, Milestone(first, "itemsAdded").Progress);
            Assert.Equal(2, Milestone(cached, "itemsAdded").Progress);
            Assert.Equal(3, Milestone(cached, "itemsAdded").Mine.Count);
            Assert.Equal(5, Milestone(fresh, "itemsAdded").Progress);
        }

        public void Dispose()
        {
            Cache.Dispose();
            Db.Dispose();
        }
    }

    [Collection("api")]
    public class CommunityStatsApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        [Fact]
        public async Task StatsNeedSignIn()
        {
            var anna = _api.Db.AddUser("anna");

            var anonymous = await _api.ClientFor(null).GetAsync("api/Community/Stats");
            var signedIn = await _api.ClientFor(anna).GetAsync("api/Community/Stats");

            Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
            Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
            var json = JsonDocument.Parse(await signedIn.Content.ReadAsStringAsync()).RootElement;
            Assert.Equal("itemsAdded", json.GetProperty("milestones")[0].GetProperty("key").GetString());
            Assert.Equal(12, json.GetProperty("growth").GetArrayLength());
            Assert.Equal(1, json.GetProperty("totals").GetProperty("members").GetInt32());
        }

        public void Dispose() => _api.Dispose();
    }
}
