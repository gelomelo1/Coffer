using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Reviews;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    [Route("api/[controller]")]
    public class ReviewsController : MarketplaceControllerBase
    {
        private readonly IReviewService _reviews;

        public ReviewsController(IReviewService reviews)
        {
            _reviews = reviews;
        }

        [HttpPost("/api/Deals/{dealId:guid}/Reviews")]
        public async Task<ActionResult<ReviewDto>> Submit(Guid dealId, [FromBody] ReviewInput input)
            => Ok(await _reviews.SubmitAsync(Me, dealId, input));

        [HttpGet("/api/Deals/{dealId:guid}/Reviews")]
        public async Task<ActionResult<DealReviewsDto>> ForDeal(Guid dealId) => Ok(await _reviews.GetForDealAsync(Me, dealId));

        [HttpPost("{id:guid}/Reply")]
        public async Task<ActionResult<ReviewDto>> Reply(Guid id, [FromBody] TextInput input)
            => Ok(await _reviews.ReplyAsync(Me, id, input.Text));

        [HttpGet("/api/Users/{userId:guid}/MarketReviews")]
        public async Task<ActionResult<List<ReviewDto>>> ForUser(Guid userId) => Ok(await _reviews.GetForUserAsync(userId));

        [HttpGet("/api/Users/{userId:guid}/Reputation")]
        public async Task<ActionResult<ReputationDto>> Reputation(Guid userId) => Ok(await _reviews.GetReputationAsync(userId));
    }
}
