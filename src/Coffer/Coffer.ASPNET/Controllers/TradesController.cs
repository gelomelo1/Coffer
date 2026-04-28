using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class TradesController : GenericController<Guid, TradeProvided, TradeProvided, TradeRequired>
    {
        private readonly ITradesRepository _tradeRepository;
        public TradesController(ITradesRepository repository, IPermissionService<Guid, TradeRequired> permissionService) : base(repository, permissionService)
        {
            _tradeRepository = repository;
        }

        [HttpPut("{id}")]
        public override async Task<ActionResult<TradeProvided>> Update(Guid id, [FromBody] TradeRequired required)
        {
            var item = await _tradeRepository.UpdateTradeAsync(id, required);
            if (item == null) return NotFound();
            return Ok(item);
        }

        [HttpGet("Search/{userId}")]
        public virtual async Task<ActionResult<IEnumerable<TradeProvided>>> GetSeachTrades(Guid userId, [FromQuery] string? filter = null,
                                                                            [FromQuery] string? orderBy = null,
                                                                            [FromQuery] int? page = null,
                                                                            [FromQuery] int? pageSize = null)
        {
            var items = await _tradeRepository.GetSearchTradesAsync(userId, filter, orderBy, page, pageSize);
            return Ok(items);
        }
    }
}
