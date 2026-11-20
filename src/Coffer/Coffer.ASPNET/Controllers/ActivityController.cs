using Coffer.ASPNET.Controllers.Marketplace;
using Coffer.BusinessLogic.Activity;
using Coffer.Domain.Paging;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>My activity: the caller's own log only (there is no way to ask for anyone else's).</summary>
    [Route("api/[controller]")]
    public class ActivityController : MarketplaceControllerBase
    {
        private readonly IActivityQueryService _activity;

        public ActivityController(IActivityQueryService activity)
        {
            _activity = activity;
        }

        [HttpGet]
        public async Task<ActionResult<PagedList<ActivityEntryDto>>> List([FromQuery] string? category = null, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
            => Ok(await _activity.GetPageAsync(Me, category, page, pageSize));

        [HttpGet("Summary")]
        public async Task<ActionResult<List<ActivityCategoryDto>>> Summary() => Ok(await _activity.GetSummaryAsync(Me));
    }
}
