using System.Text.RegularExpressions;
using Coffer.BusinessLogic.Auth.Sessions;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.DataAccess;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>
    /// status: "signedIn" (Tokens set), "registrationRequired" (RegistrationId set) or "suspended" (Suspension set; no
    /// tokens are issued to a suspended account).
    /// </summary>
    public sealed record SignInResult(string Status, SessionTokens? Tokens = null, string? RegistrationId = null, ActiveSuspensionDto? Suspension = null)
    {
        public const string SignedIn = "signedIn";
        public const string RegistrationRequired = "registrationRequired";
        public const string Suspended = "suspended";
    }

    public interface ISignInService
    {
        /// <summary>After a provider verified the identity: sign in the existing account, or start a registration.</summary>
        Task<SignInResult> CompleteAsync(ProviderIdentity identity);
        Task<SessionTokens> RegisterAsync(string? registrationId, string? username, string? country);
    }

    /// <summary>
    /// The one place every provider's sign-in ends. Accounts are found by (provider, provider subject) only, never by
    /// e-mail, so nobody can take over an account by registering an e-mail address at another provider.
    /// </summary>
    public sealed class SignInService : ISignInService
    {
        // Same rule as the app's registration form; names are unique (users_name_key).
        private static readonly Regex UsernameRule = new("^[a-zA-Z0-9._-]{1,40}$", RegexOptions.Compiled);
        private static readonly Regex CountryRule = new("^[A-Z]{2}$", RegexOptions.Compiled);

        private readonly CofferDbContext _db;
        private readonly ISessionService _sessions;
        private readonly ISuspensionService _suspensions;
        private readonly PendingRegistrationStore _pending;

        public SignInService(CofferDbContext db, ISessionService sessions, ISuspensionService suspensions, PendingRegistrationStore pending)
        {
            _db = db;
            _sessions = sessions;
            _suspensions = suspensions;
            _pending = pending;
        }

        public async Task<SignInResult> CompleteAsync(ProviderIdentity identity)
        {
            var user = await FindAsync(identity);
            if (user == null)
                return new SignInResult(SignInResult.RegistrationRequired, RegistrationId: _pending.Put(identity));

            if (await _suspensions.GetActiveAsync(user.Id) is { } active)
                return new SignInResult(SignInResult.Suspended, Suspension: active);
            return new SignInResult(SignInResult.SignedIn, Tokens: await _sessions.IssueAsync(user.Id));
        }

        public async Task<SessionTokens> RegisterAsync(string? registrationId, string? username, string? country)
        {
            if (_pending.Peek(registrationId) == null) throw ExpiredRegistration();

            // Checked before the registration is consumed, so a typo doesn't cost the person their sign-in.
            username = username?.Trim() ?? "";
            country = country?.Trim() ?? "";
            if (!UsernameRule.IsMatch(username))
                throw MarketplaceException.Validation("invalidUsername", "Usernames are 1–40 letters, digits, dots, dashes or underscores.");
            if (!CountryRule.IsMatch(country))
                throw MarketplaceException.Validation("invalidCountry", "Choose a country.");
            if (await _db.Users.AnyAsync(u => u.Name == username))
                throw UsernameTaken();

            var identity = _pending.Take(registrationId) ?? throw ExpiredRegistration();
            if (await FindAsync(identity) != null) throw AlreadyRegistered();

            var user = new User(username, identity.Email ?? "", identity.Provider, country, identity.Subject, identity.AvatarUrl, UserRole.User);
            _db.Users.Add(user);
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Lost a race: the same identity or the same name was registered a moment ago.
                _db.Entry(user).State = EntityState.Detached;
                throw await FindAsync(identity) != null ? AlreadyRegistered() : UsernameTaken();
            }
            return await _sessions.IssueAsync(user.Id);
        }

        private Task<User?> FindAsync(ProviderIdentity identity) =>
            _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Provider == identity.Provider && u.ProviderUserId == identity.Subject && u.DeletedAt == null);

        private static MarketplaceException ExpiredRegistration() =>
            MarketplaceException.Validation("invalidRegistrationSession", "Your sign-in expired. Sign in again.");

        private static MarketplaceException AlreadyRegistered() =>
            MarketplaceException.Conflict("userAlreadyExists", "This account is already registered. Sign in instead.");

        private static MarketplaceException UsernameTaken() =>
            MarketplaceException.Conflict("usernameTaken", "This username is taken. Choose another one.");
    }
}
