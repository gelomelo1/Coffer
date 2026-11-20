using Coffer.BusinessLogic.Activity;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Deletion;

namespace Coffer.Tests.Activity
{
    /// <summary>The one-time fill of the past: dated rows become log entries for the user who did them.</summary>
    public class ActivityBackfillTests : IDisposable
    {
        private readonly TestDb Db = new();
        private MarketRows Rows => new(Db);
        private static readonly DateTime T0 = new(2026, 10, 1, 9, 0, 0, DateTimeKind.Utc);
        private static DateTime T(int minutes) => T0.AddMinutes(minutes);

        private Task<int> Run() => new ActivityBackfill(Db.Context).RunAsync();

        private List<ActivityEvent> Events(User user)
        {
            using var fresh = Db.NewContext();
            return fresh.ActivityEvents.Where(e => e.UserId == user.Id).OrderBy(e => e.OccurredAt).ToList();
        }

        private static List<(string, DateTime)> KindsAndTimes(List<ActivityEvent> events) => events.Select(e => (e.Kind, e.OccurredAt)).ToList();

        [Fact]
        public async Task BackfillCreatesEventsFromDatedRows()
        {
            var seller = Db.AddUser("seller");
            var buyer = Db.AddUser("buyer");
            var collection = Db.AddCollection(seller);
            collection.CreatedAt = T(0);
            var item = Db.AddItem(collection);
            item.AcquiredAt = T(1);
            Db.Follow(buyer, collection).FollowedAt = T(2);
            var comment = Rows.Comment(item, buyer, "Nice");
            comment.CreatedAt = T(3);
            var reply = Rows.Comment(item, seller, "Thanks", parent: comment);
            reply.CreatedAt = T(4);

            var listing = Rows.Listing(seller);
            listing.CreatedAt = T(5);
            var deal = Rows.Deal(listing, buyer, DealStatus.Completed, shippedAt: T(7));
            deal.CreatedAt = T(6);
            deal.ReceivedAt = T(8);
            var review = Rows.Review(deal, buyer, seller, stars: 4);
            review.CreatedAt = T(9);
            review.Reply = "Thank you";
            review.RepliedAt = T(10);

            var declinedListing = Rows.Listing(seller);
            declinedListing.CreatedAt = T(11);
            var declined = Rows.Deal(declinedListing, buyer, DealStatus.Cancelled);
            declined.CreatedAt = T(12);
            declined.CancelledBy = buyer.Id;
            declined.CancelReason = DealService.DeclinedReason;
            declined.UpdatedAt = T(13);

            var disputedListing = Rows.Listing(seller);
            disputedListing.CreatedAt = T(14);
            var disputed = Rows.Deal(disputedListing, buyer, DealStatus.Disputed, shippedAt: T(16));
            disputed.CreatedAt = T(15);
            disputed.DisputedAt = T(17);

            var report = new Report
            {
                Id = Guid.NewGuid(), ReporterId = buyer.Id, TargetType = ReportTargetType.Listing, TargetId = disputedListing.Id, TargetOwnerId = seller.Id,
                ListingId = disputedListing.Id, Rule = ReportRule.ScamOrFraud, Reason = "Sold me an empty parcel on purpose.", Status = ReportStatus.Open, CreatedAt = T(18),
            };
            Db.Context.Reports.Add(report);
            Db.Context.SaveChanges();

            var inserted = await Run();

            var sellerEvents = Events(seller);
            var buyerEvents = Events(buyer);
            Assert.Equal(new List<(string, DateTime)>
            {
                ("collection.created", T(0)), ("item.added", T(1)), ("comment.replied", T(4)), ("listing.posted", T(5)), ("deal.proposed", T(6)),
                ("deal.shipped", T(7)), ("review.replied", T(10)), ("listing.posted", T(11)), ("deal.proposed", T(12)), ("listing.posted", T(14)),
                ("deal.proposed", T(15)), ("deal.shipped", T(16)),
            }, KindsAndTimes(sellerEvents));
            Assert.Equal(new List<(string, DateTime)>
            {
                ("follow.followed", T(2)), ("comment.posted", T(3)), ("deal.receiptConfirmed", T(8)), ("review.written", T(9)),
                ("deal.declined", T(13)), ("deal.disputed", T(17)), ("report.filed", T(18)),
            }, KindsAndTimes(buyerEvents));
            Assert.Equal(sellerEvents.Count + buyerEvents.Count, inserted);
            Assert.All(sellerEvents.Concat(buyerEvents), e => Assert.True(e.Backfilled));

            var shipped = sellerEvents.First(e => e.Kind == "deal.shipped");
            Assert.Equal((deal.Id, deal.ConversationId, listing.Id, buyer.Id), (shipped.DealId!.Value, shipped.ConversationId!.Value, shipped.ListingId!.Value, shipped.OtherUserId!.Value));
            var written = buyerEvents.Single(e => e.Kind == "review.written");
            Assert.Equal((review.Id, deal.Id, seller.Id), (written.ReviewId!.Value, written.DealId!.Value, written.OtherUserId!.Value));
            Assert.Contains("\"stars\":4", written.Details);
            var posted = buyerEvents.Single(e => e.Kind == "comment.posted");
            Assert.Equal((comment.Id, item.Id), (posted.CommentId!.Value, posted.ItemId!.Value));
            var filed = buyerEvents.Single(e => e.Kind == "report.filed");
            Assert.Equal((report.Id, disputedListing.Id), (filed.ReportId!.Value, filed.ListingId!.Value));
        }

        [Fact]
        public async Task BackfillSkipsDeletedUsers()
        {
            var gone = Db.AddUser("gone");
            var live = Db.AddUser("live");
            var collection = Db.AddCollection(gone);
            Db.Follow(live, collection);
            gone.DeletedAt = T(0);
            collection.DeletedAt = T(0);
            Db.Context.SaveChanges();

            await Run();

            Assert.Empty(Events(gone));
            Assert.Equal(new[] { "follow.followed" }, Events(live).Select(e => e.Kind));
        }

        [Fact]
        public async Task BackfillIsIdempotent()
        {
            var me = Db.AddUser("me");
            Db.AddItem(Db.AddCollection(me));

            var first = await Run();
            var second = await Run();

            Assert.Equal(2, first);
            Assert.Equal(0, second);
            Assert.Equal(2, Events(me).Count);
        }

        [Fact]
        public async Task BackfillLeavesLikesOut()
        {
            var owner = Db.AddUser("owner");
            var fan = Db.AddUser("fan");
            var item = Db.AddItem(Db.AddCollection(owner));
            Db.Context.Reactions.Add(new ReactionProvided(fan.Id, item.Id, true, 5));
            Db.Context.SaveChanges();

            await Run();

            Assert.Empty(Events(fan));
        }

        [Fact]
        public async Task BackfillSkipsWhatWasAlreadyRecordedLive()
        {
            // Live recording started before the fill ever ran: rows dated from the first live entry on were logged then.
            var me = Db.AddUser("me");
            var old = Db.AddCollection(me);
            old.CreatedAt = T(0);
            var recent = Db.AddCollection(me);
            recent.CreatedAt = T(10);
            Db.Context.ActivityEvents.Add(new ActivityEvent
            {
                Id = Guid.NewGuid(), UserId = me.Id, Kind = "collection.created", Category = "collection", OccurredAt = T(10), CollectionId = recent.Id,
            });
            Db.Context.SaveChanges();

            var inserted = await Run();

            Assert.Equal(1, inserted);
            Assert.Equal(new Guid?[] { old.Id, recent.Id }, Events(me).Select(e => e.CollectionId));
        }

        public void Dispose() => Db.Dispose();
    }
}
