using Coffer.ASPNET.Extensions;
using Coffer.BusinessLogic.Auth.OAuth;
using Coffer.BusinessLogic.Auth.Sessions;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SignInResult = Coffer.BusinessLogic.Auth.OAuth.SignInResult;

namespace Coffer.ASPNET.Controllers
{
    /// <summary>
    /// App sign-in. Every provider ends in the same answer: signed in (tokens) or registration required (an id for
    /// api/auth/register). Facebook and Reddit start with api/auth/{provider}/start and finish with .../complete.
    /// Responses are never cached.
    /// </summary>
    [ApiController]
    [Route("api/auth")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public class AuthController : BaseController
    {
        private readonly IUsersRepository _usersRepository;
        private readonly ISessionService _sessions;
        private readonly ISignInService _signIn;
        private readonly IGoogleIdTokenValidator _google;
        private readonly OAuthTransactionStore _transactions;
        private readonly IFacebookOAuthClient _facebook;
        private readonly Coffer.BusinessLogic.Auth.AuthOptions _options;
        private readonly ILogger<AuthController> _log;

        public AuthController(IUsersRepository usersRepository, ISessionService sessions, ISignInService signIn,
            IGoogleIdTokenValidator google, OAuthTransactionStore transactions, IFacebookOAuthClient facebook,
            Coffer.BusinessLogic.Auth.AuthOptions options, ILogger<AuthController> log)
        {
            _usersRepository = usersRepository;
            _sessions = sessions;
            _signIn = signIn;
            _google = google;
            _transactions = transactions;
            _facebook = facebook;
            _options = options;
            _log = log;
        }

        public record GoogleValidateRequest(string? IdToken);

        [HttpPost("google/validate")]
        [AllowAnonymous]
        [EnableRateLimiting(AuthRateLimits.SignIn)]
        public async Task<IActionResult> GoogleValidate([FromBody] GoogleValidateRequest? req)
        {
            ProviderIdentity identity;
            try
            {
                identity = await _google.ValidateAsync(req?.IdToken ?? "");
            }
            catch (ProviderSignInException e)
            {
                return SignInFailed(Providers.Google, e);
            }
            return SignInAnswer(await _signIn.CompleteAsync(identity));
        }

        public record CompleteRequest(string? TransactionId, string? Code, string? State);

        /// <summary>Starts a Facebook sign-in: the app opens authorizeUrl in the browser and waits for redirectUri.</summary>
        [HttpPost("facebook/start")]
        [AllowAnonymous]
        [EnableRateLimiting(AuthRateLimits.SignIn)]
        public IActionResult FacebookStart()
        {
            var transaction = _transactions.Create(Providers.Facebook, withNonceAndPkce: true);
            return Ok(new OAuthStart(transaction.Id, _facebook.AuthorizeUrl(transaction), _options.Facebook.RedirectUri));
        }

        [HttpPost("facebook/complete")]
        [AllowAnonymous]
        [EnableRateLimiting(AuthRateLimits.SignIn)]
        public Task<IActionResult> FacebookComplete([FromBody] CompleteRequest? req) =>
            CompleteBrowserSignIn(Providers.Facebook, req, transaction => _facebook.CompleteAsync(transaction, req?.Code ?? ""));

        /// <summary>
        /// The browser came back: the transaction is used up whatever happens next (a callback can't be replayed), must
        /// belong to this provider, and the returned state must be the one we generated for it.
        /// </summary>
        private async Task<IActionResult> CompleteBrowserSignIn(string provider, CompleteRequest? req, Func<OAuthTransaction, Task<ProviderIdentity>> complete)
        {
            var transaction = _transactions.Take(req?.TransactionId);
            try
            {
                if (transaction == null) throw new ProviderSignInException("unknown, expired or already used transaction");
                if (transaction.Provider != provider) throw new ProviderSignInException($"transaction belongs to {transaction.Provider}");
                if (!SecureRandom.Same(req?.State, transaction.State)) throw new ProviderSignInException("state mismatch");
                var identity = await complete(transaction);
                return SignInAnswer(await _signIn.CompleteAsync(identity));
            }
            catch (ProviderSignInException e)
            {
                return SignInFailed(provider, e);
            }
        }

        public record RegisterRequest(string? RegistrationId, string? Username, string? Country);

        /// <summary>Creates the account of a pending registration (any provider) and signs it in.</summary>
        [HttpPost("register")]
        [AllowAnonymous]
        [EnableRateLimiting(AuthRateLimits.SignIn)]
        public async Task<IActionResult> Register([FromBody] RegisterRequest? req) =>
            Ok(Tokens(await _signIn.RegisterAsync(req?.RegistrationId, req?.Username, req?.Country)));

        public record RefreshRequest(string? RefreshToken);

        /// <summary>Trades a refresh token for a new pair (the old one stops working).</summary>
        [HttpPost("refresh")]
        [AllowAnonymous]
        [EnableRateLimiting(AuthRateLimits.Refresh)]
        public async Task<IActionResult> Refresh([FromBody] RefreshRequest? req) =>
            Ok(Tokens(await _sessions.RefreshAsync(req?.RefreshToken ?? "")));

        public record LogoutRequest(string? RefreshToken);

        /// <summary>Ends the session of the refresh token and/or of the calling access token. Always 204.</summary>
        [HttpPost("logout")]
        [AllowAnonymous]
        [EnableRateLimiting(AuthRateLimits.Refresh)]
        public async Task<IActionResult> Logout([FromBody] LogoutRequest? req)
        {
            if (!string.IsNullOrWhiteSpace(req?.RefreshToken))
                await _sessions.RevokeByRefreshTokenAsync(req.RefreshToken, SessionService.ReasonLogout);
            if (UserId != null && AccessTokenIssuer.SessionId(User) is { } sessionId)
                await _sessions.RevokeAsync(sessionId, SessionService.ReasonLogout);
            return NoContent();
        }

        [HttpGet("currentUser")]
        [Authorize]
        public async Task<ActionResult<User>> GetCurrentUser()
        {
            if (UserId is not { } userId)
                return Unauthorized();

            var user = await _usersRepository.GetItemByIdAsync(userId);

            if (user == null)
                return NotFound();

            return Ok(user);
        }

        /// <summary>The shared answer of every provider's sign-in step.</summary>
        internal IActionResult SignInAnswer(SignInResult result)
        {
            switch (result.Status)
            {
                case SignInResult.Suspended:
                    // Same body as every blocked request, so the app shows its "account suspended" screen.
                    var active = result.Suspension!;
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = $"Your account is suspended until {active.EndsAt:yyyy-MM-dd HH:mm} UTC.",
                        code = Coffer.BusinessLogic.Moderation.SuspensionService.SuspendedCode,
                        reason = active.Reason,
                        startsAt = active.StartsAt,
                        endsAt = active.EndsAt,
                    });
                case SignInResult.RegistrationRequired:
                    return Ok(new { status = result.Status, registrationId = result.RegistrationId });
                default:
                    var t = result.Tokens!;
                    return Ok(new { status = result.Status, accessToken = t.AccessToken, accessTokenExpiresAt = t.AccessTokenExpiresAt, refreshToken = t.RefreshToken });
            }
        }

        /// <summary>Logs why (never the token or code itself) and answers with one generic error.</summary>
        internal IActionResult SignInFailed(string provider, Exception e)
        {
            _log.LogWarning("{Provider} sign-in failed: {Reason}", provider, e.Message);
            return this.ApiError(StatusCodes.Status400BadRequest, "providerSignInFailed", "Sign-in failed. Try again.");
        }

        private static object Tokens(SessionTokens t) =>
            new { accessToken = t.AccessToken, accessTokenExpiresAt = t.AccessTokenExpiresAt, refreshToken = t.RefreshToken };
    }
}
