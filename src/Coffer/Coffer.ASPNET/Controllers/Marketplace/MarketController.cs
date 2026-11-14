using Coffer.BusinessLogic.Marketplace.Terms;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    [Route("api/[controller]")]
    public class MarketController : MarketplaceControllerBase
    {
        private readonly TermsService _terms;

        public MarketController(TermsService terms)
        {
            _terms = terms;
        }

        [HttpGet("Terms")]
        public async Task<ActionResult<TermsStatusDto>> Terms() => Ok(await _terms.GetAsync(Me));

        [HttpPost("Terms/Accept")]
        public async Task<ActionResult<TermsStatusDto>> Accept([FromBody] AcceptTermsInput input) => Ok(await _terms.AcceptAsync(Me, input));
    }
}
