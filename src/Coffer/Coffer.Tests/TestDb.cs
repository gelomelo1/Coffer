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
                .UseSnakeCaseNamingConvention()
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

        /// <summary>Adds a user; by default they already accepted the current marketplace terms.</summary>
        public User AddUser(string name, UserRole role = UserRole.User, bool acceptMarketTerms = true)
        {
            var user = new User(name, $"{name}@example.com", "google", "HU", $"sub-{name}", null, role);
            if (acceptMarketTerms)
            {
                user.MarketTermsVersion = Coffer.BusinessLogic.Marketplace.Terms.MarketTerms.CurrentVersion;
                user.MarketTermsAcceptedAt = DateTime.UtcNow;
            }
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

        public void Dispose()
        {
            Context.Dispose();
            _connection.Dispose();
        }
    }
}
