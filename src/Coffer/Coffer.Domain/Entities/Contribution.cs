namespace Coffer.Domain.Entities
{
    public enum ContributionPhaseKind { Vote, Photo }

    public enum ContributionPhaseState { Draft, Open, Closed, Interrupted }

    public enum ContributionUploadKind { Detection, Classification }

    /// <summary>The Shape What's Next switch: a single row (id 1).</summary>
    public class ContributionSettings
    {
        public int Id { get; set; } = 1;
        public bool Enabled { get; set; }
        /// <summary>Why there is no contribution period (shown while disabled); the last one is kept as the default.</summary>
        public string? Reason { get; set; }
        /// <summary>The phase the switch points at; an open phase stays open (paused) while the switch is off.</summary>
        public Guid? ActivePhaseId { get; set; }
        public DateTime UpdatedAt { get; set; }
        public Guid? UpdatedBy { get; set; }
    }

    /// <summary>A voting round (three candidate item types) or a photo round for a voting round's winner.</summary>
    public class ContributionPhase
    {
        public Guid Id { get; set; }
        public ContributionPhaseKind Kind { get; set; }
        public ContributionPhaseState State { get; set; }
        public DateTime? OpenedAt { get; set; }
        public DateTime? EndsAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        /// <summary>Photo phase: the closed voting phase whose winner it collects photos for.</summary>
        public Guid? SourcePhaseId { get; set; }
        /// <summary>Voting phase: set at close (clear leader) or picked by the admin (tie / no votes); never changes afterwards.</summary>
        public Guid? WinnerCandidateId { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid CreatedBy { get; set; }
        public DateTime UpdatedAt { get; set; }
        public Guid UpdatedBy { get; set; }
        public List<ContributionCandidate> Candidates { get; set; } = new();
    }

    public class ContributionCandidate
    {
        public Guid Id { get; set; }
        public Guid PhaseId { get; set; }
        /// <summary>1–3, the order shown.</summary>
        public int Position { get; set; }
        public string Name { get; set; } = "";
        public Dictionary<string, string> NameTranslations { get; set; } = new();
        public string Description { get; set; } = "";
        public Dictionary<string, string> DescriptionTranslations { get; set; } = new();
    }

    /// <summary>One vote per user per phase, with the user's free text (attributes they'd like, and why).</summary>
    public class ContributionVote
    {
        public Guid PhaseId { get; set; }
        public Guid UserId { get; set; }
        public Guid CandidateId { get; set; }
        public string Text { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    /// <summary>A completed classification form: 5–10 photos of one physical item (one class folder).</summary>
    public class ContributionForm
    {
        public Guid Id { get; set; }
        public Guid PhaseId { get; set; }
        public Guid UserId { get; set; }
        public int PhotoCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>One stored contribution photo (detection pool or part of a classification form).</summary>
    public class ContributionUpload
    {
        public Guid Id { get; set; }
        public Guid PhaseId { get; set; }
        public Guid UserId { get; set; }
        public ContributionUploadKind Kind { get; set; }
        public Guid? FormId { get; set; }
        public string FileName { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }
}
