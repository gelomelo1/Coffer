using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class TradeReviewsController : GenericController<Guid, TradeReviewProvided, TradeReviewProvided, TradeReviewRequired>
    {
        private readonly ITradeReviewRepository _tradeReviewRepository;
        public TradeReviewsController(ITradeReviewRepository repository) : base(repository)
        {
            _tradeReviewRepository = repository;
        }

        [HttpGet("Trade/{tradeId}")]
        public async Task<ActionResult<TradeReviewPack>> GetTradeReviewByTrade(Guid tradeId)
        {
            var result = await _tradeReviewRepository.GetTradeReviewByTrade(tradeId);
            return Ok(result);
        }

        [HttpGet("User/{userId}")]
        public async Task<ActionResult<IEnumerable<TradeReviewPack>>> GetTradeReviewsForUser(Guid userId)
        {
            var results = await _tradeReviewRepository.GetTradeReviewsForUser(userId);
            return Ok(results);
        }
    }
}
