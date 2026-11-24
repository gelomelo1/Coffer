using Coffer.BusinessLogic.Auth.OAuth;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Coffer.BusinessLogic.Auth.Sessions
{
    /// <summary>What the app keeps after signing in. The refresh token is shown once; the server stores only its hash.</summary>
    public sealed record SessionTokens(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken);

    public interface ISessionService
    {
        Task<SessionTokens> IssueAsync(Guid userId);
        /// <summary>Consumes the refresh token and returns the next pair. Every failure is 401 invalidRefreshToken.</summary>
        Task<SessionTokens> RefreshAsync(string refreshToken);
        /// <summary>Ends the token's session; unknown tokens are ignored (logout never tells whether a token existed).</summary>
        Task RevokeByRefreshTokenAsync(string refreshToken, string reason);
        Task RevokeAsync(Guid sessionId, string reason);
        Task RevokeAllForUserAsync(Guid userId, string reason);
        Task<bool> IsActiveAsync(Guid sessionId);
    }

    /// <summary>
    /// Server-side sessions. Access tokens last 15 minutes; refresh tokens are single use (rotated on every refresh),
    /// expire after 14 idle days and never outlive the session's 60 days. A consumed refresh token presented again was
    /// copied by someone: the whole session is revoked, so the thief and the owner are both signed out.
    /// </summary>
    public sealed class SessionService : ISessionService
    {
        public static readonly TimeSpan IdleLifetime = TimeSpan.FromDays(14);
        public static readonly TimeSpan AbsoluteLifetime = TimeSpan.FromDays(60);
        public const string ReasonLogout = "logout";
        public const string ReasonReuse = "reuse";
        public const string ReasonAccountDeleted = "account_deleted";

        private readonly CofferDbContext _db;
        private readonly AccessTokenIssuer _issuer;
        private readonly SessionGuardCache _cache;
        private readonly IClock _clock;
        private readonly ILogger<SessionService> _log;

        public SessionService(CofferDbContext db, AccessTokenIssuer issuer, SessionGuardCache cache, IClock clock, ILogger<SessionService> log)
        {
            _db = db;
            _issuer = issuer;
            _cache = cache;
            _clock = clock;
            _log = log;
        }

        private static MarketplaceException Invalid() =>
            MarketplaceException.Unauthorized("invalidRefreshToken", "Your session has ended. Sign in again.");

        public async Task<SessionTokens> IssueAsync(Guid userId)
        {
            var now = _clock.UtcNow;
            // Ended sessions of this user are no longer useful to anyone.
            await _db.AuthSessions.Where(s => s.UserId == userId && s.ExpiresAt <= now).ExecuteDeleteAsync();

            var session = new AuthSession { Id = Guid.NewGuid(), UserId = userId, CreatedAt = now, LastUsedAt = now, ExpiresAt = now.Add(AbsoluteLifetime) };
            _db.AuthSessions.Add(session);
            var refresh = NewRefreshToken(session, now);
            await _db.SaveChangesAsync();
            return Tokens(session, refresh);
        }

        public async Task<SessionTokens> RefreshAsync(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) throw Invalid();
            var now = _clock.UtcNow;
            var hash = SecureRandom.Sha256Hex(refreshToken);

            var found = await _db.AuthRefreshTokens.AsNoTracking().Where(t => t.TokenHash == hash)
                .Join(_db.AuthSessions.AsNoTracking(), t => t.SessionId, s => s.Id, (t, s) => new { Token = t, Session = s })
                .FirstOrDefaultAsync();
            if (found == null) throw Invalid();
            var (token, session) = (found.Token, found.Session);

            if (token.ConsumedAt != null) throw await ReuseAsync(session.Id);
            var userLive = await _db.Users.AnyAsync(u => u.Id == session.UserId && u.DeletedAt == null);
            if (session.RevokedAt != null || session.ExpiresAt <= now || token.ExpiresAt <= now || !userLive) throw Invalid();

            // Two refreshes with the same token at once: only one passes this conditional update; the other is reuse.
            if (!await TryConsumeAsync(token.Id)) throw await ReuseAsync(session.Id);

            await _db.AuthSessions.Where(s => s.Id == session.Id).ExecuteUpdateAsync(u => u.SetProperty(s => s.LastUsedAt, now));
            // Tokens past their idle end can't be used any more; consumed ones are kept until then for reuse detection.
            await _db.AuthRefreshTokens.Where(t => t.SessionId == session.Id && t.ExpiresAt <= now).ExecuteDeleteAsync();
            var next = NewRefreshToken(session, now);
            await _db.SaveChangesAsync();
            return Tokens(session, next);
        }

        /// <summary>Marks the token consumed if nobody did yet. True for exactly one caller.</summary>
        public async Task<bool> TryConsumeAsync(Guid tokenId)
        {
            var now = _clock.UtcNow;
            var rows = await _db.AuthRefreshTokens.Where(t => t.Id == tokenId && t.ConsumedAt == null)
                .ExecuteUpdateAsync(u => u.SetProperty(t => t.ConsumedAt, now));
            return rows == 1;
        }

        public async Task RevokeByRefreshTokenAsync(string refreshToken, string reason)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return;
            var hash = SecureRandom.Sha256Hex(refreshToken);
            var sessionId = await _db.AuthRefreshTokens.AsNoTracking().Where(t => t.TokenHash == hash).Select(t => (Guid?)t.SessionId).FirstOrDefaultAsync();
            if (sessionId != null) await RevokeAsync(sessionId.Value, reason);
        }

        public async Task RevokeAsync(Guid sessionId, string reason)
        {
            var now = _clock.UtcNow;
            await _db.AuthSessions.Where(s => s.Id == sessionId && s.RevokedAt == null)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.RevokedAt, now).SetProperty(s => s.RevokeReason, reason));
            _cache.Evict(sessionId);
        }

        public async Task RevokeAllForUserAsync(Guid userId, string reason)
        {
            var now = _clock.UtcNow;
            var ids = await _db.AuthSessions.Where(s => s.UserId == userId && s.RevokedAt == null).Select(s => s.Id).ToListAsync();
            await _db.AuthSessions.Where(s => s.UserId == userId && s.RevokedAt == null)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.RevokedAt, now).SetProperty(s => s.RevokeReason, reason));
            foreach (var id in ids) _cache.Evict(id);
        }

        public async Task<bool> IsActiveAsync(Guid sessionId)
        {
            if (_cache.Get(sessionId) is { } cached) return cached;
            var now = _clock.UtcNow;
            var active = await _db.AuthSessions.AsNoTracking().AnyAsync(s => s.Id == sessionId && s.RevokedAt == null && s.ExpiresAt > now);
            _cache.Set(sessionId, active);
            return active;
        }

        private async Task<MarketplaceException> ReuseAsync(Guid sessionId)
        {
            _log.LogWarning("Refresh token reuse on session {SessionId}; the session was revoked.", sessionId);
            await RevokeAsync(sessionId, ReasonReuse);
            return Invalid();
        }

        private string NewRefreshToken(AuthSession session, DateTime now)
        {
            var raw = SecureRandom.Token();
            var idleEnd = now.Add(IdleLifetime);
            _db.AuthRefreshTokens.Add(new AuthRefreshToken
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                TokenHash = SecureRandom.Sha256Hex(raw),
                CreatedAt = now,
                ExpiresAt = idleEnd < session.ExpiresAt ? idleEnd : session.ExpiresAt,
            });
            return raw;
        }

        private SessionTokens Tokens(AuthSession session, string refreshToken)
        {
            var (access, expires) = _issuer.Issue(session.UserId, session.Id);
            return new SessionTokens(access, expires, refreshToken);
        }
    }
}
