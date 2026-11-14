using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Moderation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Moderation
{
    /// <summary>What a suspended user is told (also the 403 body of every blocked request).</summary>
    public sealed record ActiveSuspensionDto(Guid Id, string Reason, DateTime StartsAt, DateTime EndsAt);

    /// <summary>"active" | "expired" | "revoked".</summary>
    public sealed record SuspensionDto(
        Guid Id,
        UserSummaryDto User,
        string Reason,
        DateTime StartsAt,
        DateTime EndsAt,
        string Status,
        ManagerAdminDto? CreatedBy,
        Guid? SourceReportId,
        DateTime? RevokedAt,
        ManagerAdminDto? RevokedBy,
        string? RevokeReason,
        DateTime CreatedAt);

    public sealed record CreateSuspensionInput(Guid UserId, int DurationHours, string Reason);

    public sealed record RevokeSuspensionInput(string Reason);

    public sealed record PagedResult<T>(List<T> Items, int Page, int PageSize, int Total);

    public sealed record AdminUserDto(Guid Id, string Name, string? Avatar, string Provider, DateTime CreatedAt, ActiveSuspensionDto? ActiveSuspension, int RemovalCount);

    public interface ISuspensionService
    {
        /// <summary>The user's active suspension, if any (cached briefly; this runs on every request).</summary>
        Task<ActiveSuspensionDto?> GetActiveAsync(Guid userId);
        Task<SuspensionDto> SuspendAsync(Guid adminId, CreateSuspensionInput input);
        Task<SuspensionDto> RevokeAsync(Guid adminId, Guid suspensionId, RevokeSuspensionInput input);
        Task<PagedResult<SuspensionDto>> ListAsync(string? status, Guid? userId, int page, int pageSize);
        Task<PagedResult<AdminUserDto>> SearchUsersAsync(string? query, int page, int pageSize);

        /// <summary>
        /// Adds a suspension to the context without saving (used inside report resolution's transaction).
        /// Returns null when an active suspension already lasts at least as long, so nobody is suspended twice.
        /// </summary>
        Task<UserSuspension?> AddAsync(Guid adminId, Guid userId, TimeSpan duration, string reason, Guid? sourceReportId);
        void Forget(Guid userId);
    }

    public sealed class SuspensionService : ISuspensionService
    {
        public const int MinHours = 1;
        public const int MaxHours = 24 * 365;
        public const string SuspendedCode = "account_suspended";
        private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(15);

        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IMemoryCache _cache;

        public SuspensionService(CofferDbContext db, IClock clock, IMemoryCache cache)
        {
            _db = db;
            _clock = clock;
            _cache = cache;
        }

        private static string CacheKey(Guid userId) => $"suspension:{userId}";

        public async Task<ActiveSuspensionDto?> GetActiveAsync(Guid userId)
        {
            var now = _clock.UtcNow;
            if (_cache.TryGetValue(CacheKey(userId), out ActiveSuspensionDto? cached))
                return cached != null && cached.EndsAt > now ? cached : null;

            var active = await _db.UserSuspensions.AsNoTracking()
                .Where(s => s.UserId == userId && s.RevokedAt == null && s.StartsAt <= now && s.EndsAt > now)
                .OrderByDescending(s => s.EndsAt)
                .Select(s => new ActiveSuspensionDto(s.Id, s.Reason, s.StartsAt, s.EndsAt))
                .FirstOrDefaultAsync();
            _cache.Set(CacheKey(userId), active, CacheFor);
            return active;
        }

        public void Forget(Guid userId) => _cache.Remove(CacheKey(userId));

        public async Task<SuspensionDto> SuspendAsync(Guid adminId, CreateSuspensionInput input)
        {
            var reason = Text.Required(input.Reason, 10, 1000, "Reason");
            var hours = ValidateHours(input.DurationHours);
            if (!await _db.Users.AnyAsync(u => u.Id == input.UserId)) throw MarketplaceException.NotFound("User not found.");

            var suspension = await AddAsync(adminId, input.UserId, TimeSpan.FromHours(hours), reason, null)
                ?? throw MarketplaceException.Conflict("This user already has an active suspension that lasts at least as long.");
            await _db.SaveChangesAsync();
            Forget(input.UserId);
            return await GetDtoAsync(suspension.Id);
        }

        public async Task<UserSuspension?> AddAsync(Guid adminId, Guid userId, TimeSpan duration, string reason, Guid? sourceReportId)
        {
            var now = _clock.UtcNow;
            var ends = now.Add(duration);
            var pending = _db.ChangeTracker.Entries<UserSuspension>().Select(e => e.Entity)
                .Where(s => s.UserId == userId && s.IsActiveAt(now)).ToList();
            var stored = await _db.UserSuspensions.Where(s => s.UserId == userId && s.RevokedAt == null && s.StartsAt <= now && s.EndsAt > now).ToListAsync();
            if (pending.Concat(stored).Any(s => s.EndsAt >= ends)) return null;

            var suspension = new UserSuspension
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Reason = reason,
                StartsAt = now,
                EndsAt = ends,
                CreatedByAdminId = adminId,
                SourceReportId = sourceReportId,
                CreatedAt = now,
            };
            _db.UserSuspensions.Add(suspension);
            AdminAudit.Add(_db, adminId, "suspension.create", "user", userId,
                new { suspensionId = suspension.Id, hours = Math.Round(duration.TotalHours, 2), reason, sourceReportId }, now);
            return suspension;
        }

        public async Task<SuspensionDto> RevokeAsync(Guid adminId, Guid suspensionId, RevokeSuspensionInput input)
        {
            var reason = Text.Required(input?.Reason, 3, 1000, "Revoke reason");
            var suspension = await _db.UserSuspensions.FirstOrDefaultAsync(s => s.Id == suspensionId)
                ?? throw MarketplaceException.NotFound("Suspension not found.");
            var now = _clock.UtcNow;
            if (!suspension.IsActiveAt(now)) throw MarketplaceException.Conflict("Only an active suspension can be revoked.");

            suspension.RevokedAt = now;
            suspension.RevokedByAdminId = adminId;
            suspension.RevokeReason = reason;
            AdminAudit.Add(_db, adminId, "suspension.revoke", "user", suspension.UserId, new { suspensionId, reason }, now);
            await _db.SaveChangesAsync();
            Forget(suspension.UserId);
            return await GetDtoAsync(suspension.Id);
        }

        public async Task<PagedResult<SuspensionDto>> ListAsync(string? status, Guid? userId, int page, int pageSize)
        {
            (page, pageSize) = Paging(page, pageSize);
            var now = _clock.UtcNow;
            var q = _db.UserSuspensions.AsNoTracking();
            if (userId.HasValue) q = q.Where(s => s.UserId == userId.Value);
            q = (status ?? "all").Trim().ToLowerInvariant() switch
            {
                "active" => q.Where(s => s.RevokedAt == null && s.StartsAt <= now && s.EndsAt > now),
                "expired" => q.Where(s => s.RevokedAt == null && s.EndsAt <= now),
                "revoked" => q.Where(s => s.RevokedAt != null),
                "all" or "" => q,
                _ => throw MarketplaceException.Validation("Unknown status (use active, expired, revoked or all)."),
            };
            var total = await q.CountAsync();
            var rows = await q.OrderByDescending(s => s.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return new PagedResult<SuspensionDto>(await ToDtosAsync(rows), page, pageSize, total);
        }

        public async Task<PagedResult<AdminUserDto>> SearchUsersAsync(string? query, int page, int pageSize)
        {
            (page, pageSize) = Paging(page, pageSize);
            var q = _db.Users.AsNoTracking();
            var text = query?.Trim();
            if (!string.IsNullOrEmpty(text))
            {
                var lower = text.ToLowerInvariant();
                q = Guid.TryParse(text, out var id) ? q.Where(u => u.Id == id) : q.Where(u => u.Name.ToLower().Contains(lower));
            }
            var total = await q.CountAsync();
            var users = await q.OrderBy(u => u.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            var ids = users.Select(u => u.Id).ToList();
            var now = _clock.UtcNow;
            var active = await _db.UserSuspensions.AsNoTracking()
                .Where(s => ids.Contains(s.UserId) && s.RevokedAt == null && s.StartsAt <= now && s.EndsAt > now).ToListAsync();
            var removals = await _db.ModerationActions.AsNoTracking().Where(a => ids.Contains(a.UserId))
                .GroupBy(a => a.UserId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
            var items = users.Select(u =>
            {
                var s = active.Where(x => x.UserId == u.Id).OrderByDescending(x => x.EndsAt).FirstOrDefault();
                return new AdminUserDto(u.Id, u.Name, u.Avatar, u.Provider, u.CreatedAt,
                    s == null ? null : new ActiveSuspensionDto(s.Id, s.Reason, s.StartsAt, s.EndsAt),
                    removals.GetValueOrDefault(u.Id));
            }).ToList();
            return new PagedResult<AdminUserDto>(items, page, pageSize, total);
        }

        public static int ValidateHours(int hours)
        {
            if (hours < MinHours || hours > MaxHours)
                throw MarketplaceException.Validation($"Suspension length must be between {MinHours} hour and {MaxHours / 24} days.");
            return hours;
        }

        public static (int Page, int PageSize) Paging(int page, int pageSize) =>
            (Math.Max(1, page), pageSize <= 0 ? 50 : Math.Min(pageSize, 200));

        private async Task<SuspensionDto> GetDtoAsync(Guid id)
        {
            var row = await _db.UserSuspensions.AsNoTracking().FirstAsync(s => s.Id == id);
            return (await ToDtosAsync(new List<UserSuspension> { row }))[0];
        }

        private async Task<List<SuspensionDto>> ToDtosAsync(List<UserSuspension> rows)
        {
            var now = _clock.UtcNow;
            var userIds = rows.Select(r => r.UserId).Distinct().ToList();
            var adminIds = rows.SelectMany(r => new[] { (Guid?)r.CreatedByAdminId, r.RevokedByAdminId }).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
            var users = await _db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, UserSummaryDto.From);
            var admins = await _db.ManagerAdmins.AsNoTracking().Where(a => adminIds.Contains(a.Id))
                .ToDictionaryAsync(a => a.Id, a => new ManagerAdminDto(a.Id, a.GithubId, a.Login));
            return rows.Select(s => new SuspensionDto(
                s.Id,
                users.TryGetValue(s.UserId, out var u) ? u : new UserSummaryDto(s.UserId, "deleted user", null),
                s.Reason, s.StartsAt, s.EndsAt,
                s.RevokedAt != null ? "revoked" : s.EndsAt <= now ? "expired" : "active",
                admins.GetValueOrDefault(s.CreatedByAdminId),
                s.SourceReportId,
                s.RevokedAt,
                s.RevokedByAdminId.HasValue ? admins.GetValueOrDefault(s.RevokedByAdminId.Value) : null,
                s.RevokeReason,
                s.CreatedAt)).ToList();
        }
    }
}
