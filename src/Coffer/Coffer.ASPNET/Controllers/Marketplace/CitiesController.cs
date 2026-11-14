using Coffer.BusinessLogic.Marketplace.Cities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class CitiesController : BaseController
    {
        private readonly ICityService _cities;

        public CitiesController(ICityService cities)
        {
            _cities = cities;
        }

        [HttpGet("Search")]
        public async Task<ActionResult<IReadOnlyList<CityDto>>> Search([FromQuery] string? q)
            => Ok(await _cities.SearchAsync(q ?? ""));
    }
}
