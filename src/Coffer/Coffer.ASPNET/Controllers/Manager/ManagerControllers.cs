using Coffer.BusinessLogic.Community;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.BusinessLogic.Moderation;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.Domain.Marketplace;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Manager
{
    /// <summary>
    /// Base for every Coffer.Manager endpoint: only a Manager token (GitHub device sign-in) whose GitHub id is in
    /// COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS passes. Normal Coffer user tokens are rejected here.
    /// </summary>
    [ApiController]
    [Authorize(Policy = ManagerTokens.Policy)]
    public abstract class ManagerControllerBase : ControllerBase
    {
        protected Guid AdminId =>
            Guid.TryParse(User.FindFirst("sub")?.Value, out var id) ? id : throw MarketplaceException.Forbidden("notSignedInToCofferManager", "Not signed in to Coffer.Manager.");

        protected static TEnum? ParseEnum<TEnum>(string? text, string field) where TEnum : struct, Enum
        {
            if (string.IsNullOrWhiteSpace(text) || text.Trim().Equals("all", StringComparison.OrdinalIgnoreCase)) return null;
            try { return EnumText.FromSnake<TEnum>(text.Trim().ToLowerInvariant()); }
            catch (ArgumentException) { throw MarketplaceException.Validation("unknown", $"Unknown {field}.", ErrorArgs.Of($"{field}")); }
        }

        protected static TEnum RequireEnum<TEnum>(string text, string field) where TEnum : struct, Enum =>
            ParseEnum<TEnum>(text, field) ?? throw MarketplaceException.Validation("unknown", $"Unknown {field}.", ErrorArgs.Of($"{field}"));
    }

    /// <summary>GitHub device-flow sign-in for Coffer.Manager (the only anonymous Manager endpoints).</summary>
    [ApiController]
    [Route("api/Manager/Auth")]
    public class ManagerAuthController : ControllerBase
    {
        private readonly IManagerAuthService _auth;

        public ManagerAuthController(IManagerAuthService auth)
        {
            _auth = auth;
        }

        [AllowAnonymous]
        [HttpPost("Device")]
        public async Task<ActionResult<ManagerDeviceStartDto>> Start() => Ok(await _auth.StartAsync());

        [AllowAnonymous]
        [HttpPost("Device/Token")]
        public async Task<ActionResult<ManagerDeviceTokenDto>> Token([FromBody] ManagerDeviceTokenInput input) => Ok(await _auth.CompleteAsync(input));

        [Authorize(Policy = ManagerTokens.Policy)]
        [HttpGet("Me")]
        public async Task<ActionResult<ManagerAdminDto>> Me()
        {
            var id = Guid.TryParse(User.FindFirst("sub")?.Value, out var g) ? g : throw MarketplaceException.Forbidden("notSignedIn", "Not signed in.");
            return Ok(await _auth.GetAsync(id));
        }
    }

    /// <summary>Individual reports (View A) and bulk resolution.</summary>
    [Route("api/Admin/Reports")]
    public class AdminReportsController : ManagerControllerBase
    {
        private readonly IAdminReportService _admin;
        private readonly IReportService _reports;

        public AdminReportsController(IAdminReportService admin, IReportService reports)
        {
            _admin = admin;
            _reports = reports;
        }

        [HttpGet("Rules")]
        public ActionResult<IReadOnlyList<ReportRuleDto>> Rules() => Ok(_reports.GetRules());

        [HttpGet]
        public async Task<ActionResult<PagedResult<AdminReportSummaryDto>>> List([FromQuery] string? status, [FromQuery] string? targetType,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
            => Ok(await _admin.ListAsync(ParseEnum<ReportStatus>(status, "status"), ParseEnum<ReportTargetType>(targetType, "target type"), page, pageSize));

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<AdminReportDto>> Get(Guid id) => Ok(await _admin.GetAsync(id));

        [HttpPost("{id:guid}/Resolve")]
        public async Task<ActionResult<AdminReportDto>> Resolve(Guid id, [FromBody] ResolveReportInput input)
            => Ok(await _admin.ResolveAsync(AdminId, id, input));

        /// <summary>Resolves several selected reports with one decision and one explanation.</summary>
        [HttpPost("Resolve")]
        public async Task<ActionResult<ResolveReportsResultDto>> ResolveMany([FromBody] ResolveReportsInput input)
            => Ok(await _admin.ResolveManyAsync(AdminId, input));
    }

    /// <summary>Reports grouped by the reported content (View B).</summary>
    [Route("api/Admin/ReportedContent")]
    public class AdminReportedContentController : ManagerControllerBase
    {
        private readonly IAdminReportService _admin;

        public AdminReportedContentController(IAdminReportService admin)
        {
            _admin = admin;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<ReportedContentDto>>> List([FromQuery] string? status, [FromQuery] string? targetType,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
            => Ok(await _admin.ListContentAsync(ParseEnum<ReportStatus>(status, "status"), ParseEnum<ReportTargetType>(targetType, "target type"), page, pageSize));

        [HttpGet("{targetType}/{targetId:guid}")]
        public async Task<ActionResult<ReportedContentDetailDto>> Get(string targetType, Guid targetId)
            => Ok(await _admin.GetContentAsync(RequireEnum<ReportTargetType>(targetType, "target type"), targetId));

        /// <summary>Resolves every open report on this content at once.</summary>
        [HttpPost("{targetType}/{targetId:guid}/Resolve")]
        public async Task<ActionResult<ResolveReportsResultDto>> Resolve(string targetType, Guid targetId, [FromBody] ResolveTargetInput input)
            => Ok(await _admin.ResolveTargetAsync(AdminId, RequireEnum<ReportTargetType>(targetType, "target type"), targetId, input));
    }

    [Route("api/Admin/Suspensions")]
    public class AdminSuspensionsController : ManagerControllerBase
    {
        private readonly ISuspensionService _suspensions;

        public AdminSuspensionsController(ISuspensionService suspensions)
        {
            _suspensions = suspensions;
        }

        /// <summary>status: active | expired | revoked | all.</summary>
        [HttpGet]
        public async Task<ActionResult<PagedResult<SuspensionDto>>> List([FromQuery] string? status, [FromQuery] Guid? userId,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
            => Ok(await _suspensions.ListAsync(status, userId, page, pageSize));

        [HttpPost]
        public async Task<ActionResult<SuspensionDto>> Create([FromBody] CreateSuspensionInput input) => Ok(await _suspensions.SuspendAsync(AdminId, input));

        [HttpPost("{id:guid}/Revoke")]
        public async Task<ActionResult<SuspensionDto>> Revoke(Guid id, [FromBody] RevokeSuspensionInput input)
            => Ok(await _suspensions.RevokeAsync(AdminId, id, input));
    }

    [Route("api/Admin/Users")]
    public class AdminUsersController : ManagerControllerBase
    {
        private readonly ISuspensionService _suspensions;

        public AdminUsersController(ISuspensionService suspensions)
        {
            _suspensions = suspensions;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<AdminUserDto>>> Search([FromQuery] string? query, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
            => Ok(await _suspensions.SearchUsersAsync(query, page, pageSize));

        [HttpGet("{id:guid}/Suspensions")]
        public async Task<ActionResult<PagedResult<SuspensionDto>>> Suspensions(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
            => Ok(await _suspensions.ListAsync("all", id, page, pageSize));
    }

    /// <summary>Report evidence pictures for the Manager (listing and collection-item stores only).</summary>
    [Route("api/Admin/Images")]
    public class AdminImagesController : ManagerControllerBase
    {
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;

        public AdminImagesController(IImageService images, MarketplaceStorage storage)
        {
            _images = images;
            _storage = storage;
        }

        [HttpGet("{kind}/{fileName}")]
        public async Task<IActionResult> Get(string kind, string fileName)
        {
            var folder = kind switch
            {
                "listing" => _storage.ListingImages,
                "item" => ItemRemovalService.ItemFolder,
                _ => throw MarketplaceException.Validation("unknownImageKind", "Unknown image kind."),
            };
            try
            {
                var (bytes, contentType) = await _images.GetImageAsync(fileName, folder);
                return File(bytes, contentType);
            }
            catch (Exception e) when (e is FileNotFoundException or ArgumentException)
            {
                return NotFound();
            }
        }
    }
}
