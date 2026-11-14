using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.Tests.Marketplace
{
    public class ModelTests : MarketplaceTestBase
    {
        private string RawScalar(string sql)
        {
            using var cmd = Db.Connection.CreateCommand();
            cmd.CommandText = sql;
            return Convert.ToString(cmd.ExecuteScalar())!;
        }

        private Deal NewDeal(Listing listing, Guid buyerId, DealStatus status) => new()
        {
            ListingId = listing.Id,
            ConversationId = AddConversation(listing).Id,
            SellerId = listing.OwnerId,
            BuyerId = buyerId,
            Method = DeliveryMethod.LocalPickup,
            Status = status,
            CreatedAt = Clock.UtcNow,
            UpdatedAt = Clock.UtcNow,
        };

        private Conversation AddConversation(Listing listing)
        {
            var c = new Conversation { SubjectType = "listing", SubjectId = listing.Id, CreatedAt = Clock.UtcNow, LastMessageAt = Clock.UtcNow };
            Db.Context.Conversations.Add(c);
            Db.Context.SaveChanges();
            return c;
        }

        [Fact]
        public void Enums_PersistAsSnakeCaseText()
        {
            AddListing(Db.AddUser("seller"), status: ListingStatus.PendingPickup);

            Assert.Equal("pending_pickup", RawScalar("SELECT status FROM listings"));
            Assert.Equal("sell", RawScalar("SELECT kind FROM listings"));
            Assert.Equal(ListingStatus.PendingPickup, Db.NewContext().Listings.Single().Status);
        }

        [Fact]
        public void Deal_OnlyOneOpenDealPerListing_UniqueIndex()
        {
            var listing = AddListing(Db.AddUser("seller"));
            Db.Context.Deals.Add(NewDeal(listing, Db.AddUser("b1").Id, DealStatus.Proposed));
            Db.Context.SaveChanges();

            Db.Context.Deals.Add(NewDeal(listing, Db.AddUser("b2").Id, DealStatus.Proposed));
            Assert.Throws<DbUpdateException>(() => Db.Context.SaveChanges());
        }

        [Fact]
        public void Deal_TerminalDealsDoNotBlockNewOnes()
        {
            var listing = AddListing(Db.AddUser("seller"));
            Db.Context.Deals.Add(NewDeal(listing, Db.AddUser("b1").Id, DealStatus.Cancelled));
            Db.Context.Deals.Add(NewDeal(listing, Db.AddUser("b2").Id, DealStatus.Proposed));
            Db.Context.SaveChanges();

            Assert.Equal(2, Db.NewContext().Deals.Count());
        }

        [Fact]
        public void Disputed_DoesNotBlockNewOpenDeal()
        {
            var listing = AddListing(Db.AddUser("seller"));
            Db.Context.Deals.Add(NewDeal(listing, Db.AddUser("b1").Id, DealStatus.Disputed));
            Db.Context.Deals.Add(NewDeal(listing, Db.AddUser("b2").Id, DealStatus.Proposed));
            Db.Context.SaveChanges();

            Assert.Equal(2, Db.NewContext().Deals.Count());
        }

        [Fact]
        public void Report_And_ModerationAction_PersistSnakeCaseEnums()
        {
            var reporter = Db.AddUser("reporter");
            var owner = Db.AddUser("owner");
            var listing = AddListing(owner);
            Db.Context.Reports.Add(new Report
            {
                ReporterId = reporter.Id, TargetType = ReportTargetType.Listing, TargetId = listing.Id, TargetOwnerId = owner.Id,
                ListingId = listing.Id, Rule = ReportRule.ScamOrFraud, Reason = "Looks like a scam listing", Snapshot = "{}",
                Status = ReportStatus.Open, CreatedAt = Clock.UtcNow,
            });
            Db.Context.ModerationActions.Add(new ModerationAction
            {
                UserId = owner.Id, TargetType = ReportTargetType.Listing, TargetId = listing.Id, ListingId = listing.Id,
                Rule = ReportRule.Counterfeit, Statement = "Replica sold as original", ContentExcerpt = "x", CreatedAt = Clock.UtcNow,
            });
            Db.Context.SaveChanges();

            Assert.Equal("scam_or_fraud", RawScalar("SELECT rule FROM reports"));
            Assert.Equal("listing", RawScalar("SELECT target_type FROM moderation_actions"));
            listing.Status = ListingStatus.Removed;
            Db.Context.SaveChanges();
            Assert.Equal("removed", RawScalar("SELECT status FROM listings"));
        }

        [Fact]
        public void Review_UniquePerDealAndReviewer()
        {
            var seller = Db.AddUser("seller");
            var buyer = Db.AddUser("buyer");
            var listing = AddListing(seller);
            var deal = NewDeal(listing, buyer.Id, DealStatus.Completed);
            Db.Context.Deals.Add(deal);
            Db.Context.SaveChanges();

            Review NewReview() => new()
            {
                DealId = deal.Id, ReviewerId = buyer.Id, RevieweeId = seller.Id, ReviewerRole = ReviewerRole.Buyer,
                Stars = 5, CreatedAt = Clock.UtcNow,
            };
            Db.Context.Reviews.Add(NewReview());
            Db.Context.SaveChanges();
            Db.Context.Reviews.Add(NewReview());

            Assert.Throws<DbUpdateException>(() => Db.Context.SaveChanges());
        }

        [Fact]
        public void Review_LowRatingWithoutContext_RejectedByCheckConstraint()
        {
            var seller = Db.AddUser("seller");
            var buyer = Db.AddUser("buyer");
            var deal = NewDeal(AddListing(seller), buyer.Id, DealStatus.Completed);
            Db.Context.Deals.Add(deal);
            Db.Context.SaveChanges();

            Db.Context.Reviews.Add(new Review
            {
                DealId = deal.Id, ReviewerId = buyer.Id, RevieweeId = seller.Id, ReviewerRole = ReviewerRole.Buyer,
                Stars = 1, Comment = "too short", CreatedAt = Clock.UtcNow,
            });

            Assert.Throws<DbUpdateException>(() => Db.Context.SaveChanges());
        }
    }
}
