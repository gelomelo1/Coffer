using Coffer.BusinessLogic.ItemTypes;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.DataAccess;
using Coffer.DataAccess.Extensions;
using Coffer.Domain.Entities;
using Coffer.Domain.Paging;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Contribution
{
    public interface IContributionAdminService
    {
        Task<AdminSettingsDto> GetSettingsAsync();
        Task<AdminSettingsDto> SetSettingsAsync(Guid adminId, SettingsInput input);
        Task<List<AdminPhaseDto>> ListPhasesAsync(string? kind, string? state);
        Task<AdminPhaseDto> GetPhaseAsync(Guid id);
        Task<PagedList<VoteTextDto>> TextsAsync(Guid id, Guid? candidateId, int? page);
        Task<AdminPhaseDto> CreatePhaseAsync(Guid adminId, PhaseInput input);
        Task<AdminPhaseDto> UpdatePhaseAsync(Guid adminId, Guid id, PhaseInput input);
        Task<AdminPhaseDto> CloseAsync(Guid adminId, Guid id, string? reason);
        Task<AdminPhaseDto> InterruptAsync(Guid adminId, Guid id, string? reason);
        Task<AdminPhaseDto> PickWinnerAsync(Guid adminId, Guid id, Guid candidateId);
        Task DeleteAsync(Guid adminId, Guid id);
    }

    /// <summary>
    /// Shape What's Next as the Manager runs it: the switch (on with a draft or open phase, off with a reason — an open
    /// phase is then paused), voting and photo phases, results and free texts. Every change is audited.
    /// </summary>
    public sealed class ContributionAdminService : IContributionAdminService
    {
        public const int TextsPageSize = 50;

        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IContributionLifecycle _lifecycle;

        public ContributionAdminService(CofferDbContext db, IClock clock, IContributionLifecycle lifecycle)
        {
            _db = db;
            _clock = clock;
            _lifecycle = lifecycle;
        }

        // ------------------------------------------------------------------ switch

        public async Task<AdminSettingsDto> GetSettingsAsync() => ToDto(await _lifecycle.SettleAsync());

        public async Task<AdminSettingsDto> SetSettingsAsync(Guid adminId, SettingsInput input)
        {
            var settings = await _lifecycle.SettleAsync();
            var now = _clock.UtcNow;
            if (input.Enabled)
            {
                var id = input.ActivePhaseId ?? throw MarketplaceException.Validation("contributionActivePhaseRequired", "Choose the phase to run.");
                var phase = await FindAsync(id);
                if (phase.State is not (ContributionPhaseState.Draft or ContributionPhaseState.Open))
                    throw MarketplaceException.Validation("contributionPhaseNotOpenable", "Only a draft or open phase can run.");
                if (await _db.ContributionPhases.AnyAsync(p => p.State == ContributionPhaseState.Open && p.Id != id))
                    throw MarketplaceException.Validation("contributionOtherPhaseOpen", "Another phase is open: close or interrupt it first.");
                if (phase.State == ContributionPhaseState.Draft)
                {
                    RequireEndAhead(phase.EndsAt, now);
                    if (phase.Kind == ContributionPhaseKind.Photo) await RequireSourceWithWinnerAsync(phase.SourcePhaseId);
                    phase.State = ContributionPhaseState.Open;
                    phase.OpenedAt = now;
                    phase.UpdatedAt = now;
                    phase.UpdatedBy = adminId;
                }
                settings.Enabled = true;
                settings.ActivePhaseId = id;
            }
            else
            {
                if (!ContributionReasons.IsValid(input.Reason))
                    throw MarketplaceException.Validation("contributionReasonRequired", "Choose why there is no contribution period.");
                settings.Enabled = false;
                settings.Reason = input.Reason;
            }
            settings.UpdatedAt = now;
            settings.UpdatedBy = adminId;
            Audit(adminId, "contribution.settings", settings.ActivePhaseId, new { settings.Enabled, settings.Reason, settings.ActivePhaseId });
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Another admin opened a different phase at the same moment: the one-open-phase index refused this one.
                throw MarketplaceException.Validation("contributionOtherPhaseOpen", "Another phase is open: close or interrupt it first.");
            }
            return ToDto(settings);
        }

        // ------------------------------------------------------------------ phases

        public async Task<List<AdminPhaseDto>> ListPhasesAsync(string? kind, string? state)
        {
            var settings = await _lifecycle.SettleAsync();
            var query = _db.ContributionPhases.AsNoTracking().Include(p => p.Candidates).AsQueryable();
            var kindFilter = ParseKind(kind, optional: true);
            if (kindFilter != null) query = query.Where(p => p.Kind == kindFilter);
            var stateFilter = ParseState(state);
            if (stateFilter != null) query = query.Where(p => p.State == stateFilter);
            var phases = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
            var result = new List<AdminPhaseDto>();
            foreach (var phase in phases) result.Add(await ToDtoAsync(phase, settings));
            return result;
        }

        public async Task<AdminPhaseDto> GetPhaseAsync(Guid id)
        {
            var settings = await _lifecycle.SettleAsync();
            return await ToDtoAsync(await FindAsync(id), settings);
        }

        public async Task<PagedList<VoteTextDto>> TextsAsync(Guid id, Guid? candidateId, int? page)
        {
            await _lifecycle.SettleAsync();
            await FindAsync(id);
            var query = _db.ContributionVotes.AsNoTracking().Where(v => v.PhaseId == id);
            if (candidateId != null) query = query.Where(v => v.CandidateId == candidateId);
            var result = await query.OrderByDescending(v => v.UpdatedAt).ThenBy(v => v.UserId)
                .Select(v => new VoteTextDto(v.CandidateId, v.Text, v.UpdatedAt)).ToPagedListAsync(page, TextsPageSize);
            return new PagedList<VoteTextDto>(result.Items.Select(t => t with { UpdatedAt = Utc(t.UpdatedAt) }).ToList(), result.Page, result.PageSize, result.Total);
        }

        public async Task<AdminPhaseDto> CreatePhaseAsync(Guid adminId, PhaseInput input)
        {
            var settings = await _lifecycle.SettleAsync();
            var kind = ParseKind(input.Kind, optional: false)!.Value;
            var now = _clock.UtcNow;
            var phase = new ContributionPhase
            {
                Id = Guid.NewGuid(), Kind = kind, State = ContributionPhaseState.Draft, EndsAt = input.EndsAt?.ToUniversalTime(),
                CreatedAt = now, CreatedBy = adminId, UpdatedAt = now, UpdatedBy = adminId,
            };
            if (kind == ContributionPhaseKind.Vote)
                phase.Candidates = ValidateCandidates(input.Candidates, phase.Id);
            else
            {
                await RequireSourceWithWinnerAsync(input.SourcePhaseId);
                phase.SourcePhaseId = input.SourcePhaseId;
            }
            _db.ContributionPhases.Add(phase);
            Audit(adminId, "contribution.create", phase.Id, new { kind = KindText(kind), phase.EndsAt, phase.SourcePhaseId, candidates = phase.Candidates.Select(c => c.Name) });
            await _db.SaveChangesAsync();
            return await ToDtoAsync(phase, settings);
        }

        public async Task<AdminPhaseDto> UpdatePhaseAsync(Guid adminId, Guid id, PhaseInput input)
        {
            var settings = await _lifecycle.SettleAsync();
            var phase = await FindAsync(id);
            var now = _clock.UtcNow;
            switch (phase.State)
            {
                case ContributionPhaseState.Draft:
                    phase.EndsAt = input.EndsAt?.ToUniversalTime();
                    if (phase.Kind == ContributionPhaseKind.Vote && input.Candidates != null)
                    {
                        var replacement = ValidateCandidates(input.Candidates, phase.Id);
                        foreach (var (existing, next) in phase.Candidates.OrderBy(c => c.Position).Zip(replacement))
                        {
                            existing.Name = next.Name;
                            existing.NameTranslations = next.NameTranslations;
                            existing.Description = next.Description;
                            existing.DescriptionTranslations = next.DescriptionTranslations;
                        }
                    }
                    if (phase.Kind == ContributionPhaseKind.Photo && input.SourcePhaseId != null && input.SourcePhaseId != phase.SourcePhaseId)
                    {
                        await RequireSourceWithWinnerAsync(input.SourcePhaseId);
                        phase.SourcePhaseId = input.SourcePhaseId;
                    }
                    break;
                case ContributionPhaseState.Open:
                    if (input.Candidates != null || (input.SourcePhaseId != null && input.SourcePhaseId != phase.SourcePhaseId))
                        throw Locked();
                    var endsAt = input.EndsAt?.ToUniversalTime();
                    RequireEndAhead(endsAt, now);
                    phase.EndsAt = endsAt;
                    break;
                default:
                    throw Locked();
            }
            phase.UpdatedAt = now;
            phase.UpdatedBy = adminId;
            Audit(adminId, "contribution.update", id, new { phase.EndsAt, candidates = phase.Candidates.Select(c => c.Name), phase.SourcePhaseId });
            await _db.SaveChangesAsync();
            return await ToDtoAsync(phase, settings);
        }

        public async Task<AdminPhaseDto> CloseAsync(Guid adminId, Guid id, string? reason)
        {
            await _lifecycle.SettleAsync();
            await RequireOpenAsync(id);
            var switchReason = ContributionReasons.IsValid(reason) ? reason! : ContributionReasons.JustFinished;
            // Conditional: when another admin (or the end date) closed it first, nothing is changed twice.
            if (!await _lifecycle.TryCloseAsync(id, _clock.UtcNow, switchReason, onlyIfDue: false)) throw NotOpen();
            Audit(adminId, "contribution.close", id, new { reason = switchReason });
            await _db.SaveChangesAsync();
            return await FreshAsync(id);
        }

        public async Task<AdminPhaseDto> InterruptAsync(Guid adminId, Guid id, string? reason)
        {
            var settings = await _lifecycle.SettleAsync();
            await RequireOpenAsync(id);
            var running = settings.Enabled && settings.ActivePhaseId == id;
            if (running && !ContributionReasons.IsValid(reason))
                throw MarketplaceException.Validation("contributionReasonRequired", "Choose why there is no contribution period.");
            if (!await _lifecycle.TryInterruptAsync(id, _clock.UtcNow, reason)) throw NotOpen();
            Audit(adminId, "contribution.interrupt", id, new { reason });
            await _db.SaveChangesAsync();
            return await FreshAsync(id);
        }

        /// <summary>The phase as stored now (conditional updates bypass the change tracker).</summary>
        private async Task<AdminPhaseDto> FreshAsync(Guid id)
        {
            _db.ChangeTracker.Clear();
            return await GetPhaseAsync(id);
        }

        private static MarketplaceException NotOpen() =>
            MarketplaceException.Validation("contributionPhaseNotOpen", "Only an open phase can be closed or interrupted.");

        public async Task<AdminPhaseDto> PickWinnerAsync(Guid adminId, Guid id, Guid candidateId)
        {
            var settings = await _lifecycle.SettleAsync();
            var phase = await FindAsync(id);
            if (phase.Kind != ContributionPhaseKind.Vote || phase.State != ContributionPhaseState.Closed)
                throw MarketplaceException.Validation("contributionNotClosedVote", "Only a closed voting phase gets a winner.");
            if (phase.WinnerCandidateId != null)
                throw MarketplaceException.Validation("contributionWinnerSet", "This voting phase already has its winner.");
            if (phase.Candidates.All(c => c.Id != candidateId))
                throw MarketplaceException.Validation("contributionUnknownCandidate", "That candidate is not part of this phase.");
            var counts = await _lifecycle.CountsAsync(phase);
            var top = counts.Values.DefaultIfEmpty(0).Max();
            if (top > 0 && counts[candidateId] != top)
                throw MarketplaceException.Validation("contributionNotTied", "Only one of the tied candidates can win.");
            phase.WinnerCandidateId = candidateId;
            phase.UpdatedAt = _clock.UtcNow;
            phase.UpdatedBy = adminId;
            Audit(adminId, "contribution.winner", id, new { candidateId });
            await _db.SaveChangesAsync();
            return await ToDtoAsync(phase, settings);
        }

        public async Task DeleteAsync(Guid adminId, Guid id)
        {
            await _lifecycle.SettleAsync();
            var phase = await FindAsync(id);
            if (phase.State != ContributionPhaseState.Draft)
                throw MarketplaceException.Validation("contributionNotDraft", "Only a draft can be deleted.");
            _db.ContributionPhases.Remove(phase);
            var settings = await _db.ContributionSettings.FirstAsync(s => s.Id == 1);
            if (settings.ActivePhaseId == id) settings.ActivePhaseId = null;
            Audit(adminId, "contribution.delete", id, new { kind = KindText(phase.Kind) });
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ helpers

        private async Task<ContributionPhase> FindAsync(Guid id) =>
            await _db.ContributionPhases.Include(p => p.Candidates).FirstOrDefaultAsync(p => p.Id == id)
            ?? throw MarketplaceException.NotFound("contributionPhaseNotFound", "Phase not found.");

        private async Task<ContributionPhase> RequireOpenAsync(Guid id)
        {
            var phase = await FindAsync(id);
            if (phase.State != ContributionPhaseState.Open) throw NotOpen();
            return phase;
        }

        private static void RequireEndAhead(DateTime? endsAt, DateTime now)
        {
            if (endsAt == null || endsAt.Value < now + ContributionRules.MinLead)
                throw MarketplaceException.Validation("contributionEndTooSoon", "The end date must be at least 5 minutes ahead.");
        }

        private async Task RequireSourceWithWinnerAsync(Guid? sourceId)
        {
            var ok = sourceId != null && await _db.ContributionPhases.AnyAsync(p => p.Id == sourceId && p.Kind == ContributionPhaseKind.Vote
                && p.State == ContributionPhaseState.Closed && p.WinnerCandidateId != null);
            if (!ok) throw MarketplaceException.Validation("contributionSourceNoWinner", "Choose a closed voting phase that has a winner.");
        }

        private static List<ContributionCandidate> ValidateCandidates(List<CandidateInput>? input, Guid phaseId)
        {
            if (input == null || input.Count != ContributionRules.CandidateCount)
                throw MarketplaceException.Validation("contributionCandidateCount", "A voting phase has exactly 3 candidates.");
            return input.Select((c, i) =>
            {
                var name = (c.Name ?? "").Trim();
                if (name.Length is < 1 or > ContributionRules.NameMax)
                    throw MarketplaceException.Validation("contributionCandidateName", "A candidate's name is 1 to 60 characters.");
                var description = (c.Description ?? "").Trim();
                if (description.Length > ContributionRules.DescriptionMax)
                    throw MarketplaceException.Validation("contributionCandidateDescription", "A candidate's description is at most 300 characters.");
                return new ContributionCandidate
                {
                    Id = Guid.NewGuid(), PhaseId = phaseId, Position = i + 1, Name = name, Description = description,
                    NameTranslations = Translations.Validate(c.NameTranslations, ContributionRules.NameMax),
                    DescriptionTranslations = Translations.Validate(c.DescriptionTranslations, ContributionRules.DescriptionMax),
                };
            }).ToList();
        }

        private async Task<AdminPhaseDto> ToDtoAsync(ContributionPhase phase, ContributionSettings settings)
        {
            var candidates = new List<AdminCandidateDto>();
            var tie = false;
            var usedBy = 0;
            AdminCandidateDto? subject = null;
            PhotoTotalsDto? totals = null;
            string? folder = null;

            if (phase.Kind == ContributionPhaseKind.Vote)
            {
                var counts = await _lifecycle.CountsAsync(phase);
                var total = counts.Values.Sum();
                candidates = phase.Candidates.OrderBy(c => c.Position)
                    .Select(c => Candidate(c, counts.GetValueOrDefault(c.Id), total)).ToList();
                var top = counts.Values.DefaultIfEmpty(0).Max();
                tie = phase.State == ContributionPhaseState.Closed && phase.WinnerCandidateId == null && top > 0 && counts.Values.Count(v => v == top) > 1;
                usedBy = await _db.ContributionPhases.CountAsync(p => p.SourcePhaseId == phase.Id);
            }
            else
            {
                var source = await _db.ContributionPhases.AsNoTracking().Include(p => p.Candidates).FirstOrDefaultAsync(p => p.Id == phase.SourcePhaseId);
                var winner = source?.Candidates.FirstOrDefault(c => c.Id == source.WinnerCandidateId);
                if (winner != null) subject = Candidate(winner, 0, 0);
                var uploads = _db.ContributionUploads.Where(u => u.PhaseId == phase.Id);
                totals = new PhotoTotalsDto(
                    await uploads.CountAsync(u => u.Kind == ContributionUploadKind.Detection),
                    await _db.ContributionForms.CountAsync(f => f.PhaseId == phase.Id),
                    await uploads.CountAsync(u => u.Kind == ContributionUploadKind.Classification),
                    await uploads.Select(u => u.UserId).Distinct().CountAsync());
                folder = ContributionStorage.PhaseDir(phase.Id);
            }

            return new AdminPhaseDto(phase.Id, KindText(phase.Kind), StateText(phase.State), settings.Enabled && settings.ActivePhaseId == phase.Id,
                Utc(phase.OpenedAt), Utc(phase.EndsAt), Utc(phase.ClosedAt), phase.SourcePhaseId, phase.WinnerCandidateId, tie, usedBy,
                candidates, subject, totals, folder, Utc(phase.CreatedAt));
        }

        private static AdminCandidateDto Candidate(ContributionCandidate c, int votes, int total) =>
            new(c.Id, c.Position, c.Name, c.NameTranslations, c.Description, c.DescriptionTranslations, votes, total == 0 ? 0 : (double)votes / total);

        private static ContributionPhaseKind? ParseKind(string? text, bool optional)
        {
            switch ((text ?? "").Trim().ToLowerInvariant())
            {
                case "vote": return ContributionPhaseKind.Vote;
                case "photo": return ContributionPhaseKind.Photo;
                case "" or "all" when optional: return null;
                default: throw MarketplaceException.Validation("contributionUnknownKind", "Kind must be vote or photo.");
            }
        }

        private static ContributionPhaseState? ParseState(string? text) => (text ?? "").Trim().ToLowerInvariant() switch
        {
            "" or "all" => null,
            "draft" => ContributionPhaseState.Draft,
            "open" => ContributionPhaseState.Open,
            "closed" => ContributionPhaseState.Closed,
            "interrupted" => ContributionPhaseState.Interrupted,
            _ => throw MarketplaceException.Validation("contributionUnknownState", "State must be draft, open, closed or interrupted."),
        };

        public static string KindText(ContributionPhaseKind kind) => kind == ContributionPhaseKind.Photo ? "photo" : "vote";

        public static string StateText(ContributionPhaseState state) => state.ToString().ToLowerInvariant();

        private static MarketplaceException Locked() =>
            MarketplaceException.Validation("contributionPhaseLocked", "Only the end date of an open phase can change; a closed phase can't.");

        private void Audit(Guid adminId, string action, Guid? phaseId, object details) =>
            AdminAudit.Add(_db, adminId, action, "contribution", phaseId, details, _clock.UtcNow);

        private static AdminSettingsDto ToDto(ContributionSettings s) => new(s.Enabled, s.Reason, s.ActivePhaseId);

        private static DateTime Utc(DateTime at) => DateTime.SpecifyKind(at, DateTimeKind.Utc);
        private static DateTime? Utc(DateTime? at) => at == null ? null : Utc(at.Value);
    }
}
