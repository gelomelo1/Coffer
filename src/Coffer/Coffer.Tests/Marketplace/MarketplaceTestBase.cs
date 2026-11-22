using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    public sealed class FakeClock : IClock
    {
        public DateTime UtcNow { get; set; } = new DateTime(2026, 11, 13, 12, 0, 0, DateTimeKind.Utc);
        public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);
    }

    /// <summary>Shared fixture for marketplace service tests: SQLite db, controllable clock, seed helpers.</summary>
    public abstract class MarketplaceTestBase : IDisposable
    {
        protected readonly TestDb Db = new();
        protected readonly FakeClock Clock = new();

        protected City Budapest => GetOrAddCity(3054643, "Budapest", 47.49801, 19.03991);
        protected City Debrecen => GetOrAddCity(721472, "Debrecen", 47.53333, 21.63333);
        protected City Szeged => GetOrAddCity(715429, "Szeged", 46.253, 20.14824);

        protected City GetOrAddCity(long externalId, string name, double lat, double lon)
        {
            var existing = Db.Context.Cities.FirstOrDefault(c => c.ExternalId == externalId);
            if (existing != null) return existing;
            var city = new City { ExternalId = externalId, Name = name, CountryCode = "HU", Latitude = lat, Longitude = lon };
            Db.Context.Cities.Add(city);
            Db.Context.SaveChanges();
            return city;
        }

        protected int CollectionTypeId()
        {
            var type = Db.Context.CollectionTypes.FirstOrDefault();
            if (type == null)
            {
                type = new CollectionTypeProvided("Coins", "desc", "#a98d3c", "coin") { Published = true };
                Db.Context.CollectionTypes.Add(type);
                Db.Context.SaveChanges();
            }
            return type.Id;
        }

        /// <summary>Inserts a listing directly (bypassing the service) for tests of other components.</summary>
        protected Listing AddListing(User owner, ListingKind kind = ListingKind.Sell, bool pickup = true, bool shipping = true,
            int? priceCents = 1000, City? city = null, ListingStatus status = ListingStatus.Active)
        {
            var listing = new Listing
            {
                OwnerId = owner.Id,
                Kind = kind,
                CollectionTypeId = CollectionTypeId(),
                Title = $"{kind} listing",
                PriceCents = kind == ListingKind.Exchange ? null : priceCents,
                ExchangeFor = kind == ListingKind.Exchange ? "Old coins" : null,
                Condition = kind == ListingKind.Wanted ? null : ListingCondition.Good,
                CityId = (city ?? Budapest).Id,
                AllowsLocalPickup = pickup,
                AllowsShipping = shipping,
                Status = status,
                CreatedAt = Clock.UtcNow,
                UpdatedAt = Clock.UtcNow,
            };
            listing.Lines.Add(new ListingLine { Name = "Silver coin", Quantity = 2, Position = 0 });
            if (kind != ListingKind.Wanted)
                listing.Images.Add(new ListingImage { FileName = $"{Guid.NewGuid()}_1.jpg", Position = 0 });
            Db.Context.Listings.Add(listing);
            Db.Context.SaveChanges();
            return listing;
        }

        public virtual void Dispose() => Db.Dispose();
    }
}
