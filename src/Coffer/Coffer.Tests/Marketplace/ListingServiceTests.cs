using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Services;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Microsoft.AspNetCore.Http;

namespace Coffer.Tests.Marketplace
{
    public static class TestImages
    {
        /// <summary>A real (decodable) 8×8 JPEG: uploads are decoded on the server.</summary>
        public static readonly byte[] Jpeg = Coffer.Tests.ItemTypes.ItemTypeFilesTests.Jpeg(8, 8);

        public static IFormFile File(string name = "photo.jpg", string contentType = "image/jpeg", byte[]? bytes = null)
        {
            var data = bytes ?? Jpeg;
            return new FormFile(new MemoryStream(data), 0, data.Length, "images", name)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType,
            };
        }

        public static IFormFile[] Many(int n) => Enumerable.Range(0, n).Select(_ => File()).ToArray();
    }

    public class ListingServiceTests : MarketplaceTestBase
    {
        private readonly string _folder = Path.Combine(Path.GetTempPath(), "coffer-listings-" + Guid.NewGuid().ToString("N"));
        private readonly User _owner;
        private readonly User _viewer;

        public ListingServiceTests()
        {
            _owner = Db.AddUser("owner");
            _viewer = Db.AddUser("viewer");
        }

        private ListingService Sut() => new(Db.Context, Clock, new ImageService(), new MarketplaceStorage(_folder, _folder));

        private ListingInput Input(ListingKind kind = ListingKind.Sell, City? city = null) => new(
            Kind: kind,
            CollectionTypeId: CollectionTypeId(),
            Title: "Hungarian forint set",
            Description: "Complete set, 1990s",
            PriceCents: kind == ListingKind.Exchange ? null : 2500,
            ExchangeFor: kind == ListingKind.Exchange ? "Austrian schillings" : null,
            Condition: kind == ListingKind.Wanted ? null : ListingCondition.Good,
            CityId: (city ?? Budapest).Id,
            AllowsLocalPickup: true,
            AllowsShipping: false,
            Lines: new List<ListingLineInput> { new("10 forint coin", 3), new("Album", 1) },
            KeepImageIds: null,
            PrivateSellerDeclared: kind != ListingKind.Wanted);

        private static async Task<MarketplaceError> ErrorOf(Func<Task> act)
            => (await Assert.ThrowsAsync<MarketplaceException>(act)).Error;

        // ---------- create ----------

        [Fact]
        public async Task Create_Sell_StoresListingLinesAndImages()
        {
            var created = await Sut().CreateAsync(_owner.Id, Input(), TestImages.Many(2));

            Assert.Equal(ListingStatus.Active, created.Status);
            Assert.Equal(2, created.Lines.Count);
            Assert.Equal("10 forint coin", created.Lines[0].Name);
            Assert.Equal(2, created.Images.Count);
            Assert.All(created.Images, i => Assert.True(File.Exists(Path.Combine(_folder, i.FileName))));
            Assert.Equal(_owner.Id, Db.NewContext().Listings.Single().OwnerId);
        }

        [Fact]
        public async Task Create_Sell_RequiresPriceImageAndLine()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { PriceCents = null }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { PriceCents = 0 }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input(), Array.Empty<IFormFile>())));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Lines = new() }, TestImages.Many(1))));
            Assert.Empty(Db.NewContext().Listings);
        }

        [Fact]
        public async Task Create_ValidatesTextLimits()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Title = "  " }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Title = new string('x', 81) }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Description = new string('x', 2001) }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Lines = new() { new("coin", 0) } }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Lines = new() { new(" ", 1) } }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Lines = Enumerable.Range(0, 31).Select(i => new ListingLineInput($"c{i}", 1)).ToList() }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input(), TestImages.Many(7))));
        }

        [Fact]
        public async Task Create_Exchange_RequiresExchangeFor()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input(ListingKind.Exchange) with { ExchangeFor = null }, TestImages.Many(1))));

            var ok = await Sut().CreateAsync(_owner.Id, Input(ListingKind.Exchange) with { PriceCents = 500 }, TestImages.Many(1));
            Assert.Null(ok.PriceCents); // exchange listings never carry a price
        }

        [Fact]
        public async Task Create_Wanted_AllowsNoImageAndNoCondition()
        {
            var created = await Sut().CreateAsync(_owner.Id, Input(ListingKind.Wanted), Array.Empty<IFormFile>());
            Assert.Empty(created.Images);
            Assert.Null(created.Condition);
        }

        [Fact]
        public async Task Create_SellRequiresCondition()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { Condition = null }, TestImages.Many(1))));
        }

        [Fact]
        public async Task Create_SellOrExchange_RequiresPrivateSellerDeclaration()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { PrivateSellerDeclared = false }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input(ListingKind.Exchange) with { PrivateSellerDeclared = false }, TestImages.Many(1))));
            var wanted = await Sut().CreateAsync(_owner.Id, Input(ListingKind.Wanted) with { PrivateSellerDeclared = false }, Array.Empty<IFormFile>());
            Assert.False(wanted.PrivateSellerDeclared);
            Assert.True((await Sut().CreateAsync(_owner.Id, Input(), TestImages.Many(1))).PrivateSellerDeclared);
        }

        [Fact]
        public async Task Create_RequiresAtLeastOneDelivery()
        {
            var input = Input() with { AllowsLocalPickup = false, AllowsShipping = false };
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, input, TestImages.Many(1))));
        }

        [Fact]
        public async Task Create_RejectsUnknownCollectionTypeOrCity()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { CollectionTypeId = 999 }, TestImages.Many(1))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input() with { CityId = 999 }, TestImages.Many(1))));
        }

        [Fact]
        public async Task Create_RejectsFileThatIsNotReallyAnImage()
        {
            var fake = TestImages.File("evil.jpg", "image/jpeg", new byte[] { 0x3C, 0x68, 0x74, 0x6D, 0x6C });
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().CreateAsync(_owner.Id, Input(), new[] { fake })));
            Assert.False(Directory.Exists(_folder) && Directory.EnumerateFiles(_folder).Any());
        }

        // ---------- update ----------

        [Fact]
        public async Task Update_ByOwner_ChangesFieldsAndImages()
        {
            var created = await Sut().CreateAsync(_owner.Id, Input(), TestImages.Many(2));
            var keep = created.Images[0];
            var dropped = created.Images[1];

            var updated = await Sut().UpdateAsync(_owner.Id, created.Id,
                Input() with { Title = "Renamed", PriceCents = 3000, KeepImageIds = new() { keep.Id } }, TestImages.Many(1));

            Assert.Equal("Renamed", updated.Title);
            Assert.Equal(3000, updated.PriceCents);
            Assert.Equal(2, updated.Images.Count);
            Assert.Contains(updated.Images, i => i.Id == keep.Id);
            Assert.False(File.Exists(Path.Combine(_folder, dropped.FileName)));
        }

        [Fact]
        public async Task Update_ByNonOwner_Forbidden()
        {
            var created = await Sut().CreateAsync(_owner.Id, Input(), TestImages.Many(1));
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().UpdateAsync(_viewer.Id, created.Id, Input() with { KeepImageIds = created.Images.Select(i => i.Id).ToList() }, Array.Empty<IFormFile>())));
        }

        [Fact]
        public async Task Update_SoldListing_Conflicts()
        {
            var listing = AddListing(_owner, status: ListingStatus.Sold);
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().UpdateAsync(_owner.Id, listing.Id, Input() with { KeepImageIds = listing.Images.Select(i => i.Id).ToList() }, Array.Empty<IFormFile>())));
        }

        [Fact]
        public async Task Update_WithOpenDeal_Conflicts()
        {
            var listing = AddListing(_owner);
            var conversation = new Conversation { SubjectType = "listing", SubjectId = listing.Id, CreatedAt = Clock.UtcNow, LastMessageAt = Clock.UtcNow };
            Db.Context.Conversations.Add(conversation);
            Db.Context.Deals.Add(new Deal
            {
                ListingId = listing.Id, ConversationId = conversation.Id, SellerId = _owner.Id, BuyerId = _viewer.Id,
                Method = DeliveryMethod.LocalPickup, Status = DealStatus.Proposed, CreatedAt = Clock.UtcNow, UpdatedAt = Clock.UtcNow,
            });
            Db.Context.SaveChanges();

            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().UpdateAsync(_owner.Id, listing.Id, Input() with { PriceCents = 1, KeepImageIds = listing.Images.Select(i => i.Id).ToList() }, Array.Empty<IFormFile>())));
        }

        [Fact]
        public async Task Update_CannotChangeKindOrType()
        {
            var created = await Sut().CreateAsync(_owner.Id, Input(), TestImages.Many(1));
            var keep = created.Images.Select(i => i.Id).ToList();
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().UpdateAsync(_owner.Id, created.Id, Input(ListingKind.Exchange) with { KeepImageIds = keep }, Array.Empty<IFormFile>())));
        }

        [Fact]
        public async Task Update_RemovingAllImagesOfSellListing_Validation()
        {
            var created = await Sut().CreateAsync(_owner.Id, Input(), TestImages.Many(1));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().UpdateAsync(_owner.Id, created.Id, Input() with { KeepImageIds = new() }, Array.Empty<IFormFile>())));
        }

        // ---------- archive ----------

        [Fact]
        public async Task Archive_ThenReactivate_ByOwnerOnly()
        {
            var listing = AddListing(_owner);

            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().ArchiveAsync(_viewer.Id, listing.Id)));
            Assert.Equal(ListingStatus.Archived, (await Sut().ArchiveAsync(_owner.Id, listing.Id)).Status);
            Assert.Equal(MarketplaceError.Forbidden, await ErrorOf(() => Sut().ReactivateAsync(_viewer.Id, listing.Id)));
            Assert.Equal(ListingStatus.Active, (await Sut().ReactivateAsync(_owner.Id, listing.Id)).Status);
        }

        [Fact]
        public async Task Archived_HiddenFromOthers_VisibleToOwner()
        {
            var listing = AddListing(_owner, status: ListingStatus.Archived);
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Sut().GetAsync(_viewer.Id, listing.Id)));
            Assert.True((await Sut().GetAsync(_owner.Id, listing.Id)).IsMine);
        }

        // ---------- search ----------

        [Fact]
        public async Task Search_FiltersAndSortsByDistance()
        {
            var szeged = AddListing(_owner, city: Szeged);
            var debrecen = AddListing(_owner, city: Debrecen);
            var budapest = AddListing(_owner, city: Budapest);

            var within200 = await Sut().SearchAsync(_viewer.Id, new ListingQuery { CityId = Budapest.Id, RadiusKm = 200, Sort = "nearest" });
            Assert.Equal(new[] { budapest.Id, szeged.Id, debrecen.Id }, within200.Select(l => l.Id));
            Assert.Equal(0, within200[0].DistanceKm!.Value, 1);

            var within180 = await Sut().SearchAsync(_viewer.Id, new ListingQuery { CityId = Budapest.Id, RadiusKm = 180, Sort = "nearest" });
            Assert.Equal(new[] { budapest.Id, szeged.Id }, within180.Select(l => l.Id));
        }

        [Fact]
        public async Task Search_NearestWithoutCity_Validation()
        {
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().SearchAsync(_viewer.Id, new ListingQuery { Sort = "nearest" })));
        }

        [Fact]
        public async Task Search_ExcludesOwnAndInactive()
        {
            AddListing(_viewer);
            AddListing(_owner, status: ListingStatus.Archived);
            AddListing(_owner, status: ListingStatus.Sold);
            var active = AddListing(_owner);

            var result = await Sut().SearchAsync(_viewer.Id, new ListingQuery());
            Assert.Equal(active.Id, Assert.Single(result).Id);
        }

        [Fact]
        public async Task Search_PriceRangeKindDeliveryAndSort()
        {
            var cheap = AddListing(_owner, priceCents: 500);
            var mid = AddListing(_owner, priceCents: 1500, shipping: false);
            var pricey = AddListing(_owner, priceCents: 9000);
            AddListing(_owner, kind: ListingKind.Exchange);

            var ranged = await Sut().SearchAsync(_viewer.Id, new ListingQuery { MinPriceCents = 1000, MaxPriceCents = 10000, Sort = "price_desc" });
            Assert.Equal(new[] { pricey.Id, mid.Id }, ranged.Select(l => l.Id));

            var asc = await Sut().SearchAsync(_viewer.Id, new ListingQuery { Kind = ListingKind.Sell, Sort = "price_asc" });
            Assert.Equal(new[] { cheap.Id, mid.Id, pricey.Id }, asc.Select(l => l.Id));

            var shipping = await Sut().SearchAsync(_viewer.Id, new ListingQuery { Kind = ListingKind.Sell, Delivery = DeliveryMethod.Shipping });
            Assert.DoesNotContain(shipping, l => l.Id == mid.Id);
        }

        [Fact]
        public async Task Search_Newest_IsDefaultAndPaged()
        {
            var first = AddListing(_owner);
            Clock.Advance(TimeSpan.FromMinutes(1));
            var second = AddListing(_owner);

            var page1 = await Sut().SearchAsync(_viewer.Id, new ListingQuery { PageSize = 1 });
            var page2 = await Sut().SearchAsync(_viewer.Id, new ListingQuery { PageSize = 1, Page = 2 });
            Assert.Equal(second.Id, Assert.Single(page1).Id);
            Assert.Equal(first.Id, Assert.Single(page2).Id);
        }

        public override void Dispose()
        {
            base.Dispose();
            if (Directory.Exists(_folder)) Directory.Delete(_folder, true);
        }
    }
}
