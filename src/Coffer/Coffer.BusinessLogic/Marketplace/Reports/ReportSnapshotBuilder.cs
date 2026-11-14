using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Reports
{
    /// <summary>
    /// Freezes the reported content and its context as JSON when a report is made, so later edits or removals
    /// don't change what the admin reviews. Transcripts here are raw (admin evidence only).
    /// </summary>
    public class ReportSnapshotBuilder
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly CofferDbContext _db;
        private readonly IConversationService _conversations;

        public ReportSnapshotBuilder(CofferDbContext db, IConversationService conversations)
        {
            _db = db;
            _conversations = conversations;
        }

        public async Task<string> ListingAsync(Guid listingId)
        {
            var l = await _db.Listings.AsNoTracking()
                .Include(x => x.Owner).Include(x => x.City).Include(x => x.CollectionType).Include(x => x.Lines).Include(x => x.Images)
                .FirstAsync(x => x.Id == listingId);
            return Serialize(new { listing = ListingView(l) });
        }

        public async Task<string> MessageAsync(Message message, Conversation conversation)
        {
            var names = await NamesAsync(conversation.Participants.Select(p => p.UserId));
            var listing = conversation.SubjectType == ListingConversationPolicy.Type
                ? await _db.Listings.AsNoTracking().Where(l => l.Id == conversation.SubjectId).Select(l => new { l.Id, l.Title, l.Status }).FirstOrDefaultAsync()
                : null;
            var transcript = await _conversations.GetTranscriptAsync(conversation.Id, raw: true);
            return Serialize(new
            {
                message = new
                {
                    message.Id, message.Kind, message.Body, message.Payload, message.CreatedAt,
                    sender = Name(names, message.SenderId),
                },
                listing,
                transcript = transcript.Select(m => TranscriptLine(m, names)),
            });
        }

        public async Task<string> ReviewAsync(Review review, Deal deal)
        {
            var names = await NamesAsync(new[] { deal.SellerId, deal.BuyerId });
            var listing = await _db.Listings.AsNoTracking().Where(l => l.Id == deal.ListingId).Select(l => new { l.Id, l.Title, l.Kind }).FirstAsync();
            var reviews = await _db.Reviews.AsNoTracking().Where(r => r.DealId == deal.Id).ToListAsync();
            var transcript = await _conversations.GetTranscriptAsync(deal.ConversationId, raw: true);
            return Serialize(new
            {
                review = new { review.Id, review.ReviewerRole, reviewer = Name(names, review.ReviewerId), review.Stars, review.ReasonTag, review.Comment, review.Reply, review.CreatedAt, review.PublishedAt },
                deal = new
                {
                    deal.Id, deal.Status, deal.Method, deal.AgreedPriceCents, deal.MeetupAt, deal.MeetupPlace,
                    deal.Carrier, deal.TrackingNumber, deal.ShippedAt, deal.ReceivedAt, deal.CompletedAt, deal.CompletionReason,
                    deal.DisputeReason, deal.DisputedAt, deal.CreatedAt,
                    seller = Name(names, deal.SellerId), buyer = Name(names, deal.BuyerId),
                },
                listing,
                reviews = reviews.Select(r => new { r.Id, r.ReviewerRole, reviewer = Name(names, r.ReviewerId), r.Stars, r.ReasonTag, r.Comment, r.Reply }),
                transcript = transcript.Select(m => TranscriptLine(m, names)),
            });
        }

        public async Task<string> ItemAsync(Guid itemId)
        {
            var item = await _db.Items.AsNoTracking()
                .Include(i => i.ItemAttributes).ThenInclude(a => a.Attribute)
                .Include(i => i.ItemTags)
                .FirstAsync(i => i.Id == itemId);
            var collection = await _db.Collections.AsNoTracking().Where(c => c.Id == item.CollectionId)
                .Select(c => new { c.Id, c.Name, c.UserId, c.CollectionTypeId }).FirstAsync();
            var type = await _db.CollectionTypes.AsNoTracking().Where(t => t.Id == collection.CollectionTypeId).Select(t => t.Name).FirstOrDefaultAsync();
            var owner = await _db.Users.AsNoTracking().Where(u => u.Id == collection.UserId).Select(u => new { u.Id, u.Name }).FirstOrDefaultAsync();
            return Serialize(new { item = ItemView(item, collection.Name, type, owner?.Name), owner });
        }

        public async Task<string> CommentAsync(Coffer.Domain.Community.ItemComment comment)
        {
            var thread = await _db.ItemComments.AsNoTracking().Where(c => c.RootId == comment.RootId).OrderBy(c => c.CreatedAt).ToListAsync();
            var names = await NamesAsync(thread.Select(c => c.AuthorId));
            var item = await _db.Items.AsNoTracking().Where(i => i.Id == comment.ItemId)
                .Select(i => new { i.Id, i.Description, i.Image, collection = i.Collection.Name, ownerId = i.Collection.UserId }).FirstAsync();
            var parent = comment.ParentId == null ? null : thread.FirstOrDefault(c => c.Id == comment.ParentId);
            return Serialize(new
            {
                comment = new { comment.Id, comment.Body, author = Name(names, comment.AuthorId), comment.AuthorId, comment.CreatedAt, comment.EditedAt },
                parent = parent == null ? null : new { parent.Id, parent.Body, author = Name(names, parent.AuthorId) },
                item = new { item.Id, item.Description, item.Image, item.collection, owner = item.ownerId },
                thread = thread.Select(c => new
                {
                    c.Id, c.ParentId, author = Name(names, c.AuthorId), c.Body, c.CreatedAt, c.EditedAt,
                    deleted = c.DeletedAt != null, c.IsRemoved,
                }),
            });
        }

        public static object ItemView(Coffer.Domain.Entities.ItemProvided i, string collection, string? type, string? owner) => new
        {
            i.Id, i.Description, i.Quantity, i.Image, i.AcquiredAt, collection, type, owner,
            attributes = i.ItemAttributes.Select(a => new
            {
                name = a.Attribute?.Name,
                value = a.ValueString ?? a.ValueNumber?.ToString() ?? a.ValueDate?.ToString() ?? a.ValueBoolean?.ToString(),
            }),
            tags = i.ItemTags.Select(t => t.Tag),
        };

        public static object ListingView(Listing l) => new
        {
            l.Id, l.Kind, l.Status, l.Title, l.Description, l.PriceCents, l.ExchangeFor, l.Condition,
            city = l.City?.Name, itemType = l.CollectionType?.Name, l.AllowsLocalPickup, l.AllowsShipping, l.PrivateSellerDeclared,
            lines = l.Lines.OrderBy(x => x.Position).Select(x => new { x.Name, x.Quantity }),
            images = l.Images.OrderBy(x => x.Position).Select(x => x.FileName),
            owner = l.Owner == null ? null : new { l.Owner.Id, l.Owner.Name },
            l.CreatedAt, l.UpdatedAt,
        };

        private static object TranscriptLine(MessageDto m, Dictionary<Guid, string> names) => new
        {
            m.Id, sender = Name(names, m.SenderId), m.SenderId, m.Kind, m.Body, m.AmountCents, m.At, m.Place, m.Status, m.IsRemoved, m.CreatedAt,
        };

        private async Task<Dictionary<Guid, string>> NamesAsync(IEnumerable<Guid> ids)
        {
            var list = ids.Distinct().ToList();
            return await _db.Users.AsNoTracking().Where(u => list.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);
        }

        private static string Name(Dictionary<Guid, string> names, Guid? id) =>
            id == null ? "system" : names.TryGetValue(id.Value, out var n) ? n : "deleted user";

        private static string Serialize(object o) => JsonSerializer.Serialize(o, Json);
    }
}
