using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Moderation;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.BusinessLogic.Moderation
{
    public sealed record ManagerDeviceStartDto(string DeviceCode, string UserCode, string VerificationUri, int ExpiresIn, int Interval);

    /// <summary>status: "pending" | "slow_down" | "authorized". Token fields are set only when authorized.</summary>
    public sealed record ManagerDeviceTokenDto(string Status, string? Token = null, DateTime? ExpiresAt = null, ManagerAdminDto? Admin = null);

    public sealed record ManagerAdminDto(Guid Id, string GithubId, string Login);

    public sealed record ManagerDeviceTokenInput(string DeviceCode);

    /// <summary>Manager JWT: separate audience, so user tokens never pass admin endpoints and vice versa.</summary>
    public static class ManagerTokens
    {
        public const string Audience = "coffer.manager";
        public const string Issuer = "coffer.backend";
        public const string Scheme = "Manager";
        public const string Policy = "ManagerAdmin";
        public const string GithubIdClaim = "github_id";
        public const string LoginClaim = "github_login";
        public static readonly TimeSpan Lifetime = TimeSpan.FromHours(8);

        public static SymmetricSecurityKey Key() =>
            new(Encoding.UTF8.GetBytes(Env.GetString("JWT_SECRET") ?? throw new InvalidOperationException("JWT_SECRET envionmental variable is not set")));

        public static (string Token, DateTime ExpiresAt) Issue(ManagerAdmin admin, DateTime now)
        {
            var expires = now.Add(Lifetime);
            var token = new JwtSecurityToken(
                issuer: Issuer,
                audience: Audience,
                claims: new[]
                {
                    new Claim(JwtRegisteredClaimNames.Sub, admin.Id.ToString()),
                    new Claim(GithubIdClaim, admin.GithubId),
                    new Claim(LoginClaim, admin.Login),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                },
                notBefore: now,
                expires: expires,
                signingCredentials: new SigningCredentials(Key(), SecurityAlgorithms.HmacSha256));
            return (new JwtSecurityTokenHandler().WriteToken(token), expires);
        }
    }

    public interface IManagerAuthService
    {
        Task<ManagerDeviceStartDto> StartAsync();
        Task<ManagerDeviceTokenDto> CompleteAsync(ManagerDeviceTokenInput input);
        Task<ManagerAdminDto> GetAsync(Guid adminId);
    }

    /// <summary>
    /// Coffer.Manager sign-in. The backend brokers GitHub's device flow so the GitHub token never reaches the
    /// desktop app; only accounts whose immutable GitHub id is configured get a Manager token.
    /// </summary>
    public sealed class ManagerAuthService : IManagerAuthService
    {
        private readonly CofferDbContext _db;
        private readonly IGithubDeviceFlowClient _github;
        private readonly ManagerAdminConfig _config;
        private readonly IClock _clock;
        private readonly ILogger<ManagerAuthService> _log;

        public ManagerAuthService(CofferDbContext db, IGithubDeviceFlowClient github, ManagerAdminConfig config, IClock clock, ILogger<ManagerAuthService> log)
        {
            _db = db;
            _github = github;
            _config = config;
            _clock = clock;
            _log = log;
        }

        public async Task<ManagerDeviceStartDto> StartAsync()
        {
            RequireProvisioned();
            try
            {
                var code = await _github.StartAsync();
                return new ManagerDeviceStartDto(code.DeviceCode, code.UserCode, code.VerificationUri, code.ExpiresIn, code.Interval);
            }
            catch (GithubDeviceFlowException e) when (e.Error == "device_flow_disabled")
            {
                throw DeviceFlowDisabled();
            }
            catch (Exception e) when (e is GithubDeviceFlowException or HttpRequestException)
            {
                _log.LogWarning("GitHub device flow could not start: {Error}", e.Message);
                throw MarketplaceException.Unavailable("githubSignInIsNotAvailableRight", "GitHub sign-in is not available right now. Try again later.");
            }
        }

        public async Task<ManagerDeviceTokenDto> CompleteAsync(ManagerDeviceTokenInput input)
        {
            RequireProvisioned();
            if (string.IsNullOrWhiteSpace(input?.DeviceCode)) throw MarketplaceException.Validation("missingDeviceCode", "Missing device code.");

            var poll = await _github.PollAsync(input.DeviceCode.Trim());
            switch (poll.Status)
            {
                case GithubDevicePollStatus.Pending: return new ManagerDeviceTokenDto("pending");
                case GithubDevicePollStatus.SlowDown: return new ManagerDeviceTokenDto("slow_down");
                case GithubDevicePollStatus.Expired: throw MarketplaceException.Unauthorized("expired", "The sign-in code expired. Start again.");
                case GithubDevicePollStatus.Denied: throw MarketplaceException.Unauthorized("denied", "Sign-in was cancelled on GitHub.");
                case GithubDevicePollStatus.Disabled: throw DeviceFlowDisabled();
                case GithubDevicePollStatus.Failed:
                    _log.LogWarning("GitHub device flow failed: {Error}", poll.Error);
                    throw MarketplaceException.Unauthorized("failed", "GitHub sign-in failed. Start again.");
            }

            var identity = await _github.GetUserAsync(poll.AccessToken!);
            if (!_config.IsAdmin(identity.Id))
            {
                _log.LogWarning("Coffer.Manager sign-in refused for GitHub account {GithubId} (not a configured administrator).", identity.Id);
                throw new MarketplaceException(MarketplaceError.Forbidden, "not_admin", "This GitHub account is not a Coffer administrator.");
            }

            var now = _clock.UtcNow;
            var admin = await _db.ManagerAdmins.FirstOrDefaultAsync(a => a.GithubId == identity.Id);
            if (admin == null)
            {
                admin = new ManagerAdmin { Id = Guid.NewGuid(), GithubId = identity.Id, CreatedAt = now };
                _db.ManagerAdmins.Add(admin);
            }
            admin.Login = identity.Login;
            admin.LastLoginAt = now;
            AdminAudit.Add(_db, admin.Id, "login", null, null, new { identity.Login }, now);
            await _db.SaveChangesAsync();

            var (token, expiresAt) = ManagerTokens.Issue(admin, now);
            return new ManagerDeviceTokenDto("authorized", token, expiresAt, ToDto(admin));
        }

        public async Task<ManagerAdminDto> GetAsync(Guid adminId)
        {
            var admin = await _db.ManagerAdmins.AsNoTracking().FirstOrDefaultAsync(a => a.Id == adminId)
                ?? throw MarketplaceException.NotFound("administratorNotFound", "Administrator not found.");
            return ToDto(admin);
        }

        private void RequireProvisioned()
        {
            if (!_config.HasAdmins)
                throw MarketplaceException.Unavailable(ManagerAdminConfig.ProvisioningRequiredCode, _config.Problem ?? "Administrator provisioning is required.");
        }

        private static MarketplaceException DeviceFlowDisabled() => MarketplaceException.Unavailable(
            "device_flow_disabled", "Device sign-in is disabled for the GitHub OAuth app. Enable \"Device Flow\" in the app's GitHub settings.");

        private static ManagerAdminDto ToDto(ManagerAdmin a) => new(a.Id, a.GithubId, a.Login);
    }

    public static class AdminAudit
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        /// <summary>Adds an audit row to the context; saved together with the action it describes.</summary>
        public static void Add(CofferDbContext db, Guid adminId, string action, string? targetType, Guid? targetId, object details, DateTime now) =>
            db.AdminAuditLog.Add(new AdminAuditEntry
            {
                Id = Guid.NewGuid(),
                AdminId = adminId,
                Action = action,
                TargetType = targetType,
                TargetId = targetId,
                Details = JsonSerializer.Serialize(details, Json),
                CreatedAt = now,
            });
    }
}
