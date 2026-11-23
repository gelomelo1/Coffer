using Coffer.BusinessLogic.News;
using Coffer.Domain.Paging;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Manager
{
    /// <summary>News posts for Coffer.Manager administrators: drafts, publishing, images.</summary>
    [Route("api/Admin/News")]
    public class NewsAdminController : ManagerControllerBase
    {
        private const long MaxImageRequest = NewsImages.MaxBytes + 100_000;
        private readonly INewsService _news;

        public NewsAdminController(INewsService news)
        {
            _news = news;
        }

        [HttpGet]
        public async Task<ActionResult<PagedList<AdminNewsDto>>> List([FromQuery] string? status, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
            => Ok(await _news.AdminListAsync(status, page, pageSize));

        /// <summary>The link picker: live users, collections, items, listings or news whose name contains the query.</summary>
        [HttpGet("LinkTargets")]
        public async Task<ActionResult<List<LinkTargetDto>>> LinkTargets([FromQuery] string? type, [FromQuery] string? query)
            => Ok(await _news.LinkTargetsAsync(type, query));

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<AdminNewsDto>> Get(Guid id) => Ok(await _news.AdminGetAsync(id));

        [HttpPost]
        public async Task<ActionResult<AdminNewsDto>> Create([FromBody] NewsInput input) => Ok(await _news.CreateAsync(AdminId, input));

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<AdminNewsDto>> Update(Guid id, [FromBody] NewsInput input) => Ok(await _news.UpdateAsync(AdminId, id, input));

        [HttpPost("{id:guid}/Publish")]
        public async Task<ActionResult<AdminNewsDto>> Publish(Guid id, [FromBody] NewsPublishInput input) => Ok(await _news.SetPublishedAsync(AdminId, id, input.Published));

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _news.DeleteAsync(AdminId, id);
            return NoContent();
        }

        /// <summary>Multipart "file": a banner or content image; answers its stored name.</summary>
        [HttpPost("Images")]
        [RequestSizeLimit(MaxImageRequest)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxImageRequest)]
        public async Task<IActionResult> Image(IFormFile? file) => Ok(new { fileName = await _news.UploadImageAsync(AdminId, file) });
    }

    public sealed record NewsPublishInput(bool Published);
}
