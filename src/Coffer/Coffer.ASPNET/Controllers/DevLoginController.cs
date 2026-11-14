using Coffer.BusinessLogic.DevSeed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>
    /// Development-only sign-in as a seeded test user. Answers 404 unless the API runs in Development with
    /// DEV_LOGIN_ENABLED=true, so in any other environment these endpoints don't exist for callers.
    /// </summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/auth/dev")]
    public class DevLoginController : ControllerBase
    {
        private readonly DevLoginService _devLogin;
        private readonly IWebHostEnvironment _env;

        public DevLoginController(DevLoginService devLogin, IWebHostEnvironment env)
        {
            _devLogin = devLogin;
            _env = env;
        }

        [HttpGet("users")]
        public async Task<ActionResult<List<DevLoginUserDto>>> Users()
        {
            if (!DevLoginService.IsEnabled(_env.EnvironmentName)) return NotFound();
            return Ok(await _devLogin.UsersAsync());
        }

        [HttpPost("login")]
        public async Task<ActionResult<DevLoginResultDto>> Login([FromBody] DevLoginInput input)
        {
            if (!DevLoginService.IsEnabled(_env.EnvironmentName)) return NotFound();
            return Ok(await _devLogin.LoginAsync(input));
        }
    }
}
