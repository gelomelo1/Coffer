using Coffer.BusinessLogic.Activity;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Contribution
{
    public partial interface IContributionService
    {
        Task<ContributionStateDto> GetAsync(Guid userId);
        Task<MyVoteDto> VoteAsync(Guid userId, VoteInput input);
    }

    /// <summary>
    /// Shape What's Next for app users: the page's state, voting and (ContributionService.Uploads.cs) photo uploads.
    /// Every request settles due phases first, so nothing is accepted after a phase's end time.
    /// </summary>
    public sealed partial class ContributionService : IContributionService
    {
        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IContributionLifecycle _lifecycle;
        private readonly IActivityLog _activity;

        public ContributionService(CofferDbContext db, IClock clock, IContributionLifecycle lifecycle, IActivityLog activity)
        {
            _db = db;
            _clock = clock;
            _lifecycle = lifecycle;
            _activity = activity;
        }

        public async Task<ContributionStateDto> GetAsync(Guid userId)
        {
            var settings = await _lifecycle.SettleAsync();
            var now = _clock.UtcNow;
            PhaseViewDto? view = null;
            if (settings.Enabled && settings.ActivePhaseId != null)
            {
                var phase = await _db.ContributionPhases.AsNoTracking().Include(p => p.Candidates)
                    .FirstOrDefaultAsync(p => p.Id == settings.ActivePhaseId && p.State == ContributionPhaseState.Open);
                if (phase != null) view = await ViewAsync(phase, userId, now);
            }
            return new ContributionStateDto(now, settings.Enabled && view != null, settings.Enabled && view != null ? null : settings.Reason ?? ContributionReasons.CommunityTooSmall,
                view, await LatestResultAsync());
        }

        public async Task<MyVoteDto> VoteAsync(Guid userId, VoteInput input)
        {
            var phase = await RequireRunningAsync(input.PhaseId, ContributionPhaseKind.Vote);
            var candidate = phase.Candidates.FirstOrDefault(c => c.Id == input.CandidateId)
                ?? throw MarketplaceException.Validation("contributionUnknownCandidate", "That candidate is not part of this phase.");
            var text = (input.Text ?? "").Trim();
            if (text.Length is < ContributionRules.TextMin or > ContributionRules.TextMax)
                throw MarketplaceException.Validation("contributionVoteText", "Write 10 to 1000 characters about the attributes you'd like and why.");

            var now = _clock.UtcNow;
            var vote = await _db.ContributionVotes.FirstOrDefaultAsync(v => v.PhaseId == phase.Id && v.UserId == userId);
            if (vote == null)
            {
                _db.ContributionVotes.Add(new ContributionVote
                {
                    PhaseId = phase.Id, UserId = userId, CandidateId = candidate.Id, Text = text, CreatedAt = now, UpdatedAt = now,
                });
                _activity.Record(userId, "contribution.voted", new ActivityTargets(), new { phaseId = phase.Id, candidate = candidate.Name });
            }
            else
            {
                var previous = phase.Candidates.FirstOrDefault(c => c.Id == vote.CandidateId)?.Name;
                vote.CandidateId = candidate.Id;
                vote.Text = text;
                vote.UpdatedAt = now;
                _activity.Record(userId, "contribution.voteChanged", new ActivityTargets(),
                    new { phaseId = phase.Id, candidate = candidate.Name, previousCandidate = previous });
            }
            await SaveWhileRunningAsync(phase.Id);
            return new MyVoteDto(candidate.Id, text);
        }

        /// <summary>
        /// The phase a vote or upload is for, only while it runs: the switch is on, it is the active phase, it is open
        /// and its end time has not come. Otherwise 409 contributionClosed; the wrong kind of phase is 400.
        /// </summary>
        private async Task<ContributionPhase> RequireRunningAsync(Guid phaseId, ContributionPhaseKind kind)
        {
            var settings = await _lifecycle.SettleAsync();
            var phase = settings.Enabled && settings.ActivePhaseId == phaseId
                ? await _db.ContributionPhases.Include(p => p.Candidates).FirstOrDefaultAsync(p => p.Id == phaseId)
                : null;
            if (phase == null || phase.State != ContributionPhaseState.Open || phase.EndsAt == null || phase.EndsAt <= _clock.UtcNow)
                throw MarketplaceException.Conflict("contributionClosed", "This contribution period is not running.");
            if (phase.Kind != kind)
                throw MarketplaceException.Validation("contributionWrongPhase", "This phase doesn't take that.");
            return phase;
        }

        /// <summary>
        /// Saves a vote or upload only if its phase still runs at this moment, holding the phase row until the save is
        /// committed: a request that started before the end but would land after it is refused (contributionClosed),
        /// and a close waits for it and counts it.
        /// </summary>
        private async Task SaveWhileRunningAsync(Guid phaseId)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            if (!await _lifecycle.HoldOpenAsync(phaseId, _clock.UtcNow))
            {
                await tx.RollbackAsync();
                _db.ChangeTracker.Clear();
                throw MarketplaceException.Conflict("contributionClosed", "This contribution period is not running.");
            }
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        private async Task<PhaseViewDto> ViewAsync(ContributionPhase phase, Guid userId, DateTime now)
        {
            var openedAt = Utc(phase.OpenedAt ?? phase.CreatedAt);
            var endsAt = Utc(phase.EndsAt!.Value);
            if (phase.Kind == ContributionPhaseKind.Vote)
            {
                var mine = await _db.ContributionVotes.AsNoTracking().FirstOrDefaultAsync(v => v.PhaseId == phase.Id && v.UserId == userId);
                return new PhaseViewDto(phase.Id, "vote", openedAt, endsAt, phase.Candidates.OrderBy(c => c.Position).Select(View).ToList(),
                    mine == null ? null : new MyVoteDto(mine.CandidateId, mine.Text), null, null, null);
            }

            var source = await _db.ContributionPhases.AsNoTracking().Include(p => p.Candidates).FirstOrDefaultAsync(p => p.Id == phase.SourcePhaseId);
            var winner = source?.Candidates.FirstOrDefault(c => c.Id == source.WinnerCandidateId);
            return new PhaseViewDto(phase.Id, "photo", openedAt, endsAt, null, null, winner == null ? null : View(winner),
                await MineAsync(phase.Id, userId), await LimitsAsync(userId, now));
        }

        private async Task<MineDto> MineAsync(Guid phaseId, Guid userId) => new(
            await _db.ContributionUploads.CountAsync(u => u.PhaseId == phaseId && u.UserId == userId && u.Kind == ContributionUploadKind.Detection),
            await _db.ContributionForms.CountAsync(f => f.PhaseId == phaseId && f.UserId == userId));

        private async Task<LimitsDto> LimitsAsync(Guid userId, DateTime now)
        {
            var (used, resetsAt) = await TodayAsync(userId, now);
            return new LimitsDto(ContributionRules.PerUpload, ContributionRules.FormMin, ContributionRules.FormMax,
                Math.Max(0, ContributionRules.DailyLimit - used), resetsAt);
        }

        /// <summary>The user's contribution photos since the start of the UTC day, and when the day ends.</summary>
        private async Task<(int Used, DateTime ResetsAt)> TodayAsync(Guid userId, DateTime now)
        {
            var dayStart = DateTime.SpecifyKind(now.Date, DateTimeKind.Utc);
            var used = await _db.ContributionUploads.CountAsync(u => u.UserId == userId && u.CreatedAt >= dayStart);
            return (used, dayStart.AddDays(1));
        }

        private async Task<LatestResultDto?> LatestResultAsync()
        {
            var phase = await _db.ContributionPhases.AsNoTracking().Include(p => p.Candidates)
                .Where(p => p.Kind == ContributionPhaseKind.Vote && p.State == ContributionPhaseState.Closed && p.WinnerCandidateId != null)
                .OrderByDescending(p => p.ClosedAt).FirstOrDefaultAsync();
            if (phase == null) return null;
            var counts = await _lifecycle.CountsAsync(phase);
            var total = counts.Values.Sum();
            var rows = phase.Candidates.OrderBy(c => c.Position).Select(c => new ResultRowDto
            {
                CandidateId = c.Id, Name = c.Name, NameTranslations = c.NameTranslations,
                Votes = counts.GetValueOrDefault(c.Id), Share = total == 0 ? 0 : (double)counts.GetValueOrDefault(c.Id) / total,
            }).ToList();
            return new LatestResultDto(phase.Id, phase.WinnerCandidateId!.Value, rows);
        }

        private static CandidateViewDto View(ContributionCandidate c) => new()
        {
            Id = c.Id, Name = c.Name, Description = c.Description, NameTranslations = c.NameTranslations, DescriptionTranslations = c.DescriptionTranslations,
        };

        private static DateTime Utc(DateTime at) => DateTime.SpecifyKind(at, DateTimeKind.Utc);
    }
}
