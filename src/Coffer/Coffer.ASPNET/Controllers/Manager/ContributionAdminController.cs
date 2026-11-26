using Coffer.BusinessLogic.Contribution;
using Coffer.Domain.Paging;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Manager
{
    /// <summary>Shape What's Next for Coffer.Manager administrators: the switch, voting and photo phases, results.</summary>
    [Route("api/Admin/Contribution")]
    public class ContributionAdminController : ManagerControllerBase
    {
        private readonly IContributionAdminService _contribution;

        public ContributionAdminController(IContributionAdminService contribution)
        {
            _contribution = contribution;
        }

        [HttpGet("Settings")]
        public async Task<ActionResult<AdminSettingsDto>> Settings() => Ok(await _contribution.GetSettingsAsync());

        [HttpPut("Settings")]
        public async Task<ActionResult<AdminSettingsDto>> SetSettings([FromBody] SettingsInput input) => Ok(await _contribution.SetSettingsAsync(AdminId, input));

        [HttpGet("Phases")]
        public async Task<ActionResult<List<AdminPhaseDto>>> Phases([FromQuery] string? kind, [FromQuery] string? state) =>
            Ok(await _contribution.ListPhasesAsync(kind, state));

        [HttpGet("Phases/{id:guid}")]
        public async Task<ActionResult<AdminPhaseDto>> Phase(Guid id) => Ok(await _contribution.GetPhaseAsync(id));

        [HttpGet("Phases/{id:guid}/Texts")]
        public async Task<ActionResult<PagedList<VoteTextDto>>> Texts(Guid id, [FromQuery] Guid? candidateId, [FromQuery] int? page = null) =>
            Ok(await _contribution.TextsAsync(id, candidateId, page));

        [HttpPost("Phases")]
        public async Task<ActionResult<AdminPhaseDto>> Create([FromBody] PhaseInput input) => Ok(await _contribution.CreatePhaseAsync(AdminId, input));

        [HttpPut("Phases/{id:guid}")]
        public async Task<ActionResult<AdminPhaseDto>> Update(Guid id, [FromBody] PhaseInput input) => Ok(await _contribution.UpdatePhaseAsync(AdminId, id, input));

        [HttpPost("Phases/{id:guid}/Close")]
        public async Task<ActionResult<AdminPhaseDto>> Close(Guid id, [FromBody] CloseInput? input) => Ok(await _contribution.CloseAsync(AdminId, id, input?.Reason));

        [HttpPost("Phases/{id:guid}/Interrupt")]
        public async Task<ActionResult<AdminPhaseDto>> Interrupt(Guid id, [FromBody] CloseInput? input) => Ok(await _contribution.InterruptAsync(AdminId, id, input?.Reason));

        [HttpPost("Phases/{id:guid}/Winner")]
        public async Task<ActionResult<AdminPhaseDto>> Winner(Guid id, [FromBody] WinnerInput input) => Ok(await _contribution.PickWinnerAsync(AdminId, id, input.CandidateId));

        [HttpDelete("Phases/{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _contribution.DeleteAsync(AdminId, id);
            return NoContent();
        }
    }
}
