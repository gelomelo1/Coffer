using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.DevSeed
{
    public sealed record DevLoginUserDto(Guid Id, string Name, string? Avatar, string Country, string Provider, bool Suspended);

    public sealed record DevLoginInput(Guid UserId);

    public sealed record DevLoginResultDto(string Token);

    /// <summary>
    /// Development-only sign-in as one of the seeded test users (DEV_SEED_DATA_JSON), without Google/GitHub.
    /// Enabled only when DEV_LOGIN_ENABLED=true AND the environment is Development; anywhere else the API refuses to
    /// start with the flag set (see <see cref="DevSeedGuard"/>). Users not in the seed list can never be impersonated.
    /// </summary>
    public sealed class DevLoginService
    {
        public const string EnvName = "DEV_LOGIN_ENABLED";
        private readonly CofferDbContext _db;
        private readonly Coffer.BusinessLogic.Auth.Sessions.ISessionService _sessions;
        private readonly ISuspensionService _suspensions;

        public DevLoginService(CofferDbContext db, Coffer.BusinessLogic.Auth.Sessions.ISessionService sessions, ISuspensionService suspensions)
        {
            _db = db;
            _sessions = sessions;
            _suspensions = suspensions;
        }

        public static bool FlagSet =>
            (Environment.GetEnvironmentVariable(EnvName) ?? "").Trim().ToLowerInvariant() is "true" or "1" or "yes";

        public static bool IsEnabled(string environmentName) => FlagSet && environmentName == "Development";

        /// <summary>Ids of the users defined in DEV_SEED_DATA_JSON (empty when the dataset is missing or invalid).</summary>
        public static HashSet<Guid> SeedUserIds()
        {
            try
            {
                return DevSeedValidator.Parse(Environment.GetEnvironmentVariable("DEV_SEED_DATA_JSON")).Users.Select(u => u.Id).ToHashSet();
            }
            catch (DevSeedConfigException)
            {
                return new HashSet<Guid>();
            }
        }

        public async Task<List<DevLoginUserDto>> UsersAsync()
        {
            var ids = SeedUserIds();
            var users = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.Id) && u.DeletedAt == null).OrderBy(u => u.Name).ToListAsync();
            var result = new List<DevLoginUserDto>();
            foreach (var u in users)
                result.Add(new DevLoginUserDto(u.Id, u.Name, u.Avatar, u.Country, u.Provider, await _suspensions.GetActiveAsync(u.Id) != null));
            return result;
        }

        public async Task<DevLoginResultDto> LoginAsync(DevLoginInput input)
        {
            if (input == null || !SeedUserIds().Contains(input.UserId))
                throw MarketplaceException.Forbidden("onlySeededDevelopmentUsersCanUseThe", "Only seeded development users can use the dev login.");
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == input.UserId)
                ?? throw MarketplaceException.NotFound("thisSeedUserIsnTInThe", "This seed user isn't in the database — run the dev seed first.");
            // Same rule as the real sign-in: a suspended account gets no token.
            if (await _suspensions.GetActiveAsync(user.Id) is { } active)
                throw new MarketplaceException(MarketplaceError.Forbidden, SuspensionService.SuspendedCode, $"Your account is suspended until {active.EndsAt:yyyy-MM-dd HH:mm} UTC.", ErrorArgs.Of($"{active.EndsAt:yyyy-MM-dd HH:mm}"));
            return new DevLoginResultDto((await _sessions.IssueAsync(user.Id)).AccessToken);
        }
    }
}
