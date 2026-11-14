using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.Domain.Marketplace;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    [Route("api/[controller]")]
    public class ListingsController : MarketplaceControllerBase
    {
        private const long MaxUploadBytes = 60L * 1024 * 1024;
        private readonly IListingService _listings;
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;

        public ListingsController(IListingService listings, IImageService images, MarketplaceStorage storage)
        {
            _listings = listings;
            _images = images;
            _storage = storage;
        }

        [HttpGet]
        public async Task<ActionResult<List<ListingSummaryDto>>> Search(
            [FromQuery] string? kind, [FromQuery] int? collectionTypeId, [FromQuery] int? cityId, [FromQuery] double? radiusKm,
            [FromQuery] int? minPriceCents, [FromQuery] int? maxPriceCents, [FromQuery] string? condition,
            [FromQuery] string? delivery, [FromQuery] string? sort, [FromQuery] List<string>? sellerCountry,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var query = new ListingQuery
            {
                Kind = ParseEnum<ListingKind>(kind, "listing kind"),
                CollectionTypeId = collectionTypeId,
                CityId = cityId,
                RadiusKm = radiusKm,
                MinPriceCents = minPriceCents,
                MaxPriceCents = maxPriceCents,
                Condition = ParseEnum<ListingCondition>(condition, "condition"),
                Delivery = ParseEnum<DeliveryMethod>(delivery, "delivery method"),
                SellerCountries = sellerCountry ?? new List<string>(),
                Sort = sort,
                Page = page,
                PageSize = pageSize,
            };
            return Ok(await _listings.SearchAsync(Me, query));
        }

        [HttpGet("Mine")]
        public async Task<ActionResult<List<ListingSummaryDto>>> Mine([FromQuery] string? filter) => Ok(await _listings.GetMineAsync(Me, filter));

        /// <summary>{ active, sold, archived } counts for the My Listings filter chips.</summary>
        [HttpGet("Mine/Counts")]
        public async Task<ActionResult<Dictionary<string, int>>> MineCounts() => Ok(await _listings.CountMineAsync(Me));

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ListingDetailDto>> Get(Guid id) => Ok(await _listings.GetAsync(Me, id));

        /// <summary>multipart/form-data: "payload" = ListingInput JSON, "images" = 1..6 jpg/png files.</summary>
        [HttpPost]
        [RequestSizeLimit(MaxUploadBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
        public async Task<ActionResult<ListingDetailDto>> Create([FromForm] string? payload, [FromForm] List<IFormFile>? images)
            => Ok(await _listings.CreateAsync(Me, ParsePayload<ListingInput>(payload), images ?? new List<IFormFile>()));

        /// <summary>multipart/form-data: "payload" = ListingInput JSON incl. keepImageIds, "images" = new files.</summary>
        [HttpPut("{id:guid}")]
        [RequestSizeLimit(MaxUploadBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
        public async Task<ActionResult<ListingDetailDto>> Update(Guid id, [FromForm] string? payload, [FromForm] List<IFormFile>? images)
            => Ok(await _listings.UpdateAsync(Me, id, ParsePayload<ListingInput>(payload), images ?? new List<IFormFile>()));

        [HttpPost("{id:guid}/Archive")]
        public async Task<ActionResult<ListingDetailDto>> Archive(Guid id) => Ok(await _listings.ArchiveAsync(Me, id));

        [HttpPost("{id:guid}/Reactivate")]
        public async Task<ActionResult<ListingDetailDto>> Reactivate(Guid id) => Ok(await _listings.ReactivateAsync(Me, id));

        [HttpGet("Image/{fileName}")]
        public async Task<IActionResult> Image(string fileName)
        {
            try
            {
                var (bytes, contentType) = await _images.GetImageAsync(fileName, _storage.ListingImages);
                return File(bytes, contentType);
            }
            catch (Exception e) when (e is FileNotFoundException or ArgumentException or DirectoryNotFoundException)
            {
                return NotFound();
            }
        }
    }
}
