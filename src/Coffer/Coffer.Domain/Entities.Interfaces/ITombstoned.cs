namespace Coffer.Domain.Entities.Interfaces
{
    /// <summary>
    /// A row that is never hard-deleted while other users' data may point at it. Deleting wipes its content and sets
    /// <see cref="DeletedAt"/>; lists, searches and lookups skip it, while comments, chats, deals, reviews and reports
    /// that reference it stay linked and show a "deleted" placeholder.
    /// </summary>
    public interface ITombstoned
    {
        DateTime? DeletedAt { get; set; }
    }
}
