namespace Coffer.Domain.Entities
{
    public enum NewsStatus { Draft, Published }

    /// <summary>A news post written in Coffer.Manager; the app shows only published ones.</summary>
    public class NewsPost
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = "";
        /// <summary>File name in the news image store, or null.</summary>
        public string? HeroImage { get; set; }
        /// <summary>Markdown; content images are referenced as coffer-image:{fileName}.</summary>
        public string Content { get; set; } = "";
        public NewsStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        /// <summary>Set on the first publish and kept when published again after an unpublish.</summary>
        public DateTime? PublishedAt { get; set; }
        /// <summary>Set when title, banner or content change while published.</summary>
        public DateTime? EditedAt { get; set; }
        public Guid CreatedBy { get; set; }
        public Guid UpdatedBy { get; set; }
    }
}
