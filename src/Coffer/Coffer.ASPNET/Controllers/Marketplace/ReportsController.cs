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
}
