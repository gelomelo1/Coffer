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

        /// <summary>
        /// Closes the phase at <paramref name="at"/> only if it is still open (and, with <paramref name="onlyIfDue"/>,
        /// past its end date); the switch turns off with <paramref name="reason"/> when it is the running phase.
        /// False when another request already closed or interrupted it — then nothing changes.
        /// </summary>
        Task<bool> TryCloseAsync(Guid phaseId, DateTime at, string reason, bool onlyIfDue);

        /// <summary>Interrupts the phase only if it is still open; a valid reason switches off the switch pointing at it.</summary>
        Task<bool> TryInterruptAsync(Guid phaseId, DateTime at, string? reason);

        /// <summary>
        /// Inside the caller's transaction, right before a vote or upload is saved: locks the phase row if it is still
        /// open and before its end, so a close waits for this save (and then counts it). False: it ended meanwhile.
        /// </summary>
        Task<bool> HoldOpenAsync(Guid phaseId, DateTime now);

        /// <summary>The vote count per candidate of a voting phase (every candidate present, 0 when none).</summary>
        Task<Dictionary<Guid, int>> CountsAsync(ContributionPhase phase);
    }

    /// <summary>
    /// Phase transitions are conditional updates ("… WHERE state = 'open'"): whichever request gets there first wins,
    /// later ones change nothing. Votes and uploads take the same row lock before saving, so a close never misses
    /// them and nothing is stored after it.
    /// </summary>
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
            var due = await _db.ContributionPhases.AsNoTracking()
                .Where(p => p.State == ContributionPhaseState.Open && p.EndsAt != null && p.EndsAt <= now)
                .Select(p => new { p.Id, p.EndsAt }).ToListAsync();
            foreach (var phase in due)
                await TryCloseAsync(phase.Id, DateTime.SpecifyKind(phase.EndsAt!.Value, DateTimeKind.Utc), ContributionReasons.JustFinished, onlyIfDue: true);

            var settings = await _db.ContributionSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new ContributionSettings { Id = 1, Enabled = false, Reason = ContributionReasons.CommunityTooSmall, UpdatedAt = now };
                _db.ContributionSettings.Add(settings);
                await _db.SaveChangesAsync();
            }
            else if (due.Count > 0)
                await _db.Entry(settings).ReloadAsync(); // the closes above were written past the change tracker
            return settings;
        }

        public async Task<bool> TryCloseAsync(Guid phaseId, DateTime at, string reason, bool onlyIfDue)
        {
            var now = _clock.UtcNow;
            return await InTransactionAsync(async () =>
            {
                var open = _db.ContributionPhases.Where(p => p.Id == phaseId && p.State == ContributionPhaseState.Open);
                if (onlyIfDue) open = open.Where(p => p.EndsAt != null && p.EndsAt <= now);
                var closed = await open.ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.State, ContributionPhaseState.Closed)
                    .SetProperty(p => p.ClosedAt, at)
                    .SetProperty(p => p.UpdatedAt, now));
                if (closed == 0) return false;

                // Counted after the row is closed (and locked): no vote can still arrive for it.
                var phase = await _db.ContributionPhases.AsNoTracking().Include(p => p.Candidates).FirstAsync(p => p.Id == phaseId);
                if (phase.Kind == ContributionPhaseKind.Vote && phase.WinnerCandidateId == null)
                {
                    var winner = ContributionRules.DecideWinner(await CountsAsync(phase));
                    if (winner != null)
                        await _db.ContributionPhases.Where(p => p.Id == phaseId && p.WinnerCandidateId == null)
                            .ExecuteUpdateAsync(s => s.SetProperty(p => p.WinnerCandidateId, winner));
                }
                await SwitchOffIfRunningAsync(phaseId, reason, now);
                return true;
            });
        }

        public async Task<bool> TryInterruptAsync(Guid phaseId, DateTime at, string? reason)
        {
            var now = _clock.UtcNow;
            return await InTransactionAsync(async () =>
            {
                var interrupted = await _db.ContributionPhases.Where(p => p.Id == phaseId && p.State == ContributionPhaseState.Open)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.State, ContributionPhaseState.Interrupted)
                        .SetProperty(p => p.ClosedAt, at)
                        .SetProperty(p => p.UpdatedAt, now));
                if (interrupted == 0) return false;
                if (ContributionReasons.IsValid(reason))
                    await _db.ContributionSettings.Where(s => s.Id == 1 && s.ActivePhaseId == phaseId)
                        .ExecuteUpdateAsync(s => s.SetProperty(x => x.Enabled, false).SetProperty(x => x.Reason, reason).SetProperty(x => x.UpdatedAt, now));
                return true;
            });
        }

        public async Task<bool> HoldOpenAsync(Guid phaseId, DateTime now) =>
            // A no-op update: takes the row lock (PostgreSQL) and succeeds only while the phase still runs.
            await _db.ContributionPhases.Where(p => p.Id == phaseId && p.State == ContributionPhaseState.Open && p.EndsAt != null && p.EndsAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.UpdatedAt, p => p.UpdatedAt)) == 1;

        public async Task<Dictionary<Guid, int>> CountsAsync(ContributionPhase phase)
        {
            var counts = await _db.ContributionVotes.Where(v => v.PhaseId == phase.Id)
                .GroupBy(v => v.CandidateId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
            var candidateIds = phase.Candidates.Count > 0
                ? phase.Candidates.Select(c => c.Id).ToList()
                : await _db.ContributionCandidates.Where(c => c.PhaseId == phase.Id).Select(c => c.Id).ToListAsync();
            return candidateIds.ToDictionary(id => id, id => counts.TryGetValue(id, out var n) ? n : 0);
        }

        /// <summary>The switch turns off when the phase it runs ends (a paused phase leaves the chosen reason alone).</summary>
        private Task SwitchOffIfRunningAsync(Guid phaseId, string reason, DateTime now) =>
            _db.ContributionSettings.Where(s => s.Id == 1 && s.Enabled && s.ActivePhaseId == phaseId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Enabled, false).SetProperty(x => x.Reason, reason).SetProperty(x => x.UpdatedAt, now));

        /// <summary>Runs in the caller's transaction when there is one, else in its own.</summary>
        private async Task<bool> InTransactionAsync(Func<Task<bool>> work)
        {
            if (_db.Database.CurrentTransaction != null) return await work();
            await using var tx = await _db.Database.BeginTransactionAsync();
            var done = await work();
            if (done) await tx.CommitAsync();
            else await tx.RollbackAsync();
            return done;
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
