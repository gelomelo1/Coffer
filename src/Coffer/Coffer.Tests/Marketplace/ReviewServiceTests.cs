using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Reputation;
using Coffer.BusinessLogic.Marketplace.Reviews;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    public class ReviewServiceTests : DealTestBase
    {
        private ReviewService Reviews() => new(Db.Context, Clock, Sut(), new ResponsivenessService(Db.Context, Clock));

        private static ReviewInput Good(int stars = 5) => new(stars, null, "Smooth deal, recommended.");
        private static ReviewInput Bad(string comment) => new(2, ReviewReasonTag.LateToMeetup, comment);

        private async Task<DealDto> Completed() => await CompletedPickupDeal();

        [Fact]
        public async Task Submit_WithoutCompletedDeal_Conflicts()
        {
            var deal = await ActiveDeal(DeliveryMethod.LocalPickup);
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reviews().SubmitAsync(Buyer.Id, deal.Id, Good())));
        }

        [Fact]
        public async Task Submit_ByOutsider_Forbidden()
        {
            var deal = await Completed();
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Reviews().SubmitAsync(Db.AddUser("outsider").Id, deal.Id, Good())));
        }

        [Fact]
        public async Task Submit_AfterDeadline_Conflicts()
        {
            var deal = await Completed();
            Clock.Advance(TimeSpan.FromDays(14).Add(TimeSpan.FromMinutes(1)));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reviews().SubmitAsync(Buyer.Id, deal.Id, Good())));
        }

        [Fact]
        public async Task Submit_Twice_Conflicts()
        {
            var deal = await Completed();
            await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good());
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reviews().SubmitAsync(Buyer.Id, deal.Id, Good(4))));
        }

        [Fact]
        public async Task Submit_TargetsTheOtherParty()
        {
            var deal = await Completed();
            var review = await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good());
            Assert.Equal(Seller.Id, review.Reviewee.Id);
            Assert.Equal(ReviewerRole.Buyer, review.ReviewerRole);
        }

        [Fact]
        public async Task LowRating_RequiresReasonAnd20Chars()
        {
            var deal = await Completed();
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reviews().SubmitAsync(Buyer.Id, deal.Id, Bad(new string('x', 19)))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reviews().SubmitAsync(Buyer.Id, deal.Id, Bad("   " + new string('x', 19) + "   "))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reviews().SubmitAsync(Buyer.Id, deal.Id, new ReviewInput(1, null, new string('x', 30)))));

            var ok = await Reviews().SubmitAsync(Buyer.Id, deal.Id, Bad(new string('x', 20)));
            Assert.Equal(ReviewReasonTag.LateToMeetup, ok.ReasonTag);
        }

        [Fact]
        public async Task HighRating_NeedsNoComment()
        {
            var deal = await Completed();
            var ok = await Reviews().SubmitAsync(Buyer.Id, deal.Id, new ReviewInput(3, null, null));
            Assert.Equal(3, ok.Stars);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(6)]
        public async Task Stars_OutOfRange_Validation(int stars)
        {
            var deal = await Completed();
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reviews().SubmitAsync(Buyer.Id, deal.Id, Good(stars))));
        }

        [Fact]
        public async Task FirstReview_HiddenFromOtherParty()
        {
            var deal = await Completed();
            await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good());

            var sellerView = await Reviews().GetForDealAsync(Seller.Id, deal.Id);
            Assert.Null(sellerView.Theirs);
            Assert.True(sellerView.TheyHaveSubmitted);
            Assert.True(sellerView.CanReview);
            Assert.Empty(await Reviews().GetForUserAsync(Seller.Id));

            var buyerView = await Reviews().GetForDealAsync(Buyer.Id, deal.Id);
            Assert.NotNull(buyerView.Mine);
            Assert.Null(buyerView.Mine!.PublishedAt);
        }

        [Fact]
        public async Task SecondReview_PublishesBoth()
        {
            var deal = await Completed();
            await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good());
            await Reviews().SubmitAsync(Seller.Id, deal.Id, Good(4));

            var sellerView = await Reviews().GetForDealAsync(Seller.Id, deal.Id);
            Assert.Equal(5, sellerView.Theirs!.Stars);
            Assert.NotNull(sellerView.Mine!.PublishedAt);
            Assert.Single(await Reviews().GetForUserAsync(Seller.Id));
            Assert.Single(await Reviews().GetForUserAsync(Buyer.Id));
        }

        [Fact]
        public async Task Deadline_PublishesSingleReview()
        {
            var deal = await Completed();
            await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good());

            Clock.Advance(TimeSpan.FromDays(14).Add(TimeSpan.FromMinutes(1)));

            Assert.Single(await Reviews().GetForUserAsync(Seller.Id));
            var sellerView = await Reviews().GetForDealAsync(Seller.Id, deal.Id);
            Assert.NotNull(sellerView.Theirs);
            Assert.False(sellerView.CanReview);
        }

        [Fact]
        public async Task BothReviewsSavedUnpublished_ByConcurrentSubmits_ArePublishedOnNextRead()
        {
            // Simulates two simultaneous submits: each saw no review from the other side, so neither got published.
            var deal = await Completed();
            foreach (var (reviewer, reviewee, role) in new[] { (Buyer, Seller, ReviewerRole.Buyer), (Seller, Buyer, ReviewerRole.Seller) })
                Db.Context.Reviews.Add(new Review
                {
                    DealId = deal.Id, ReviewerId = reviewer.Id, RevieweeId = reviewee.Id, ReviewerRole = role, Stars = 5, CreatedAt = Clock.UtcNow,
                });
            Db.Context.SaveChanges();

            Assert.Single(await Reviews().GetForUserAsync(Seller.Id));
            Assert.NotNull((await Reviews().GetForDealAsync(Buyer.Id, deal.Id)).Theirs);
        }

        [Fact]
        public async Task Sweep_PublishesDueReviews()
        {
            var deal = await Completed();
            await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good());
            Clock.Advance(TimeSpan.FromDays(15));

            await Reviews().SweepAsync();

            Assert.NotNull(Db.NewContext().Reviews.Single().PublishedAt);
        }

        [Fact]
        public async Task Reply_OnlyRevieweeOnceAfterPublish()
        {
            var deal = await Completed();
            var review = await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good());

            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reviews().ReplyAsync(Seller.Id, review.Id, "Thanks!")));
            await Reviews().SubmitAsync(Seller.Id, deal.Id, Good());

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Reviews().ReplyAsync(Buyer.Id, review.Id, "Thanks!")));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Reviews().ReplyAsync(Seller.Id, review.Id, new string('x', 501))));
            var replied = await Reviews().ReplyAsync(Seller.Id, review.Id, "Thanks, pleasure!");
            Assert.Equal("Thanks, pleasure!", replied.Reply);
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Reviews().ReplyAsync(Seller.Id, review.Id, "Again")));
        }

        [Fact]
        public async Task Review_AllowedOnDisputedDeal()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            await Sut().DisputeAsync(Buyer.Id, deal.Id, "The parcel never arrived, tracking stuck for 10 days.");

            var review = await Reviews().SubmitAsync(Buyer.Id, deal.Id, new ReviewInput(1, ReviewReasonTag.Other, "Parcel never arrived and seller went silent."));
            Assert.Equal(Seller.Id, review.Reviewee.Id);
            Assert.True((await Reviews().GetForDealAsync(Seller.Id, deal.Id)).CanReview);
        }

        [Fact]
        public async Task Reputation_CountsOnlyPublishedUnfrozenUnremoved()
        {
            var deal = await Completed();
            await Reviews().SubmitAsync(Buyer.Id, deal.Id, Good(4));

            var hidden = await Reviews().GetReputationAsync(Seller.Id);
            Assert.Null(hidden.Average);
            Assert.Equal(0, hidden.Count);
            Assert.Equal(1, hidden.CompletedDeals);

            await Reviews().SubmitAsync(Seller.Id, deal.Id, Good());
            Assert.Equal(4, (await Reviews().GetReputationAsync(Seller.Id)).Average);

            var stored = Db.Context.Reviews.Single(r => r.RevieweeId == Seller.Id);
            stored.IsRemoved = true;
            Db.Context.SaveChanges();
            Assert.Null((await Reviews().GetReputationAsync(Seller.Id)).Average);
        }

        [Fact]
        public async Task ShippingDeal_AutoCompleted_UnlocksReviews()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "gls", "GLS123456", null);
            Clock.Advance(TimeSpan.FromDays(14).Add(TimeSpan.FromMinutes(1)));

            var review = await Reviews().SubmitAsync(Seller.Id, deal.Id, Good());
            Assert.Equal(Buyer.Id, review.Reviewee.Id);
        }
    }
}
