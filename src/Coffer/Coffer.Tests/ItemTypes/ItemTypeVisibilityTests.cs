using Coffer.BusinessLogic.ItemTypes;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess.Extensions;
using Coffer.Domain.Entities;
using Coffer.Tests.Deletion;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>An unpublished item type and everything in it look like they don't exist.</summary>
    public class ItemTypeVisibilityTests : IDisposable
    {
        private readonly TestDb Db = new();
        private ItemTypeVisibility Sut() => new(Db.Context);

        private CollectionTypeProvided Hidden()
        {
            var type = Db.AddCollectionType("Stamps");
            type.Published = false;
            Db.Context.SaveChanges();
            return type;
        }

        private static async Task<string> NotFoundCode(Func<Task> act)
        {
            var e = await Assert.ThrowsAsync<MarketplaceException>(act);
            Assert.Equal(MarketplaceError.NotFound, e.Error);
            return e.Code;
        }

        [Fact]
        public async Task HiddenTypeIsNotFound()
        {
            var hidden = Hidden();

            Assert.Equal("itemTypeNotFound", await NotFoundCode(() => Sut().EnsureTypeAsync(hidden.Id)));
            Assert.Equal("itemTypeNotFound", await NotFoundCode(() => Sut().EnsureTypeAsync(9999)));
            Assert.False(await Sut().IsPublishedAsync(hidden.Id));
        }

        [Fact]
        public async Task CollectionOfHiddenTypeIsNotFound()
        {
            var collection = Db.AddCollection(Db.AddUser("me"), Hidden().Id, "Stamps");

            Assert.Equal("collectionNotFound", await NotFoundCode(() => Sut().EnsureCollectionAsync(collection.Id)));
        }

        [Fact]
        public async Task ItemOfHiddenTypeIsNotFound()
        {
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("me"), Hidden().Id, "Stamps"));

            Assert.Equal("itemNotFound", await NotFoundCode(() => Sut().EnsureItemAsync(item.Id)));
        }

        [Fact]
        public async Task ListingOfHiddenTypeIsNotFound()
        {
            var hidden = Hidden();
            var listing = new MarketRows(Db).Listing(Db.AddUser("seller"));
            listing.CollectionTypeId = hidden.Id;
            Db.Context.SaveChanges();

            Assert.Equal("listingNotFound", await NotFoundCode(() => Sut().EnsureListingAsync(listing.Id)));
        }

        [Fact]
        public async Task PublishedPasses()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(me);
            var item = Db.AddItem(collection);
            var listing = new MarketRows(Db).Listing(me);

            await Sut().EnsureTypeAsync(collection.CollectionTypeId);
            await Sut().EnsureCollectionAsync(collection.Id);
            await Sut().EnsureItemAsync(item.Id);
            await Sut().EnsureListingAsync(listing.Id);
            Assert.True(await Sut().IsPublishedAsync(collection.CollectionTypeId));
        }

        [Fact]
        public void WherePublishedDropsHiddenRows()
        {
            var me = Db.AddUser("me");
            var shown = Db.AddCollection(me);
            var shownItem = Db.AddItem(shown);
            var shownListing = new MarketRows(Db).Listing(me);
            var hidden = Hidden();
            var gone = Db.AddCollection(me, hidden.Id, "Stamps");
            Db.AddItem(gone);
            var goneListing = new MarketRows(Db).Listing(me);
            goneListing.CollectionTypeId = hidden.Id;
            Db.Context.SaveChanges();

            using var ctx = Db.NewContext();
            Assert.Equal(new[] { shown.Id }, ctx.Collections.WherePublished(ctx).Select(c => c.Id).ToArray());
            Assert.Equal(new[] { shownItem.Id }, ctx.Items.WherePublished(ctx).Select(i => i.Id).ToArray());
            Assert.Equal(new[] { shownListing.Id }, ctx.Listings.WherePublished(ctx).Select(l => l.Id).ToArray());
        }

        public void Dispose() => Db.Dispose();
    }
}
