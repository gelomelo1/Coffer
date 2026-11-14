using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.Domain.Marketplace;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    /// <summary>User side of reports: file a report, see my reports, see moderation of my own content.</summary>
    [Route("api/[controller]")]
    public class ReportsController : MarketplaceControllerBase
    {
        private readonly IReportService _reports;

        public ReportsController(IReportService reports)
        {
            _reports = reports;
        }

        [HttpGet("Rules")]
        public ActionResult<IReadOnlyList<ReportRuleDto>> Rules() => Ok(_reports.GetRules());

        [HttpPost]
        public async Task<ActionResult<MyReportDto>> Create([FromBody] CreateReportInput input) => Ok(await _reports.CreateAsync(Me, input));

        [HttpGet("Mine")]
        public async Task<ActionResult<List<MyReportDto>>> Mine() => Ok(await _reports.GetMineAsync(Me));

        [HttpGet("/api/Moderation/AgainstMe")]
        public async Task<ActionResult<List<ModerationActionDto>>> AgainstMe() => Ok(await _reports.GetAgainstMeAsync(Me));

        [HttpGet("/api/Moderation/AgainstMe/UnseenCount")]
        public async Task<IActionResult> UnseenCount() => Ok(new { count = await _reports.CountUnseenAgainstMeAsync(Me) });

        [HttpPost("/api/Moderation/AgainstMe/Seen")]
        public async Task<IActionResult> Seen()
        {
            await _reports.MarkAgainstMeSeenAsync(Me);
            return NoContent();
        }
    }

    /// <summary>Admin-only report queue (Coffer.Manager). Moderators and users get 403.</summary>
    [Route("api/Admin/Reports")]
    public class AdminReportsController : MarketplaceControllerBase
    {
        private readonly IAdminReportService _admin;

        public AdminReportsController(IAdminReportService admin)
        {
            _admin = admin;
        }

        [HttpGet]
        public async Task<ActionResult<List<AdminReportSummaryDto>>> List([FromQuery] string? status, [FromQuery] string? targetType)
            => Ok(await _admin.ListAsync(Me, ParseEnum<ReportStatus>(status, "status"), ParseEnum<ReportTargetType>(targetType, "target type")));

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<AdminReportDto>> Get(Guid id) => Ok(await _admin.GetAsync(Me, id));

        [HttpPost("{id:guid}/Resolve")]
        public async Task<ActionResult<AdminReportDto>> Resolve(Guid id, [FromBody] ResolveReportInput input)
            => Ok(await _admin.ResolveAsync(Me, id, input));
    }
}
