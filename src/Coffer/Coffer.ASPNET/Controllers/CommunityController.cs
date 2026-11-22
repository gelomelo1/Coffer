using Coffer.ASPNET.Controllers.Marketplace;
using Coffer.BusinessLogic.Community.Stats;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>The Community tab: Stats &amp; facts for signed-in users.</summary>
    [Route("api/[controller]")]
    public class CommunityController : MarketplaceControllerBase
    {
        private readonly ICommunityStatsService _stats;

        public CommunityController(ICommunityStatsService stats)
        {
            _stats = stats;
        }

        [HttpGet("Stats")]
        public async Task<ActionResult<CommunityStatsDto>> Stats() => Ok(await _stats.GetAsync(Me));
    }
}
