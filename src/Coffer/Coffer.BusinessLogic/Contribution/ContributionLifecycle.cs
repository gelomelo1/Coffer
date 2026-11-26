using Coffer.BusinessLogic.Marketplace;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Contribution
{
    public interface IContributionLifecycle
    {
        /// <summary>
        /// Closes every open phase whose end date has passed (winner decided for votes; the switch turns off with
        /// "justFinished" when it was the active phase) and answers the switch. Called first by every contribution
        /// request, so end times are exact; the hourly sweep persists the same change when nobody asks.
        /// </summary>
        Task<ContributionSettings> SettleAsync();

        /// <summary>Closes an open phase at <paramref name="at"/>; switches off with <paramref name="reason"/> when it is the active phase. Not saved.</summary>
        Task CloseAsync(ContributionPhase phase, DateTime at, ContributionSettings settings, string reason);

        /// <summary>The vote count per candidate of a voting phase (every candidate present, 0 when none).</summary>
        Task<Dictionary<Guid, int>> CountsAsync(ContributionPhase phase);
    }

    public sealed class ContributionLifecycle : IContributionLifecycle
    {
        private readonly CofferDbContext _db;
        private readonly IClock _clock;

        public ContributionLifecycle(CofferDbContext db, IClock clock)
        {
            _db = db;
            _clock = clock;
        }

        public async Task<ContributionSettings> SettleAsync()
        {
            var now = _clock.UtcNow;
            var settings = await _db.ContributionSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new ContributionSettings { Id = 1, Enabled = false, Reason = ContributionReasons.CommunityTooSmall, UpdatedAt = now };
                _db.ContributionSettings.Add(settings);
                await _db.SaveChangesAsync();
            }

            var due = await _db.ContributionPhases.Include(p => p.Candidates)
                .Where(p => p.State == ContributionPhaseState.Open && p.EndsAt != null && p.EndsAt <= now).ToListAsync();
            if (due.Count == 0) return settings;
            foreach (var phase in due)
                await CloseAsync(phase, DateTime.SpecifyKind(phase.EndsAt!.Value, DateTimeKind.Utc), settings, ContributionReasons.JustFinished);
            await _db.SaveChangesAsync();
            return settings;
        }

        public async Task CloseAsync(ContributionPhase phase, DateTime at, ContributionSettings settings, string reason)
        {
            phase.State = ContributionPhaseState.Closed;
            phase.ClosedAt = at;
            phase.UpdatedAt = _clock.UtcNow;
            if (phase.Kind == ContributionPhaseKind.Vote && phase.WinnerCandidateId == null)
                phase.WinnerCandidateId = ContributionRules.DecideWinner(await CountsAsync(phase));
            SwitchOffIfActive(settings, phase.Id, reason, _clock.UtcNow);
        }

        public async Task<Dictionary<Guid, int>> CountsAsync(ContributionPhase phase)
        {
            var counts = await _db.ContributionVotes.Where(v => v.PhaseId == phase.Id)
                .GroupBy(v => v.CandidateId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
            var candidateIds = phase.Candidates.Count > 0
                ? phase.Candidates.Select(c => c.Id).ToList()
                : await _db.ContributionCandidates.Where(c => c.PhaseId == phase.Id).Select(c => c.Id).ToListAsync();
            return candidateIds.ToDictionary(id => id, id => counts.TryGetValue(id, out var n) ? n : 0);
        }

        /// <summary>The switch turns off when the phase it points at ends (a paused phase leaves the chosen reason alone).</summary>
        public static void SwitchOffIfActive(ContributionSettings settings, Guid phaseId, string reason, DateTime now)
        {
            if (!settings.Enabled || settings.ActivePhaseId != phaseId) return;
            settings.Enabled = false;
            settings.Reason = reason;
            settings.UpdatedAt = now;
        }
    }

    /// <summary>The hourly maintenance run closes phases nobody has asked about since their end date.</summary>
    public sealed class ContributionSweep : IMarketplaceSweep
    {
        private readonly IContributionLifecycle _lifecycle;

        public ContributionSweep(IContributionLifecycle lifecycle)
        {
            _lifecycle = lifecycle;
        }

        public Task SweepAsync() => _lifecycle.SettleAsync();
    }
}
