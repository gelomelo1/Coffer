using Coffer.ASPNET.Controllers.Marketplace;
using Coffer.BusinessLogic.Contribution;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>Shape What's Next for signed-in users: the page's state, voting, photo uploads, example galleries.</summary>
    [Route("api/[controller]")]
    public class ContributionController : MarketplaceControllerBase
    {
        private readonly IContributionService _contribution;

        public ContributionController(IContributionService contribution)
        {
            _contribution = contribution;
        }

        [HttpGet]
        public async Task<ActionResult<ContributionStateDto>> Get() => Ok(await _contribution.GetAsync(Me));

        [HttpPut("Vote")]
        public async Task<ActionResult<MyVoteDto>> Vote([FromBody] VoteInput input) => Ok(await _contribution.VoteAsync(Me, input));
    }
}
