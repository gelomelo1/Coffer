using Coffer.DataAccess;
using Coffer.DataAccess.Extensions.IncludeProviders;
using Coffer.DataAccess.Repositories;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Coffer.Tests
{
    /// <summary>
    /// Real CofferDbContext on an in-memory SQLite database (supports real transactions),
    /// plus helpers to seed the minimal object graph the security tests need.
    /// </summary>
    public sealed class TestDb : IDisposable
    {
        private readonly SqliteConnection _connection;
        public CofferDbContext Context { get; }
        public SqliteConnection Connection => _connection;
        public DbContextOptions<CofferDbContext> Options { get; }

        public TestDb()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();
            Options = new DbContextOptionsBuilder<CofferDbContext>()
                .UseSqlite(_connection)
                .Options;
            Context = new CofferDbContext(Options);
            Context.Database.EnsureCreated();
        }

        /// <summary>A new, untracked context for asserting what is really persisted.</summary>
        public CofferDbContext NewContext() => new(Options);

        public UsersRepository Users => new(Context, new UserIncludeProvider());
        public CollectionsRepository Collections => new(Context, new CollectionIncludeProvider());
        public ItemsRepository Items => new(Context, new ItemIncludeProvider());
        public FollowsRepository Follows => new(Context);
        public TradesRepository Trades => new(Context, new TradeIncludeProvider());
        public OffersRepository Offers => new(Context, new OfferIncludeProvider());
        public TradeReviewsRepository TradeReviews => new(Context, new TradeReviewIncludeProvider());

        public User AddUser(string name, UserRole role = UserRole.User)
        {
            var user = new User(name, $"{name}@example.com", "google", "HU", $"sub-{name}", null, role);
            Context.Users.Add(user);
            Context.SaveChanges();
            return user;
        }

        public CollectionProvided AddCollection(User owner)
        {
            var type = Context.CollectionTypes.FirstOrDefault();
            if (type == null)
            {
                type = new CollectionTypeProvided("Coins", "desc", "#fff", "icon");
                Context.CollectionTypes.Add(type);
                Context.SaveChanges();
            }
            var collection = new CollectionProvided(owner.Id, type.Id, $"{owner.Name}'s collection");
            Context.Collections.Add(collection);
            Context.SaveChanges();
            return collection;
        }

        public ItemProvided AddItem(CollectionProvided collection, string image = "", string? privateNote = null)
        {
            var item = new ItemProvided(collection.Id, 1, image, null, privateNote);
            Context.Items.Add(item);
            Context.SaveChanges();
            if (image == "")
            {
                item.Image = $"{item.Id}_20260101000000.jpg";
                Context.SaveChanges();
            }
            return item;
        }

        public TradeProvided AddTrade(User owner, params ItemProvided[] items)
        {
            var trade = new TradeProvided(owner.Id, "title", "description");
            foreach (var item in items)
                trade.TradeItems.Add(new TradeItem { ItemId = item.Id });
            Context.Trades.Add(trade);
            Context.SaveChanges();
            return trade;
        }

        public OfferProvided AddOffer(TradeProvided trade, User offerer, string status = "pending", params ItemProvided[] items)
        {
            var offer = new OfferProvided(trade.Id, offerer.Id, null, status);
            foreach (var item in items)
                offer.OfferItems.Add(new OfferItem { ItemId = item.Id });
            Context.Offers.Add(offer);
            Context.SaveChanges();
            return offer;
        }

        public TradeReviewProvided AddReview(TradeProvided trade, User reviewer, User reviewee)
        {
            var review = new TradeReviewProvided(trade.Id, reviewer.Id, reviewee.Id, true, "ok");
            Context.TradeReviews.Add(review);
            Context.SaveChanges();
            return review;
        }

        public void Dispose()
        {
            Context.Dispose();
            _connection.Dispose();
        }
    }
}
