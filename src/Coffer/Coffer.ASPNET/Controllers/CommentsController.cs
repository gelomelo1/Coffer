using Coffer.ASPNET.Controllers.Marketplace;
using Coffer.BusinessLogic.Community;
using Coffer.BusinessLogic.Moderation;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>Comments on collection items: one API for the feed card sheet and the item details page.</summary>
    [Route("api/Items/{itemId:guid}/Comments")]
    public class CommentsController : MarketplaceControllerBase
    {
        private readonly IItemCommentService _comments;

        public CommentsController(IItemCommentService comments)
        {
            _comments = comments;
        }

        [HttpGet]
        public async Task<ActionResult<CommentPageDto>> List(Guid itemId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
            => Ok(await _comments.ListAsync(Me, itemId, page, pageSize));

        [HttpPost]
        public async Task<ActionResult<CommentDto>> Create(Guid itemId, [FromBody] CreateCommentInput input)
            => Ok(await _comments.CreateAsync(Me, itemId, input));

        [HttpPut("{commentId:guid}")]
        public async Task<ActionResult<CommentDto>> Update(Guid itemId, Guid commentId, [FromBody] UpdateCommentInput input)
            => Ok(await _comments.UpdateAsync(Me, itemId, commentId, input));

        [HttpDelete("{commentId:guid}")]
        public async Task<IActionResult> Delete(Guid itemId, Guid commentId)
        {
            await _comments.DeleteAsync(Me, itemId, commentId);
            return NoContent();
        }
    }

    [Route("api/Comments")]
    public class CommentLookupController : MarketplaceControllerBase
    {
        private readonly IItemCommentService _comments;

        public CommentLookupController(IItemCommentService comments)
        {
            _comments = comments;
        }

        /// <summary>Visible comment counts for feed cards: ?itemIds=a&amp;itemIds=b.</summary>
        [HttpGet("Counts")]
        public async Task<ActionResult<Dictionary<Guid, int>>> Counts([FromQuery] List<Guid> itemIds)
            => Ok(await _comments.CountAsync(itemIds.Take(200)));

        /// <summary>Users to suggest after "@" while typing.</summary>
        [HttpGet("Mentionable")]
        public async Task<ActionResult<List<MentionDto>>> Mentionable([FromQuery] string? query, [FromQuery] int limit = 8)
            => Ok(await _comments.MentionableAsync(Me, query, limit));
    }

    /// <summary>The signed-in user's own account state.</summary>
    [Route("api/Account")]
    public class AccountController : MarketplaceControllerBase
    {
        private readonly ISuspensionService _suspensions;

        public AccountController(ISuspensionService suspensions)
        {
            _suspensions = suspensions;
        }

        /// <summary>Active suspension or 204. Reachable while suspended so the app can explain why.</summary>
        [HttpGet("Suspension")]
        public async Task<IActionResult> Suspension()
        {
            var active = await _suspensions.GetActiveAsync(Me);
            return active == null ? NoContent() : Ok(active);
        }
    }
}
