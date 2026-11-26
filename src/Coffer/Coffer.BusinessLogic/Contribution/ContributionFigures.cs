using Coffer.DataAccess;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Contribution
{
    /// <summary>The figures both the phone and the Manager show: a vote's standings and a photo phase's totals.</summary>
    public static class ContributionFigures
    {
        /// <summary>Every candidate in position order with its votes and share of all votes (0 while nobody voted).</summary>
        public static List<ResultRowDto> Rows(ContributionPhase phase, IReadOnlyDictionary<Guid, int> counts)
        {
            var total = counts.Values.Sum();
            return phase.Candidates.OrderBy(c => c.Position).Select(c => new ResultRowDto
            {
                CandidateId = c.Id, Name = c.Name, NameTranslations = c.NameTranslations,
                Votes = counts.GetValueOrDefault(c.Id), Share = total == 0 ? 0 : (double)counts.GetValueOrDefault(c.Id) / total,
            }).ToList();
        }

        /// <summary>Detection photos, forms, the photos in those forms, and how many people sent any of them.</summary>
        public static async Task<PhotoTotalsDto> PhotoTotalsAsync(CofferDbContext db, Guid phaseId)
        {
            var uploads = db.ContributionUploads.Where(u => u.PhaseId == phaseId);
            return new PhotoTotalsDto(
                await uploads.CountAsync(u => u.Kind == ContributionUploadKind.Detection),
                await db.ContributionForms.CountAsync(f => f.PhaseId == phaseId),
                await uploads.CountAsync(u => u.Kind == ContributionUploadKind.Classification),
                await uploads.Select(u => u.UserId).Distinct().CountAsync());
        }
    }
}
