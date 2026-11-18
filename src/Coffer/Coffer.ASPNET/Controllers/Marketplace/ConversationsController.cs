using Coffer.BusinessLogic.Marketplace.Messaging;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    [Route("api/[controller]")]
    public class ConversationsController : MarketplaceControllerBase
    {
        private readonly IConversationService _conversations;

        public ConversationsController(IConversationService conversations)
        {
            _conversations = conversations;
        }

        /// <summary>Open (or return the existing) chat with the owner of a listing.</summary>
        [HttpPost("/api/Listings/{listingId:guid}/Conversations")]
        public async Task<ActionResult<ConversationDto>> OpenForListing(Guid listingId)
            => Ok(await _conversations.OpenAsync(Me, ListingConversationPolicy.Type, listingId));

        [HttpGet]
        public async Task<ActionResult<Coffer.Domain.Paging.PagedList<ConversationSummaryDto>>> Inbox([FromQuery] int? page = null, [FromQuery] int? pageSize = null, [FromQuery] Guid? subjectId = null)
            => Ok(await _conversations.ListMinePageAsync(Me, page, pageSize, subjectId));

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ConversationDto>> Get(Guid id) => Ok(await _conversations.GetAsync(Me, id));

        [HttpGet("{id:guid}/Messages")]
        public async Task<ActionResult<MessagePageDto>> Messages(Guid id, [FromQuery] DateTime? before, [FromQuery] int? pageSize = null)
            => Ok(await _conversations.GetMessagesPageAsync(Me, id, before, pageSize));

        [HttpPost("{id:guid}/Messages")]
        public async Task<ActionResult<MessageDto>> Post(Guid id, [FromBody] PostMessageInput input)
            => Ok(await _conversations.PostAsync(Me, id, input));

        [HttpPost("{id:guid}/Messages/{messageId:guid}/Respond")]
        public async Task<ActionResult<MessageDto>> Respond(Guid id, Guid messageId, [FromBody] RespondInput input)
            => Ok(await _conversations.RespondAsync(Me, id, messageId, input.Action));

        [HttpPost("{id:guid}/Read")]
        public async Task<IActionResult> Read(Guid id)
        {
            await _conversations.MarkReadAsync(Me, id);
            return NoContent();
        }
    }
}
