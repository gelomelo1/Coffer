using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    [Route("api/[controller]")]
    public class DealsController : MarketplaceControllerBase
    {
        private const long MaxPhotoBytes = 10L * 1024 * 1024;
        private readonly IDealService _deals;
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;

        public DealsController(IDealService deals, IImageService images, MarketplaceStorage storage)
        {
            _deals = deals;
            _images = images;
            _storage = storage;
        }

        [HttpGet("Carriers")]
        public ActionResult<IReadOnlyList<CarrierDto>> CarrierList() => Ok(Carriers.List());

        [HttpPost]
        public async Task<ActionResult<DealDto>> Propose([FromBody] ProposeDealInput input)
            => Ok(await _deals.ProposeAsync(Me, input.ConversationId, input.Method));

        [HttpGet("Mine")]
        public async Task<ActionResult<List<DealDto>>> Mine() => Ok(await _deals.GetMineAsync(Me));

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<DealDto>> Get(Guid id) => Ok(await _deals.GetAsync(Me, id));

        [HttpPost("{id:guid}/Accept")]
        public async Task<ActionResult<DealDto>> Accept(Guid id) => Ok(await _deals.AcceptAsync(Me, id));

        [HttpPost("{id:guid}/Decline")]
        public async Task<ActionResult<DealDto>> Decline(Guid id) => Ok(await _deals.DeclineAsync(Me, id));

        [HttpPost("{id:guid}/Cancel")]
        public async Task<ActionResult<DealDto>> Cancel(Guid id, [FromBody] ReasonInput? input)
            => Ok(await _deals.CancelAsync(Me, id, input?.Reason));

        [HttpPost("{id:guid}/ConfirmHandoff")]
        public async Task<ActionResult<DealDto>> ConfirmHandoff(Guid id, [FromBody] PinInput input)
            => Ok(await _deals.ConfirmHandoffAsync(Me, id, input.Pin));

        /// <summary>multipart/form-data: carrier, trackingNumber, optional photo.</summary>
        [HttpPost("{id:guid}/Ship")]
        [RequestSizeLimit(MaxPhotoBytes)]
        [ManualForm]
        public async Task<ActionResult<DealDto>> Ship([FromRoute] Guid id)
        {
            var form = await OptionalFormAsync();
            return Ok(await _deals.ShipAsync(Me, id, form["carrier"].ToString(), form["trackingNumber"].ToString(), form.Files.GetFile("photo")));
        }

        /// <summary>multipart/form-data: optional photo of the received item (an empty body is fine).</summary>
        [HttpPost("{id:guid}/ConfirmReceipt")]
        [RequestSizeLimit(MaxPhotoBytes)]
        [ManualForm]
        public async Task<ActionResult<DealDto>> ConfirmReceipt([FromRoute] Guid id)
        {
            var form = await OptionalFormAsync();
            return Ok(await _deals.ConfirmReceiptAsync(Me, id, form.Files.GetFile("photo")));
        }

        [HttpPost("{id:guid}/Dispute")]
        public async Task<ActionResult<DealDto>> Dispute(Guid id, [FromBody] ReasonInput input)
            => Ok(await _deals.DisputeAsync(Me, id, input.Reason ?? ""));

        /// <summary>Shipment/receipt photos: visible only to the two parties and moderators.</summary>
        [HttpGet("Image/{fileName}")]
        public async Task<IActionResult> Image(string fileName)
        {
            if (!await _deals.CanViewPhotoAsync(Me, fileName)) return NotFound();
            try
            {
                var (bytes, contentType) = await _images.GetImageAsync(fileName, _storage.DealImages);
                return File(bytes, contentType);
            }
            catch (Exception e) when (e is FileNotFoundException or ArgumentException or DirectoryNotFoundException)
            {
                return NotFound();
            }
        }
    }
}
