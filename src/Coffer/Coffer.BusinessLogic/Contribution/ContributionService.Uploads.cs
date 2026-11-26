using Coffer.BusinessLogic.Activity;
using Coffer.BusinessLogic.Images;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Contribution
{
    public partial interface IContributionService
    {
        /// <summary>1–20 photos into the phase's detection pool.</summary>
        Task<MineDto> UploadDetectionAsync(Guid userId, Guid phaseId, IReadOnlyList<IFormFile> images);

        /// <summary>One classification form: 5–10 photos of the same item, stored whole or not at all.</summary>
        Task<MineDto> UploadClassificationAsync(Guid userId, Guid phaseId, IReadOnlyList<IFormFile> images);
    }

    public sealed partial class ContributionService
    {
        public Task<MineDto> UploadDetectionAsync(Guid userId, Guid phaseId, IReadOnlyList<IFormFile> images)
        {
            if (images.Count is < 1 or > ContributionRules.PerUpload)
                throw MarketplaceException.Validation("contributionPhotoCount", "Send 1 to 20 photos at a time.");
            return StoreAsync(userId, phaseId, images, form: false);
        }

        public Task<MineDto> UploadClassificationAsync(Guid userId, Guid phaseId, IReadOnlyList<IFormFile> images)
        {
            if (images.Count is < ContributionRules.FormMin or > ContributionRules.FormMax)
                throw MarketplaceException.Validation("formPhotoCount", "A form has 5 to 10 photos of the same item.");
            return StoreAsync(userId, phaseId, images, form: true);
        }

        /// <summary>
        /// Checks, then prepares every photo in memory (a bad one stops everything before anything is written), writes
        /// them to a temp folder, saves the rows with the activity entry, and only then moves the files into place.
        /// Any failure removes the temp folder and leaves no rows.
        /// </summary>
        private async Task<MineDto> StoreAsync(Guid userId, Guid phaseId, IReadOnlyList<IFormFile> images, bool form)
        {
            var phase = await RequireRunningAsync(phaseId, ContributionPhaseKind.Photo);
            var now = _clock.UtcNow;
            var (used, resetsAt) = await TodayAsync(userId, now);
            if (used + images.Count > ContributionRules.DailyLimit)
                throw MarketplaceException.Validation("contributionDailyLimit",
                    $"You can upload {ContributionRules.DailyLimit} photos a day; more from {resetsAt:yyyy-MM-dd HH:mm} UTC.",
                    ErrorArgs.Of($"{ContributionRules.DailyLimit}", $"{resetsAt:yyyy-MM-dd HH:mm}"));

            var prepared = new List<PreparedImage>();
            foreach (var image in images)
                prepared.Add(await UploadedImages.PrepareAsync(image, ContributionRules.PhotoWidth, ContributionRules.PhotoQuality));

            var formId = form ? Guid.NewGuid() : (Guid?)null;
            var kind = form ? ContributionUploadKind.Classification : ContributionUploadKind.Detection;
            var temp = ContributionStorage.NewTempDir();
            var rows = prepared.Select(p =>
            {
                var id = Guid.NewGuid();
                return new ContributionUpload
                {
                    Id = id, PhaseId = phase.Id, UserId = userId, Kind = kind, FormId = formId, FileName = id.ToString("N") + p.Extension, CreatedAt = now,
                };
            }).ToList();

            try
            {
                Directory.CreateDirectory(temp);
                for (var i = 0; i < rows.Count; i++)
                    await File.WriteAllBytesAsync(Path.Combine(temp, rows[i].FileName), prepared[i].Bytes);

                _db.ContributionUploads.AddRange(rows);
                var subject = await SubjectNameAsync(phase);
                if (form)
                {
                    _db.ContributionForms.Add(new ContributionForm { Id = formId!.Value, PhaseId = phase.Id, UserId = userId, PhotoCount = rows.Count, CreatedAt = now });
                    _activity.Record(userId, "contribution.formCompleted", new ActivityTargets(), new { phaseId = phase.Id, subject, count = rows.Count });
                }
                else
                    _activity.Record(userId, "contribution.photosUploaded", new ActivityTargets(), new { phaseId = phase.Id, subject, count = rows.Count });
                await SaveWhileRunningAsync(phase.Id);

                try
                {
                    MoveIntoPlace(temp, phase.Id, formId, rows);
                }
                catch
                {
                    // The files could not be placed: take the rows back so counts never include missing photos.
                    _db.ContributionUploads.RemoveRange(rows);
                    if (formId != null) _db.ContributionForms.RemoveRange(_db.ContributionForms.Where(f => f.Id == formId));
                    await _db.SaveChangesAsync();
                    throw;
                }
            }
            finally
            {
                // Only this upload's own folder: the shared .tmp root stays (another upload may be using it).
                if (Directory.Exists(temp)) Directory.Delete(temp, recursive: true);
            }

            return await MineAsync(phase.Id, userId);
        }

        private static void MoveIntoPlace(string temp, Guid phaseId, Guid? formId, List<ContributionUpload> rows)
        {
            if (formId != null)
            {
                Directory.CreateDirectory(ContributionStorage.ClassificationDir(phaseId));
                Directory.Move(temp, ContributionStorage.FormDir(phaseId, formId.Value));
                return;
            }
            var pool = ContributionStorage.DetectionDir(phaseId);
            Directory.CreateDirectory(pool);
            foreach (var row in rows)
                File.Move(Path.Combine(temp, row.FileName), Path.Combine(pool, row.FileName));
        }

        private async Task<string?> SubjectNameAsync(ContributionPhase phase)
        {
            var source = await _db.ContributionPhases.AsNoTracking().Include(p => p.Candidates).FirstOrDefaultAsync(p => p.Id == phase.SourcePhaseId);
            return source?.Candidates.FirstOrDefault(c => c.Id == source.WinnerCandidateId)?.Name;
        }
    }
}
