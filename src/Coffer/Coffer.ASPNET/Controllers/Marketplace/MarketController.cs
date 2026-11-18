using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Marketplace.Terms;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    [Route("api/[controller]")]
    public class MarketController : MarketplaceControllerBase
    {
        private readonly TermsService _terms;
        private readonly IConversationService _conversations;
        private readonly IDealService _deals;

        public MarketController(TermsService terms, IConversationService conversations, IDealService deals)
        {
            _terms = terms;
            _conversations = conversations;
            _deals = deals;
        }

        /// <summary>Unread chat messages and deals waiting for me, for the marketplace tab badges.</summary>
        [HttpGet("Badges")]
        public async Task<ActionResult<MarketBadgesDto>> Badges()
        {
            var unread = (await _conversations.ListMineAsync(Me)).Sum(c => c.UnreadCount);
            var actionable = (await _deals.GetMineAsync(Me)).Count(d => d.NextActions.Any(a => a != "cancel"));
            return Ok(new MarketBadgesDto(unread, actionable));
        }

        [HttpGet("Terms")]
        public async Task<ActionResult<TermsStatusDto>> Terms() => Ok(await _terms.GetAsync(Me));

        [HttpPost("Terms/Accept")]
        public async Task<ActionResult<TermsStatusDto>> Accept([FromBody] AcceptTermsInput input) => Ok(await _terms.AcceptAsync(Me, input));
    }
}
