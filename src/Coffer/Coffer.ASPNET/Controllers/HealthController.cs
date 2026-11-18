using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>
    /// "Is the server up?" — the app calls this while it shows the "Coffer is unavailable" screen and hides the
    /// screen once it answers. No sign-in, no database, nothing about the caller.
    /// </summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/Health")]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get() => Ok(new { status = "ok" });
    }
}
