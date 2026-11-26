using Coffer.ASPNET.Controllers.Marketplace;
using Coffer.BusinessLogic.Contribution;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>Shape What's Next for signed-in users: the page's state, voting, photo uploads, example galleries.</summary>
    [Route("api/[controller]")]
    public class ContributionController : MarketplaceControllerBase
    {
        private readonly IContributionService _contribution;

        public ContributionController(IContributionService contribution)
        {
            _contribution = contribution;
        }

        [HttpGet]
        public async Task<ActionResult<ContributionStateDto>> Get() => Ok(await _contribution.GetAsync(Me));

        [HttpPut("Vote")]
        public async Task<ActionResult<MyVoteDto>> Vote([FromBody] VoteInput input) => Ok(await _contribution.VoteAsync(Me, input));

        /// <summary>Multipart: "phaseId" and 1–20 "images" (the app resizes them first; bigger ones are resized here).</summary>
        [HttpPost("Detection")]
        [ManualForm]
        [RequestSizeLimit(MaxUploadRequest)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadRequest)]
        public async Task<ActionResult<MineDto>> Detection()
        {
            var (phaseId, images) = await ReadUploadAsync();
            return Ok(await _contribution.UploadDetectionAsync(Me, phaseId, images));
        }

        /// <summary>Multipart: "phaseId" and 5–10 "images" of the same item (one classification form).</summary>
        [HttpPost("Classification")]
        [ManualForm]
        [RequestSizeLimit(MaxUploadRequest)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadRequest)]
        public async Task<ActionResult<MineDto>> Classification()
        {
            var (phaseId, images) = await ReadUploadAsync();
            return Ok(await _contribution.UploadClassificationAsync(Me, phaseId, images));
        }

        private const long MaxUploadRequest = 40L * 1024 * 1024;

        private async Task<(Guid PhaseId, IReadOnlyList<IFormFile> Images)> ReadUploadAsync()
        {
            var form = await OptionalFormAsync();
            if (!Guid.TryParse(form["phaseId"].ToString(), out var phaseId))
                throw Coffer.BusinessLogic.Marketplace.Common.MarketplaceException.Validation("contributionPhaseRequired", "Say which phase the photos are for.");
            return (phaseId, form.Files.GetFiles("images"));
        }
    }
}
