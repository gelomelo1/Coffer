using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Google.Apis.Auth;
using Google.Apis.Auth.OAuth2.Requests;
using Google.Apis.Auth.OAuth2.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql.TypeMapping;

namespace Coffer.ASPNET.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IUsersRepository _usersRepository;
        private readonly IJwtService _jwtService;
        private readonly IGithubService _githubService;
        private readonly ITempTokenService _tempTokenService;

        public AuthController(IUsersRepository usersRepository, IJwtService jwtService, IGithubService githubService, ITempTokenService tempTokenService)
        {
            _usersRepository = usersRepository;
            _jwtService = jwtService;
            _githubService = githubService;
            _tempTokenService = tempTokenService;
        }

        public record TokenRequest(string IdToken);
        [HttpPost("google/validate")]
        public async Task<IActionResult> GoogleValidate([FromBody] TokenRequest req)
        {
            try
            {
                var payload = await GoogleJsonWebSignature.ValidateAsync(req.IdToken);

                Console.WriteLine(payload);

                var user = await _usersRepository.GetUserByLogin("google", payload.Subject);

                if (user != null)
                {
                    var jwt = _jwtService.GenerateToken(user);
                    return Ok(new { exists = true, token = jwt });
                }

                var tempId = _tempTokenService.StoreToken(req.IdToken);
                return Ok(new { exists = false, tempId = tempId });
            }
            catch(Exception e)
            {
                return BadRequest(e.Message);
            }
        }

        public record RegisterRequest(string TempId, string Username, string Country);
        [HttpPost("google/register")]
        public async Task<IActionResult> GoogleRegister([FromBody] RegisterRequest req)
        {
            try
            {

                if (!_tempTokenService.TryGetToken(req.TempId, out var accessToken))
                {
                    return BadRequest("Invalid registration session");
                }

                var payload = await GoogleJsonWebSignature.ValidateAsync(accessToken);

                var existingUser = await _usersRepository.GetUserByLogin("google", payload.Subject);
                if (existingUser != null)
                {
                    return BadRequest("User already exists");
                }

                var user = await _usersRepository.InsertUserAsync(new UserRequired("google", payload.Subject, req.Username, payload.Email, req.Country, payload.Picture));

                var jwt = _jwtService.GenerateToken(user);

                _tempTokenService.RemoveToken(req.TempId);

                return Ok(new { token = jwt });
            }
            catch (Exception e)
            {
                return BadRequest(e.Message);
            }
        }

        public record GithubCodeRequest(string Code, string CodeVerifier);
        [HttpPost("github/validate")]
        public async Task<IActionResult> GithubValidate([FromBody] GithubCodeRequest req)
        {
            try
            {
                var tokenResponse = await _githubService.ExchangeCodeForToken(req.Code, req.CodeVerifier);
                var githubUser = await _githubService.GetGithubUser(tokenResponse);

                var user = await _usersRepository.GetUserByLogin("github", githubUser.Id);

                if(user != null)
                {
                    var jwt = _jwtService.GenerateToken(user);
                    return Ok(new { exists = true, token = jwt });
                }

                var tempId = _tempTokenService.StoreToken(tokenResponse);
                return Ok(new { exists = false, tempId = tempId });
            }
            catch(Exception e)
            {
                Console.WriteLine(e.ToString());
                return Unauthorized();
            }
        }

        public record RegisterRequestGithub(string TempId, string Username, string Country);
        [HttpPost("github/register")]
        public async Task<IActionResult> GithubRegister([FromBody] RegisterRequestGithub req)
        {
            try
            {
                if(!_tempTokenService.TryGetToken(req.TempId, out var accessToken))
                {
                    return BadRequest("Invalid registration session");
                }

                var githubUser = await _githubService.GetGithubUser(accessToken);

                var existingUser = await _usersRepository.GetUserByLogin("github", githubUser.Id);
                if (existingUser != null) return BadRequest("User already exists");

                var user = await _usersRepository.InsertUserAsync(
                    new UserRequired("github", githubUser.Id, req.Username, githubUser.Email, req.Country, githubUser.AvatarUrl)
                );

                var jwt = _jwtService.GenerateToken(user);

                _tempTokenService.RemoveToken(req.TempId);

                return Ok(new { token = jwt });
            }
            catch(Exception e)
            {
                return BadRequest(e.Message);
            }
        }

        [HttpGet("currentUser")]
        [Authorize]
        public async Task<ActionResult<User>> GetCurrentUser()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            Console.WriteLine($"Claim: {userIdClaim}");

            if (userIdClaim == null)
                return Unauthorized();

            var userId = Guid.Parse(userIdClaim);

            var user = await _usersRepository.GetItemByIdAsync(userId);

            if (user == null)
                return NotFound();

            return Ok(user);
        }
    }
}
