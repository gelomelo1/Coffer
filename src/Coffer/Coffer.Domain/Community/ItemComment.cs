using Coffer.Domain.Entities;

namespace Coffer.Domain.Community
{
    /// <summary>
    /// A comment on a collection item. Replies point at their parent; every comment of a thread shares the
    /// thread's top-level comment as <see cref="RootId"/>, so a page of threads loads with one query.
    /// Deleting keeps a tombstone (body cleared) so replies and reports stay valid.
    /// </summary>
    public class ItemComment
    {
        public Guid Id { get; set; }
        public Guid ItemId { get; set; }
        public ItemProvided Item { get; set; } = null!;
        public Guid AuthorId { get; set; }
        public User Author { get; set; } = null!;
        /// <summary>Direct parent (null for a top-level comment).</summary>
        public Guid? ParentId { get; set; }
        /// <summary>Top-level comment of the thread (equals <see cref="Id"/> for a top-level comment).</summary>
        public Guid RootId { get; set; }
        public string Body { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime? EditedAt { get; set; }
        /// <summary>Deleted by its author (tombstone).</summary>
        public DateTime? DeletedAt { get; set; }
        /// <summary>Removed by an admin for breaking a content rule.</summary>
        public bool IsRemoved { get; set; }
        public List<ItemCommentMention> Mentions { get; set; } = new();
    }

    /// <summary>A user mentioned in a comment. Stored by id, so renames and deletions are handled by the database.</summary>
    public class ItemCommentMention
    {
        public Guid CommentId { get; set; }
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;
    }
}
