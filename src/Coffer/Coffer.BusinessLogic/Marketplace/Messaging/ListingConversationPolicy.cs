using Coffer.DataAccess.Extensions;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Terms;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Messaging
{
    /// <summary>
    /// Plug-in point of the generic messaging core: decides who may start a conversation about a subject and
    /// which message kinds the subject supports. New features (e.g. item comments) add their own policy.
    /// </summary>
    public interface IConversationSubjectPolicy
    {
        string SubjectType { get; }
        /// <summary>The user who owns the subject (answers inquiries). NotFound when the subject does not exist.</summary>
        Task<Guid> ResolveOwnerAsync(Guid subjectId);
        Task EnsureCanStartAsync(Guid userId, Guid subjectId);
        Task EnsureKindAllowedAsync(Guid subjectId, MessageKind kind);
        Task<SubjectSummaryDto> DescribeAsync(Guid subjectId);
    }

    public class ListingConversationPolicy : IConversationSubjectPolicy
    {
        public const string Type = "listing";
        private readonly CofferDbContext _db;

        public ListingConversationPolicy(CofferDbContext db)
        {
            _db = db;
        }

        public string SubjectType => Type;

        private async Task<Listing> LoadAsync(Guid id) =>
            await _db.Listings.AsNoTracking().Include(l => l.Images).FirstOrDefaultAsync(l => l.Id == id)
            ?? throw MarketplaceException.NotFound("listingNotFound", "Listing not found.");

        public async Task<Guid> ResolveOwnerAsync(Guid subjectId) => (await LoadAsync(subjectId)).OwnerId;

        public async Task EnsureCanStartAsync(Guid userId, Guid subjectId)
        {
            await MarketTerms.EnsureAcceptedAsync(_db, userId);
            if (!await _db.Listings.Where(l => l.Id == subjectId).WherePublished(_db).AnyAsync())
                throw MarketplaceException.NotFound("listingNotFound", "Listing not found.");
            var listing = await LoadAsync(subjectId);
            if (listing.OwnerId == userId) throw MarketplaceException.Forbidden("youCanTMessageYourselfAboutYour", "You can't message yourself about your own listing.");
            if (listing.Status is ListingStatus.Archived or ListingStatus.Sold or ListingStatus.Removed)
                throw MarketplaceException.Conflict("thisListingIsNoLongerAvailable", "This listing is no longer available.");
        }

        public async Task EnsureKindAllowedAsync(Guid subjectId, MessageKind kind)
        {
            if (kind == MessageKind.Text) return;
            var listing = await LoadAsync(subjectId);
            switch (kind)
            {
                case MessageKind.PriceOffer:
                    if (listing.Kind == ListingKind.Exchange)
                        throw MarketplaceException.Validation("exchangeListingsDonTTakePriceOffers", "Exchange listings don't take price offers — describe your offer in a message.");
                    if (listing.Status != ListingStatus.Active)
                        throw MarketplaceException.Conflict("priceOffersAreOnlyPossibleWhileThe", "Price offers are only possible while the listing is active.");
                    break;
                case MessageKind.MeetupProposal:
                    if (listing.Status is ListingStatus.Archived or ListingStatus.Sold or ListingStatus.Removed)
                        throw MarketplaceException.Conflict("thisListingIsNoLongerAvailable", "This listing is no longer available.");
                    break;
                default:
                    throw MarketplaceException.Validation("unsupportedMessageKind", "Unsupported message kind.");
            }
        }

        public async Task<SubjectSummaryDto> DescribeAsync(Guid subjectId)
        {
            var l = await LoadAsync(subjectId);
            if (l.DeletedAt != null)
                return new SubjectSummaryDto(l.Id, Type, "", null, EnumText.ToSnake(l.Status), EnumText.ToSnake(l.Kind), l.PriceCents, true);
            return new SubjectSummaryDto(l.Id, Type, l.Title, l.Images.OrderBy(i => i.Position).Select(i => i.FileName).FirstOrDefault(),
                EnumText.ToSnake(l.Status), EnumText.ToSnake(l.Kind), l.PriceCents);
        }
    }
}
