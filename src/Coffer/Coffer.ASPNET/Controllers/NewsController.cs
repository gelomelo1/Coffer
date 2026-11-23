using Coffer.ASPNET.Controllers.Marketplace;
using Coffer.BusinessLogic.News;
using Coffer.Domain.Paging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>Published news for the app (signed-in users); images are public like other app images.</summary>
    [Route("api/[controller]")]
    public class NewsController : MarketplaceControllerBase
    {
        private readonly INewsService _news;

        public NewsController(INewsService news)
        {
            _news = news;
        }

        [HttpGet]
        public async Task<ActionResult<PagedList<NewsCardDto>>> List([FromQuery] int? page = null, [FromQuery] int? pageSize = null)
            => Ok(await _news.ListPublishedAsync(page, pageSize));

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<NewsPostDto>> Get(Guid id) => Ok(await _news.GetPublishedAsync(id));

        [AllowAnonymous]
        [HttpGet("Image/{fileName}")]
        public IActionResult Image(string fileName)
        {
            var image = NewsImages.Open(fileName);
            if (image == null) return NotFound();
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "public, max-age=604800";
            return File(image.Value.Stream, image.Value.ContentType);
        }
    }
}
