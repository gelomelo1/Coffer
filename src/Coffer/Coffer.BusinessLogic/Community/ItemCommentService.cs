using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Community;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Community
{
    public sealed record MentionDto(Guid UserId, string Name);

    /// <summary>
    /// A comment as the viewer sees it. Deleted (by the author) and removed (by an admin) comments keep their place
    /// in the thread with an empty body while they still have visible replies.
    /// </summary>
    public sealed record CommentDto(
        Guid Id,
        Guid ItemId,
        Guid? ParentId,
        UserSummaryDto? Author,
        bool IsOwner,
        string Body,
        List<MentionDto> Mentions,
        DateTime CreatedAt,
        DateTime? EditedAt,
        bool IsDeleted,
        bool IsRemoved,
        bool CanEdit,
        List<CommentDto> Replies);

    public sealed record CommentPageDto(List<CommentDto> Threads, int Page, int PageSize, int TotalThreads, int TotalComments);

    public sealed record CreateCommentInput(string Body, Guid? ParentId = null, List<Guid>? MentionUserIds = null);

    public sealed record UpdateCommentInput(string Body, List<Guid>? MentionUserIds = null);

    public interface IItemCommentService
    {
        Task<CommentPageDto> ListAsync(Guid viewerId, Guid itemId, int page = 1, int pageSize = 20);
        Task<CommentDto> CreateAsync(Guid userId, Guid itemId, CreateCommentInput input);
        Task<CommentDto> UpdateAsync(Guid userId, Guid itemId, Guid commentId, UpdateCommentInput input);
        Task DeleteAsync(Guid userId, Guid itemId, Guid commentId);
        Task<Dictionary<Guid, int>> CountAsync(IEnumerable<Guid> itemIds);
        Task<List<MentionDto>> MentionableAsync(Guid viewerId, string? query, int limit = 8);
    }

    /// <summary>
    /// Comments on collection items (one implementation for the feed card sheet and the item details page).
    /// Plain text only; mentions are stored by user id and only kept when the body really contains "@Name".
    /// </summary>
    public sealed class ItemCommentService : IItemCommentService
    {
        public const int MaxBody = 2000;
        public const int MaxMentions = 20;

        private readonly CofferDbContext _db;
        private readonly IClock _clock;

        public ItemCommentService(CofferDbContext db, IClock clock)
        {
            _db = db;
            _clock = clock;
        }

        public async Task<CommentPageDto> ListAsync(Guid viewerId, Guid itemId, int page = 1, int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 50);
            var ownerId = await OwnerOfAsync(itemId);

            var all = _db.ItemComments.AsNoTracking().Where(c => c.ItemId == itemId);
            var totalComments = await all.CountAsync(c => c.DeletedAt == null && !c.IsRemoved);

            // A thread is listed while it has anything visible left (the root itself or any reply). Comments of a
            // deleted account always keep their place as a "Deleted user / Comment deleted" placeholder.
            var visibleRoots = all.Where(c => c.ParentId == null
                && (c.DeletedAt == null && !c.IsRemoved
                    || _db.ItemComments.Any(r => r.RootId == c.Id && r.Id != c.Id && r.DeletedAt == null && !r.IsRemoved)
                    || _db.Users.Any(u => u.Id == c.AuthorId && u.DeletedAt != null)));
            var totalThreads = await visibleRoots.CountAsync();
            var rootIds = await visibleRoots.OrderByDescending(c => c.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).Select(c => c.Id).ToListAsync();

            var comments = await all.Where(c => rootIds.Contains(c.RootId)).Include(c => c.Mentions).ThenInclude(m => m.User)
                .OrderBy(c => c.CreatedAt).ToListAsync();
            var authors = await UsersAsync(comments.Select(c => c.AuthorId));
            var authorIds = comments.Select(c => c.AuthorId).Distinct().ToList();
            var deletedAuthors = (await _db.Users.AsNoTracking().Where(u => authorIds.Contains(u.Id) && u.DeletedAt != null).Select(u => u.Id).ToListAsync()).ToHashSet();

            var byParent = comments.Where(c => c.ParentId != null).GroupBy(c => c.ParentId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            var threads = rootIds
                .Select(id => comments.First(c => c.Id == id))
                .Select(root => Build(root, byParent, authors, deletedAuthors, ownerId, viewerId))
                .Where(t => t != null)
                .Select(t => t!)
                .ToList();
            return new CommentPageDto(threads, page, pageSize, totalThreads, totalComments);
        }

        public async Task<CommentDto> CreateAsync(Guid userId, Guid itemId, CreateCommentInput input)
        {
            var ownerId = await OwnerOfAsync(itemId);
            var body = CleanBody(input?.Body);
            var comment = new ItemComment
            {
                Id = Guid.NewGuid(),
                ItemId = itemId,
                AuthorId = userId,
                Body = body,
                CreatedAt = _clock.UtcNow,
            };

            if (input!.ParentId is Guid parentId)
            {
                var parent = await _db.ItemComments.AsNoTracking().FirstOrDefaultAsync(c => c.Id == parentId)
                    ?? throw MarketplaceException.NotFound("theCommentYouReplyToDoesnT", "The comment you reply to doesn't exist.");
                if (parent.ItemId != itemId) throw MarketplaceException.Validation("aReplyMustBelongToTheSame", "A reply must belong to the same item as its parent.");
                if (parent.DeletedAt != null || parent.IsRemoved) throw MarketplaceException.Conflict("youCanTReplyToADeleted", "You can't reply to a deleted comment.");
                comment.ParentId = parent.Id;
                comment.RootId = parent.RootId;
            }
            else
            {
                comment.RootId = comment.Id;
            }

            comment.Mentions = await ResolveMentionsAsync(body, input.MentionUserIds, comment.Id);
            _db.ItemComments.Add(comment);
            await _db.SaveChangesAsync();
            return await GetAsync(userId, comment.Id, ownerId);
        }

        public async Task<CommentDto> UpdateAsync(Guid userId, Guid itemId, Guid commentId, UpdateCommentInput input)
        {
            var ownerId = await OwnerOfAsync(itemId);
            var comment = await OwnCommentAsync(userId, itemId, commentId);
            if (comment.IsRemoved) throw MarketplaceException.Conflict("aRemovedCommentCanTBeEdited", "A removed comment can't be edited.");

            var body = CleanBody(input?.Body);
            comment.Body = body;
            comment.EditedAt = _clock.UtcNow;
            _db.ItemCommentMentions.RemoveRange(comment.Mentions);
            comment.Mentions = await ResolveMentionsAsync(body, input!.MentionUserIds, comment.Id);
            await _db.SaveChangesAsync();
            return await GetAsync(userId, comment.Id, ownerId);
        }

        public async Task DeleteAsync(Guid userId, Guid itemId, Guid commentId)
        {
            var comment = await OwnCommentAsync(userId, itemId, commentId);
            var hasReplies = await _db.ItemComments.AnyAsync(c => c.ParentId == comment.Id);
            var reported = await _db.Reports.AnyAsync(r => r.TargetType == ReportTargetType.Comment && r.TargetId == comment.Id);

            if (!hasReplies && !reported)
            {
                _db.ItemComments.Remove(comment);
            }
            else
            {
                // Tombstone: replies keep their parent, reports keep their target (their snapshot holds the evidence).
                comment.Body = "";
                comment.DeletedAt = _clock.UtcNow;
                _db.ItemCommentMentions.RemoveRange(comment.Mentions);
            }
            await _db.SaveChangesAsync();
        }

        public async Task<Dictionary<Guid, int>> CountAsync(IEnumerable<Guid> itemIds)
        {
            var ids = itemIds.Distinct().ToList();
            return await _db.ItemComments.AsNoTracking()
                .Where(c => ids.Contains(c.ItemId) && c.DeletedAt == null && !c.IsRemoved)
                .GroupBy(c => c.ItemId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
        }

        public async Task<List<MentionDto>> MentionableAsync(Guid viewerId, string? query, int limit = 8)
        {
            var text = (query ?? "").Trim().TrimStart('@').ToLowerInvariant();
            limit = Math.Clamp(limit, 1, 20);
            var q = _db.Users.AsNoTracking().Where(u => u.Id != viewerId && u.DeletedAt == null);
            if (text.Length > 0) q = q.Where(u => u.Name.ToLower().StartsWith(text));
            return await q.OrderBy(u => u.Name).Take(limit).Select(u => new MentionDto(u.Id, u.Name)).ToListAsync();
        }

        // ------------------------------------------------------------------ helpers

        private async Task<Guid> OwnerOfAsync(Guid itemId)
        {
            var item = await _db.Items.AsNoTracking().Where(i => i.Id == itemId)
                .Select(i => new { i.Collection.UserId, i.DeletedAt }).FirstOrDefaultAsync()
                ?? throw MarketplaceException.NotFound("itemNotFound", "Item not found.");
            // Other users' comments stay in the database (linked, for accountability), but a deleted item is not shown.
            if (item.DeletedAt != null) throw MarketplaceException.NotFound("itemDeleted", "This item was deleted.");
            return item.UserId;
        }

        private async Task<ItemComment> OwnCommentAsync(Guid userId, Guid itemId, Guid commentId)
        {
            var comment = await _db.ItemComments.Include(c => c.Mentions).FirstOrDefaultAsync(c => c.Id == commentId && c.ItemId == itemId);
            if (comment == null || comment.DeletedAt != null) throw MarketplaceException.NotFound("commentNotFound", "Comment not found.");
            if (comment.AuthorId != userId) throw MarketplaceException.Forbidden("youCanOnlyChangeYourOwnComments", "You can only change your own comments.");
            return comment;
        }

        private async Task<CommentDto> GetAsync(Guid viewerId, Guid commentId, Guid ownerId)
        {
            var comment = await _db.ItemComments.AsNoTracking().Include(c => c.Mentions).ThenInclude(m => m.User).FirstAsync(c => c.Id == commentId);
            var authors = await UsersAsync(new[] { comment.AuthorId });
            return ToDto(comment, authors, ownerId, viewerId, new List<CommentDto>());
        }

        /// <summary>Plain text: trimmed, \r\n normalised, no control characters except line breaks and tabs.</summary>
        public static string CleanBody(string? body)
        {
            var text = (body ?? "").Replace("\r\n", "\n").Replace('\r', '\n').Trim();
            if (text.Length == 0) throw MarketplaceException.Validation("writeSomethingFirst", "Write something first.");
            if (text.Length > MaxBody) throw MarketplaceException.Validation("aCommentCanBeAtMostCharacters", $"A comment can be at most {MaxBody} characters.", ErrorArgs.Of($"{MaxBody}"));
            if (text.Any(ch => char.IsControl(ch) && ch != '\n' && ch != '\t'))
                throw MarketplaceException.Validation("theCommentContainsCharactersThatAreNot", "The comment contains characters that are not allowed.");
            return text;
        }

        /// <summary>Keeps a mention only when the user exists and "@Name" really appears in the body (no spoofed mentions).</summary>
        private async Task<List<ItemCommentMention>> ResolveMentionsAsync(string body, List<Guid>? userIds, Guid commentId)
        {
            var ids = (userIds ?? new List<Guid>()).Distinct().Take(MaxMentions).ToList();
            if (ids.Count == 0) return new List<ItemCommentMention>();
            var users = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).Select(u => new { u.Id, u.Name }).ToListAsync();
            return users.Where(u => ContainsMention(body, u.Name))
                .Select(u => new ItemCommentMention { CommentId = commentId, UserId = u.Id })
                .ToList();
        }

        public static bool ContainsMention(string body, string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            var token = "@" + name;
            var index = 0;
            while ((index = body.IndexOf(token, index, StringComparison.OrdinalIgnoreCase)) >= 0)
            {
                var end = index + token.Length;
                var before = index == 0 || !IsNameChar(body[index - 1]);
                var after = end >= body.Length || !IsNameChar(body[end]);
                if (before && after) return true;
                index = end;
            }
            return false;
        }

        private static bool IsNameChar(char c) => char.IsLetterOrDigit(c) || c == '_' || c == '.' || c == '-';

        private CommentDto? Build(ItemComment c, Dictionary<Guid, List<ItemComment>> byParent, Dictionary<Guid, UserSummaryDto> authors,
            HashSet<Guid> deletedAuthors, Guid ownerId, Guid viewerId)
        {
            var replies = (byParent.GetValueOrDefault(c.Id) ?? new List<ItemComment>())
                .Select(r => Build(r, byParent, authors, deletedAuthors, ownerId, viewerId))
                .Where(r => r != null)
                .Select(r => r!)
                .ToList();
            var hidden = c.DeletedAt != null || c.IsRemoved;
            if (hidden && replies.Count == 0 && !deletedAuthors.Contains(c.AuthorId)) return null;
            return ToDto(c, authors, ownerId, viewerId, replies);
        }

        private static CommentDto ToDto(ItemComment c, Dictionary<Guid, UserSummaryDto> authors, Guid ownerId, Guid viewerId, List<CommentDto> replies)
        {
            var deleted = c.DeletedAt != null;
            var hidden = deleted || c.IsRemoved;
            return new CommentDto(
                c.Id,
                c.ItemId,
                c.ParentId,
                deleted ? null : authors.GetValueOrDefault(c.AuthorId) ?? new UserSummaryDto(c.AuthorId, "deleted user", null),
                !deleted && c.AuthorId == ownerId,
                hidden ? "" : c.Body,
                hidden ? new List<MentionDto>() : c.Mentions.Where(m => m.User != null).Select(m => new MentionDto(m.UserId, m.User.Name)).ToList(),
                c.CreatedAt,
                c.EditedAt,
                deleted,
                c.IsRemoved,
                !hidden && c.AuthorId == viewerId,
                replies);
        }

        private async Task<Dictionary<Guid, UserSummaryDto>> UsersAsync(IEnumerable<Guid> ids)
        {
            var list = ids.Distinct().ToList();
            return await _db.Users.AsNoTracking().Where(u => list.Contains(u.Id)).ToDictionaryAsync(u => u.Id, UserSummaryDto.From);
        }
    }
}
