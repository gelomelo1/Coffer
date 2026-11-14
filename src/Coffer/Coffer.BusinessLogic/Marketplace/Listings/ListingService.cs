using Coffer.BusinessLogic.Marketplace.Cities;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Terms;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Coffer.Domain.Constants;
using Coffer.Domain.Marketplace;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Listings
{
    public interface IListingService
    {
        Task<ListingDetailDto> CreateAsync(Guid userId, ListingInput input, IReadOnlyList<IFormFile> images);
        Task<ListingDetailDto> UpdateAsync(Guid userId, Guid id, ListingInput input, IReadOnlyList<IFormFile> newImages);
        Task<ListingDetailDto> ArchiveAsync(Guid userId, Guid id);
        Task<ListingDetailDto> ReactivateAsync(Guid userId, Guid id);
        Task<ListingDetailDto> GetAsync(Guid viewerId, Guid id);
        Task<List<ListingSummaryDto>> SearchAsync(Guid viewerId, ListingQuery query);
        Task<List<ListingSummaryDto>> GetMineAsync(Guid userId);
    }

    public class ListingService : IListingService
    {
        public const int MaxImages = 6;
        public const int MaxLines = 30;

        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;

        public ListingService(CofferDbContext db, IClock clock, IImageService images, MarketplaceStorage storage)
        {
            _db = db;
            _clock = clock;
            _images = images;
            _storage = storage;
        }

        // ------------------------------------------------------------------ commands

        public async Task<ListingDetailDto> CreateAsync(Guid userId, ListingInput input, IReadOnlyList<IFormFile> images)
        {
            images ??= Array.Empty<IFormFile>();
            await MarketTerms.EnsureAcceptedAsync(_db, userId);
            var listing = new Listing
            {
                OwnerId = userId,
                Kind = input.Kind,
                CollectionTypeId = input.CollectionTypeId,
                Status = ListingStatus.Active,
                CreatedAt = _clock.UtcNow,
            };
            await ApplyInputAsync(listing, input, images.Count);
            foreach (var file in images) ImageUploadGuard.Validate(file);

            var saved = new List<string>();
            try
            {
                await AddImagesAsync(listing, images, saved);
                _db.Listings.Add(listing);
                await _db.SaveChangesAsync();
            }
            catch
            {
                await DeleteFilesAsync(saved);
                throw;
            }
            return await GetAsync(userId, listing.Id);
        }

        public async Task<ListingDetailDto> UpdateAsync(Guid userId, Guid id, ListingInput input, IReadOnlyList<IFormFile> newImages)
        {
            newImages ??= Array.Empty<IFormFile>();
            var listing = await LoadAsync(id);
            if (listing.OwnerId != userId) throw MarketplaceException.Forbidden("Only the owner can edit this listing.");
            if (listing.Status == ListingStatus.Removed) throw MarketplaceException.Conflict("This listing was removed by moderation.");
            if (listing.Status != ListingStatus.Active) throw MarketplaceException.Conflict("Only active listings can be edited.");
            if (await HasOpenDealAsync(id)) throw MarketplaceException.Conflict("This listing has a deal in progress and can't be edited.");
            if (input.Kind != listing.Kind || input.CollectionTypeId != listing.CollectionTypeId)
                throw MarketplaceException.Validation("Listing kind and item type can't be changed after creation.");

            var keepIds = (input.KeepImageIds ?? new List<Guid>()).ToHashSet();
            var removed = listing.Images.Where(i => !keepIds.Contains(i.Id)).ToList();
            var keptCount = listing.Images.Count - removed.Count;

            await ApplyInputAsync(listing, input, keptCount + newImages.Count);
            foreach (var file in newImages) ImageUploadGuard.Validate(file);

            var saved = new List<string>();
            try
            {
                foreach (var image in removed) listing.Images.Remove(image);
                _db.ListingImages.RemoveRange(removed);
                var position = 0;
                foreach (var image in listing.Images.OrderBy(i => i.Position)) image.Position = position++;
                await AddImagesAsync(listing, newImages, saved, position);
                await _db.SaveChangesAsync();
            }
            catch
            {
                await DeleteFilesAsync(saved);
                throw;
            }

            foreach (var image in removed)
                await _images.DeleteOwnedImageAsync(image.FileName, image.Id, _storage.ListingImages);

            return await GetAsync(userId, id);
        }

        public async Task<ListingDetailDto> ArchiveAsync(Guid userId, Guid id)
        {
            var listing = await LoadAsync(id);
            if (listing.OwnerId != userId && !await IsModeratorAsync(userId))
                throw MarketplaceException.Forbidden("Only the owner can archive this listing.");
            if (listing.Status != ListingStatus.Active)
                throw MarketplaceException.Conflict("Only active listings can be archived.");
            if (await HasOpenDealAsync(id))
                throw MarketplaceException.Conflict("Cancel the deal in progress before archiving.");

            listing.Status = ListingStatus.Archived;
            listing.UpdatedAt = _clock.UtcNow;
            await _db.SaveChangesAsync();
            return await GetAsync(userId, id);
        }

        public async Task<ListingDetailDto> ReactivateAsync(Guid userId, Guid id)
        {
            var listing = await LoadAsync(id);
            if (listing.OwnerId != userId) throw MarketplaceException.Forbidden("Only the owner can reactivate this listing.");
            if (listing.Status != ListingStatus.Archived) throw MarketplaceException.Conflict("Only archived listings can be reactivated.");

            listing.Status = ListingStatus.Active;
            listing.UpdatedAt = _clock.UtcNow;
            await _db.SaveChangesAsync();
            return await GetAsync(userId, id);
        }

        // ------------------------------------------------------------------ queries

        public async Task<ListingDetailDto> GetAsync(Guid viewerId, Guid id)
        {
            var l = await _db.Listings.AsNoTracking()
                .Include(x => x.Owner).Include(x => x.City).Include(x => x.CollectionType)
                .Include(x => x.Lines).Include(x => x.Images)
                .FirstOrDefaultAsync(x => x.Id == id) ?? throw MarketplaceException.NotFound("Listing not found.");

            var isMine = l.OwnerId == viewerId;
            if (l.Status is ListingStatus.Archived or ListingStatus.Removed && !isMine && !await IsModeratorAsync(viewerId))
                throw MarketplaceException.NotFound("Listing not found.");

            Guid? myConversation = isMine ? null : await _db.Conversations
                .Where(c => c.SubjectType == "listing" && c.SubjectId == id && c.Participants.Any(p => p.UserId == viewerId))
                .Select(c => (Guid?)c.Id).FirstOrDefaultAsync();

            var openDealId = await _db.Deals
                .Where(d => d.ListingId == id && d.Status != DealStatus.Completed && d.Status != DealStatus.Cancelled && d.Status != DealStatus.Disputed && (d.SellerId == viewerId || d.BuyerId == viewerId))
                .Select(d => (Guid?)d.Id).FirstOrDefaultAsync();

            return new ListingDetailDto(
                l.Id, l.Kind, l.Status, l.Title, l.Description, l.PriceCents, l.Currency, l.ExchangeFor, l.Condition,
                l.CollectionTypeId, l.CollectionType.Name, l.CollectionType.Color, CityDto.From(l.City),
                l.AllowsLocalPickup, l.AllowsShipping, l.PrivateSellerDeclared,
                l.Lines.OrderBy(x => x.Position).Select(x => new ListingLineDto(x.Name, x.Quantity)).ToList(),
                l.Images.OrderBy(x => x.Position).Select(x => new ListingImageDto(x.Id, x.FileName)).ToList(),
                l.CreatedAt, l.UpdatedAt, UserSummaryDto.From(l.Owner), isMine, myConversation, openDealId);
        }

        public async Task<List<ListingSummaryDto>> SearchAsync(Guid viewerId, ListingQuery query)
        {
            var sort = (query.Sort ?? "newest").ToLowerInvariant();
            if (sort is not ("nearest" or "price_asc" or "price_desc" or "newest"))
                throw MarketplaceException.Validation("Unknown sort order.");
            if (query.RadiusKm is <= 0 or > 20000) throw MarketplaceException.Validation("Radius must be between 1 and 20000 km.");
            var page = Math.Max(1, query.Page);
            var pageSize = Math.Clamp(query.PageSize, 1, 50);

            City? origin = null;
            if (query.CityId.HasValue)
                origin = await _db.Cities.FindAsync(query.CityId.Value) ?? throw MarketplaceException.Validation("Unknown city.");
            if (origin == null && (sort == "nearest" || query.RadiusKm.HasValue))
                throw MarketplaceException.Validation("Choose a city to sort or filter by distance.");

            var q = BaseSummaryQuery().Where(l => l.Status == ListingStatus.Active && l.OwnerId != viewerId);
            if (query.Kind.HasValue) q = q.Where(l => l.Kind == query.Kind.Value);
            if (query.CollectionTypeId.HasValue) q = q.Where(l => l.CollectionTypeId == query.CollectionTypeId.Value);
            if (query.Condition.HasValue) q = q.Where(l => l.Condition == query.Condition.Value);
            if (query.Delivery == DeliveryMethod.LocalPickup) q = q.Where(l => l.AllowsLocalPickup);
            if (query.Delivery == DeliveryMethod.Shipping) q = q.Where(l => l.AllowsShipping);
            if (query.MinPriceCents.HasValue) q = q.Where(l => l.PriceCents != null && l.PriceCents >= query.MinPriceCents.Value);
            if (query.MaxPriceCents.HasValue) q = q.Where(l => l.PriceCents != null && l.PriceCents <= query.MaxPriceCents.Value);
            if (origin != null && query.RadiusKm.HasValue)
            {
                var (dLat, dLon) = GeoMath.BoundingBox(origin.Latitude, query.RadiusKm.Value);
                double minLat = origin.Latitude - dLat, maxLat = origin.Latitude + dLat;
                double minLon = origin.Longitude - dLon, maxLon = origin.Longitude + dLon;
                q = q.Where(l => l.City.Latitude >= minLat && l.City.Latitude <= maxLat
                              && l.City.Longitude >= minLon && l.City.Longitude <= maxLon);
            }

            // Exact distance + sort in memory: the filtered set is small and this keeps SQLite/Postgres identical.
            var rows = (await q.ToListAsync())
                .Select(l => (Listing: l, Distance: origin == null ? (double?)null
                    : GeoMath.DistanceKm(origin.Latitude, origin.Longitude, l.City.Latitude, l.City.Longitude)))
                .Where(r => query.RadiusKm == null || r.Distance <= query.RadiusKm.Value);

            rows = sort switch
            {
                "nearest" => rows.OrderBy(r => r.Distance).ThenByDescending(r => r.Listing.CreatedAt),
                "price_asc" => rows.OrderBy(r => r.Listing.PriceCents == null).ThenBy(r => r.Listing.PriceCents).ThenByDescending(r => r.Listing.CreatedAt),
                "price_desc" => rows.OrderBy(r => r.Listing.PriceCents == null).ThenByDescending(r => r.Listing.PriceCents).ThenByDescending(r => r.Listing.CreatedAt),
                _ => rows.OrderByDescending(r => r.Listing.CreatedAt),
            };

            return rows.Skip((page - 1) * pageSize).Take(pageSize).Select(r => ToSummary(r.Listing, r.Distance)).ToList();
        }

        public async Task<List<ListingSummaryDto>> GetMineAsync(Guid userId)
        {
            var mine = await BaseSummaryQuery().Where(l => l.OwnerId == userId).OrderByDescending(l => l.CreatedAt).ToListAsync();
            return mine.Select(l => ToSummary(l, null)).ToList();
        }

        // ------------------------------------------------------------------ helpers

        private IQueryable<Listing> BaseSummaryQuery() => _db.Listings.AsNoTracking()
            .Include(l => l.Owner).Include(l => l.City).Include(l => l.CollectionType).Include(l => l.Images);

        public static ListingSummaryDto ToSummary(Listing l, double? distance) => new(
            l.Id, l.Kind, l.Status, l.Title, l.PriceCents, l.Currency, l.ExchangeFor, l.Condition,
            l.CollectionTypeId, l.CollectionType.Name, l.CollectionType.Color, l.CityId, l.City.Name,
            distance.HasValue ? Math.Round(distance.Value, 1) : null,
            l.Images.OrderBy(i => i.Position).Select(i => i.FileName).FirstOrDefault(),
            l.AllowsLocalPickup, l.AllowsShipping, l.PrivateSellerDeclared, l.CreatedAt, UserSummaryDto.From(l.Owner));

        private async Task<Listing> LoadAsync(Guid id) =>
            await _db.Listings.Include(l => l.Lines).Include(l => l.Images).FirstOrDefaultAsync(l => l.Id == id)
            ?? throw MarketplaceException.NotFound("Listing not found.");

        private Task<bool> HasOpenDealAsync(Guid listingId) =>
            _db.Deals.AnyAsync(d => d.ListingId == listingId && d.Status != DealStatus.Completed && d.Status != DealStatus.Cancelled && d.Status != DealStatus.Disputed);

        private async Task<bool> IsModeratorAsync(Guid userId)
        {
            var role = await _db.Users.Where(u => u.Id == userId).Select(u => (UserRole?)u.Role).FirstOrDefaultAsync();
            return role is UserRole.Moderator or UserRole.Admin;
        }

        /// <summary>Validates the input against the kind's rules and copies it onto the listing.</summary>
        private async Task ApplyInputAsync(Listing listing, ListingInput input, int imageCount)
        {
            if (!Enum.IsDefined(input.Kind)) throw MarketplaceException.Validation("Unknown listing kind.");
            listing.Title = Text.Required(input.Title, 1, 80, "Title");
            listing.Description = Text.Optional(input.Description, 2000, "Description");

            switch (input.Kind)
            {
                case ListingKind.Sell:
                    if (input.PriceCents is null or <= 0 or > 100_000_000) throw MarketplaceException.Validation("A selling price (in EUR) is required.");
                    listing.PriceCents = input.PriceCents;
                    listing.ExchangeFor = null;
                    break;
                case ListingKind.Exchange:
                    listing.ExchangeFor = Text.Required(input.ExchangeFor, 1, 300, "What you want in exchange");
                    listing.PriceCents = null;
                    break;
                case ListingKind.Wanted:
                    if (input.PriceCents is <= 0 or > 100_000_000) throw MarketplaceException.Validation("Budget must be a positive amount.");
                    listing.PriceCents = input.PriceCents;
                    listing.ExchangeFor = null;
                    break;
            }

            if (input.Kind != ListingKind.Wanted && input.Condition == null)
                throw MarketplaceException.Validation("Condition is required.");
            if (input.Condition.HasValue && !Enum.IsDefined(input.Condition.Value))
                throw MarketplaceException.Validation("Unknown condition.");
            listing.Condition = input.Condition;

            if (!input.AllowsLocalPickup && !input.AllowsShipping)
                throw MarketplaceException.Validation("Choose personal pickup, shipping, or both.");
            listing.AllowsLocalPickup = input.AllowsLocalPickup;
            listing.AllowsShipping = input.AllowsShipping;

            if (input.Kind != ListingKind.Wanted && !input.PrivateSellerDeclared)
                throw MarketplaceException.Validation("Confirm that you sell as a private person. Businesses can't sell on Coffer.");
            listing.PrivateSellerDeclared = input.PrivateSellerDeclared;

            var lines = input.Lines ?? new List<ListingLineInput>();
            if (lines.Count is < 1 or > MaxLines)
                throw MarketplaceException.Validation($"List 1 to {MaxLines} items that are included.");
            var newLines = lines.Select((line, i) =>
            {
                if (line.Quantity is < 1 or > 9999) throw MarketplaceException.Validation("Quantity must be between 1 and 9999.");
                return new ListingLine { Name = Text.Required(line.Name, 1, 80, "Item name"), Quantity = line.Quantity, Position = i };
            }).ToList();

            var minImages = input.Kind == ListingKind.Wanted ? 0 : 1;
            if (imageCount < minImages || imageCount > MaxImages)
                throw MarketplaceException.Validation(minImages == 1
                    ? $"Add 1 to {MaxImages} images."
                    : $"Add at most {MaxImages} images.");

            if (!await _db.CollectionTypes.AnyAsync(t => t.Id == input.CollectionTypeId))
                throw MarketplaceException.Validation("Unknown item type.");
            if (!await _db.Cities.AnyAsync(c => c.Id == input.CityId))
                throw MarketplaceException.Validation("Unknown city.");
            listing.CityId = input.CityId;

            _db.ListingLines.RemoveRange(listing.Lines);
            listing.Lines.Clear();
            listing.Lines.AddRange(newLines);
            listing.UpdatedAt = _clock.UtcNow;
        }

        private async Task AddImagesAsync(Listing listing, IReadOnlyList<IFormFile> files, List<string> saved, int startPosition = 0)
        {
            var position = startPosition;
            foreach (var file in files)
            {
                var image = new ListingImage { Id = Guid.NewGuid(), Position = position++ };
                image.FileName = await _images.SaveImageAsync(file, image.Id, _storage.ListingImages);
                saved.Add(image.FileName);
                listing.Images.Add(image);
                // The id is set up front (it names the file), so EF must be told explicitly that the row is new.
                if (_db.Entry(listing).State != EntityState.Detached)
                    _db.Entry(image).State = EntityState.Added;
            }
        }

        private async Task DeleteFilesAsync(IEnumerable<string> fileNames)
        {
            foreach (var name in fileNames)
            {
                try { await _images.DeleteImageAsync(name, _storage.ListingImages); }
                catch (Exception e) { Console.WriteLine($"Failed to clean up image: {e.GetType().Name}"); }
            }
        }
    }
}
