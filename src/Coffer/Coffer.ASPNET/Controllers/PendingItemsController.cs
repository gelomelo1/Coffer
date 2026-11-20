using Coffer.ASPNET.Controllers.Marketplace;
using Coffer.BusinessLogic.Pending;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>The signed-in user's waiting-for-review list (caps the AI found on uploaded photos). Owner only.</summary>
    public class PendingItemsController : MarketplaceControllerBase
    {
        private readonly IPendingItemService _pending;
        private readonly IImageService _images;

        public PendingItemsController(IPendingItemService pending, IImageService images)
        {
            _pending = pending;
            _images = images;
        }

        [HttpGet("/api/Collections/{collectionId:guid}/Pending")]
        public async Task<ActionResult<Coffer.Domain.Paging.PagedList<PendingItemDto>>> List(Guid collectionId, [FromQuery] int? page, [FromQuery] int? pageSize)
            => Ok(await _pending.ListAsync(Me, collectionId, page, pageSize));

        [HttpGet("/api/Pending/Summary")]
        public async Task<ActionResult<List<PendingSummaryDto>>> Summary() => Ok(await _pending.SummaryAsync(Me));

        [HttpGet("/api/Pending/Image/{id:guid}")]
        public async Task<IActionResult> Image(Guid id)
        {
            var file = await _pending.ImageAsync(Me, id);
            try
            {
                var (bytes, contentType) = await _images.GetImageAsync(file, PendingItemService.PendingFolder);
                return File(bytes, contentType);
            }
            catch (FileNotFoundException)
            {
                return NotFound();
            }
        }

        [HttpPost("/api/Pending/{id:guid}/Add")]
        public async Task<ActionResult<ItemProvided>> Add(Guid id, [FromBody] AddPendingInput input) => Ok(await _pending.AddAsync(Me, id, input));

        [HttpDelete("/api/Pending/{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _pending.DeleteAsync(Me, id);
            return NoContent();
        }
    }
}
