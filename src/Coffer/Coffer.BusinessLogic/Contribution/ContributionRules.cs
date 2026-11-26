namespace Coffer.BusinessLogic.Contribution
{
    /// <summary>The fixed numbers of Shape What's Next (docs/superpowers/specs/2026-11-26-contribution-design.md).</summary>
    public static class ContributionRules
    {
        public const int CandidateCount = 3;
        public const int NameMax = 60;
        public const int DescriptionMax = 300;
        public const int TextMin = 10;
        public const int TextMax = 1000;
        public const int PerUpload = 20;
        public const int FormMin = 5;
        public const int FormMax = 10;
        /// <summary>Contribution photos per user per UTC day (detection and classification together).</summary>
        public const int DailyLimit = 300;
        /// <summary>The app shows how many photos are left today below this many.</summary>
        public const int DailyLeftShownBelow = 40;
        /// <summary>Contribution photos are stored at most this wide (the app's resize width).</summary>
        public const int PhotoWidth = Coffer.BusinessLogic.Images.UploadWidths.Small;
        /// <summary>JPEG quality when the server has to re-encode a contribution photo (keeps training data sharp).</summary>
        public const int PhotoQuality = 90;
        /// <summary>An end date must be at least this far ahead when a phase opens or is extended.</summary>
        public static readonly TimeSpan MinLead = TimeSpan.FromMinutes(5);

        /// <summary>
        /// The single candidate with the most votes, or null when nobody voted or the top is shared (the admin picks).
        /// </summary>
        public static Guid? DecideWinner(IReadOnlyDictionary<Guid, int> votesByCandidate)
        {
            var ranked = votesByCandidate.Where(kv => kv.Value > 0).OrderByDescending(kv => kv.Value).ToList();
            if (ranked.Count == 0) return null;
            if (ranked.Count > 1 && ranked[1].Value == ranked[0].Value) return null;
            return ranked[0].Key;
        }
    }

    /// <summary>Why there is no contribution period right now (the admin picks one; texts live in the app).</summary>
    public static class ContributionReasons
    {
        public const string JustFinished = "justFinished";
        public const string CommunityTooSmall = "communityTooSmall";
        public const string ContributionFinished = "contributionFinished";
        public const string ModelsInProgress = "modelsInProgress";

        public static readonly IReadOnlyList<string> All = new[] { JustFinished, CommunityTooSmall, ContributionFinished, ModelsInProgress };

        public static bool IsValid(string? reason) => reason != null && All.Contains(reason);
    }

    /// <summary>Where contribution files live: AppPaths.Contributions/{phaseId}/… and …/examples/{form}/.</summary>
    public static class ContributionStorage
    {
        public static string Root => Coffer.BusinessLogic.AppConfig.AppPaths.Contributions;
        public static string PhaseDir(Guid phaseId) => Path.Combine(Root, phaseId.ToString());
        public static string DetectionDir(Guid phaseId) => Path.Combine(PhaseDir(phaseId), "detection");
        public static string ClassificationDir(Guid phaseId) => Path.Combine(PhaseDir(phaseId), "classification");
        public static string FormDir(Guid phaseId, Guid formId) => Path.Combine(ClassificationDir(phaseId), formId.ToString());
        /// <summary>The admin fills these by hand: one general gallery per form.</summary>
        public static string ExamplesDir(string form) => Path.Combine(Root, "examples", form);
        /// <summary>Uploads are written here first and moved into place only once their rows are saved.</summary>
        public static string NewTempDir() => Path.Combine(Root, ".tmp", Guid.NewGuid().ToString("N"));
    }
}
