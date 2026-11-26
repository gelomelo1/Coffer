using Coffer.BusinessLogic.Activity;
using Coffer.Tests.Marketplace;

namespace Coffer.Tests.Activity
{
    /// <summary>The recorder: adds an event to the action's own save, never saves by itself, knows every kind.</summary>
    public class ActivityLogTests : IDisposable
    {
        private readonly TestDb Db = new();
        private readonly FakeClock Clock = new();
        private ActivityLog Log() => new(Db.Context, Clock);

        public static readonly Dictionary<string, string> SpecKinds = new()
        {
            ["reaction.liked"] = "likes", ["reaction.unliked"] = "likes", ["reaction.rated"] = "likes", ["reaction.rerated"] = "likes", ["reaction.unrated"] = "likes",
            ["comment.posted"] = "comments", ["comment.replied"] = "comments", ["comment.edited"] = "comments", ["comment.deleted"] = "comments",
            ["collection.created"] = "collection", ["collection.edited"] = "collection", ["collection.deleted"] = "collection",
            ["item.added"] = "collection", ["item.addedToExisting"] = "collection", ["item.edited"] = "collection", ["item.deleted"] = "collection",
            ["follow.followed"] = "follows", ["follow.unfollowed"] = "follows",
            ["listing.posted"] = "marketplace", ["listing.edited"] = "marketplace", ["listing.archived"] = "marketplace", ["listing.reactivated"] = "marketplace",
            ["chat.started"] = "marketplace", ["offer.sent"] = "marketplace", ["meetup.proposed"] = "marketplace",
            ["proposal.accepted"] = "marketplace", ["proposal.declined"] = "marketplace", ["proposal.withdrawn"] = "marketplace",
            ["deal.proposed"] = "trades", ["deal.accepted"] = "trades", ["deal.declined"] = "trades", ["deal.cancelled"] = "trades",
            ["deal.handoffConfirmed"] = "trades", ["deal.shipped"] = "trades", ["deal.receiptConfirmed"] = "trades", ["deal.disputed"] = "trades",
            ["review.written"] = "trades", ["review.replied"] = "trades",
            ["report.filed"] = "reports",
            ["contribution.voted"] = "contribution", ["contribution.voteChanged"] = "contribution",
            ["contribution.photosUploaded"] = "contribution", ["contribution.formCompleted"] = "contribution",
        };

        [Fact]
        public void RecordAddsRowSavedWithTheAction()
        {
            var user = Db.AddUser("anna");
            var item = Guid.NewGuid();

            Log().Record(user.Id, "reaction.rerated", new ActivityTargets(ItemId: item), new { from = 3, to = 5 });
            Db.Context.SaveChanges();

            using var fresh = Db.NewContext();
            var e = fresh.ActivityEvents.Single();
            Assert.Equal(user.Id, e.UserId);
            Assert.Equal("reaction.rerated", e.Kind);
            Assert.Equal("likes", e.Category);
            Assert.Equal(item, e.ItemId);
            Assert.Equal("{\"from\":3,\"to\":5}", e.Details);
            Assert.Equal(Clock.UtcNow, DateTime.SpecifyKind(e.OccurredAt, DateTimeKind.Utc));
            Assert.False(e.Backfilled);
        }

        [Fact]
        public void RecordDoesNotSaveByItself()
        {
            var user = Db.AddUser("anna");

            Log().Record(user.Id, "follow.followed", new ActivityTargets(CollectionId: Guid.NewGuid()));

            using var fresh = Db.NewContext();
            Assert.Empty(fresh.ActivityEvents);
        }

        [Fact]
        public void NoDetailsIsAnEmptyObject()
        {
            var user = Db.AddUser("anna");
            Log().Record(user.Id, "follow.followed", new ActivityTargets(CollectionId: Guid.NewGuid()));
            Db.Context.SaveChanges();

            using var fresh = Db.NewContext();
            Assert.Equal("{}", fresh.ActivityEvents.Single().Details);
        }

        [Fact]
        public void UnknownKindThrows()
        {
            var user = Db.AddUser("anna");
            Assert.Throws<ArgumentException>(() => Log().Record(user.Id, "reaction.typo", new ActivityTargets()));
        }

        [Fact]
        public void EveryKindHasACategory()
        {
            Assert.Equal(SpecKinds.OrderBy(k => k.Key), ActivityKinds.Category.OrderBy(k => k.Key));
            Assert.All(ActivityKinds.Category.Values, c => Assert.Contains(c, ActivityKinds.Categories));
            Assert.Equal(new[] { "likes", "comments", "collection", "follows", "marketplace", "trades", "reports", "contribution" }, ActivityKinds.Categories);
        }

        public void Dispose() => Db.Dispose();
    }
}
