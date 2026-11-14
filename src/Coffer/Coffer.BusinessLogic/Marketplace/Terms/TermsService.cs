using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Terms
{
    public record AcceptTermsInput(string Version, bool IsAdult, bool IsPrivatePerson);

    public record TermsStatusDto(string CurrentVersion, string? AcceptedVersion, bool Accepted, DateTime? AcceptedAt);

    /// <summary>
    /// Marketplace terms gate: users must accept the current terms (Coffer is not a party to deals, no payments,
    /// private persons 18+ only, content rules) before listing, chatting about listings or making deals.
    /// Bump CurrentVersion whenever the terms text in the app changes; everyone is asked again.
    /// </summary>
    public static class MarketTerms
    {
        public const string CurrentVersion = "2026-11-14";
        public const string TermsRequiredCode = "terms_required";

        public static async Task EnsureAcceptedAsync(CofferDbContext db, Guid userId)
        {
            var version = await db.Users.Where(u => u.Id == userId).Select(u => u.MarketTermsVersion).FirstOrDefaultAsync();
            if (version != CurrentVersion)
                throw new MarketplaceException(MarketplaceError.Conflict,
                    "Please accept the marketplace terms first.", TermsRequiredCode);
        }
    }

    public class TermsService
    {
        private readonly CofferDbContext _db;
        private readonly IClock _clock;

        public TermsService(CofferDbContext db, IClock clock)
        {
            _db = db;
            _clock = clock;
        }

        public async Task<TermsStatusDto> GetAsync(Guid userId)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw MarketplaceException.NotFound("User not found.");
            return new TermsStatusDto(MarketTerms.CurrentVersion, user.MarketTermsVersion,
                user.MarketTermsVersion == MarketTerms.CurrentVersion, user.MarketTermsAcceptedAt);
        }

        public async Task<TermsStatusDto> AcceptAsync(Guid userId, AcceptTermsInput input)
        {
            if (input.Version != MarketTerms.CurrentVersion)
                throw MarketplaceException.Validation("These terms are outdated. Reload and read the current version.");
            if (!input.IsAdult) throw MarketplaceException.Validation("The marketplace is for people aged 18 or over.");
            if (!input.IsPrivatePerson) throw MarketplaceException.Validation("The marketplace is for private persons only, not businesses.");

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId) ?? throw MarketplaceException.NotFound("User not found.");
            user.MarketTermsVersion = MarketTerms.CurrentVersion;
            user.MarketTermsAcceptedAt = _clock.UtcNow;
            await _db.SaveChangesAsync();
            return await GetAsync(userId);
        }
    }
}
