using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.DataAccess
{
    public class CofferDbContext : DbContext
    {
        public CofferDbContext(DbContextOptions<CofferDbContext> opts) : base(opts) { }

        public DbSet<User> Users { get; set; }
        public DbSet<CollectionTypeProvided> CollectionTypes { get; set; }
        public DbSet<CollectionProvided> Collections { get; set; }
        public DbSet<Attribute> Attributes { get; set; }
        public DbSet<ItemProvided> Items { get; set; }
        public DbSet<ItemAttribute> ItemAttributes { get; set; }
        public DbSet<ItemTags> ItemTags { get; set; }
        public DbSet<ItemOptions> ItemOptions { get; set; }
        public DbSet<ReactionProvided> Reactions { get; set; }
        public DbSet<FollowProvided> Follows { get; set; }
        public DbSet<UserContactProvided> UserContacts { get; set; }
        public DbSet<TradeProvided> Trades { get; set; }
        public DbSet<TradeItem> TradeItems { get; set; }
        public DbSet<OfferProvided> Offers { get; set; }
        public DbSet<OfferItem> OfferItems { get; set; }
        public DbSet<TradeReviewProvided> TradeReviews { get; set; }
        public DbSet<ItemMessage> ItemMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            //CollectionType
            modelBuilder.Entity<CollectionTypeProvided>()
                .HasMany(c => c.Attributes)
                .WithOne(at => at.CollectionTypeProvided)
                .HasForeignKey(at => at.CollectionTypeId);

            // Attributes
            modelBuilder.Entity<Attribute>()
                .HasMany(a => a.ItemAttributes)
                .WithOne(ia => ia.Attribute)
                .HasForeignKey(ia => ia.AttributeId);

            // Items -> ItemAttributes
            modelBuilder.Entity<ItemProvided>()
                .HasMany(i => i.ItemAttributes)
                .WithOne(t => t.ItemProvided)
                .HasForeignKey(t => t.ItemId);

            // Items → Tags
            modelBuilder.Entity<ItemProvided>()
                .HasMany(i => i.ItemTags)
                .WithOne(t => t.Item)
                .HasForeignKey(t => t.ItemId);

            // Items → Collection
            modelBuilder.Entity<ItemProvided>()
                .HasOne(i => i.Collection)
                .WithMany()
                .HasForeignKey(i => i.CollectionId)
                .OnDelete(DeleteBehavior.Cascade);


            // Unique constraint for (item_id, attribute_id)
            modelBuilder.Entity<ItemAttribute>()
                .HasIndex(ia => new { ia.ItemId, ia.AttributeId })
                .IsUnique();

            // ItemOptions
            modelBuilder.Entity<Attribute>()
                .HasOne(a => a.ItemOptions)
                .WithMany(o => o.Attributes)
                .HasForeignKey(a => a.ItemOptionsId)
                .OnDelete(DeleteBehavior.SetNull);

            //Reactions
            modelBuilder.Entity<ReactionProvided>()
                  .HasOne(r => r.User)
                  .WithMany()
                  .HasForeignKey(r => r.UserId);

            modelBuilder.Entity<ReactionProvided>()
                  .HasOne(r => r.Item)
                  .WithMany(i => i.Reactions)
                  .HasForeignKey(r => r.ItemId)
                  .OnDelete(DeleteBehavior.Cascade);

            //Follows
            modelBuilder.Entity<FollowProvided>()
                  .HasOne(f => f.User)
                  .WithMany()
                  .HasForeignKey(f => f.UserId);

            modelBuilder.Entity<FollowProvided>()
                  .HasOne(f => f.Collection)
                  .WithMany(c => c.Follows)
                  .HasForeignKey(f => f.CollectionId)
                  .OnDelete(DeleteBehavior.Cascade);

            //Collection
            modelBuilder.Entity<CollectionProvided>()
                   .HasOne(c => c.User)
                   .WithMany()
                   .HasForeignKey(c => c.UserId);

            //UserContact
            modelBuilder.Entity<UserContactProvided>()
                .HasOne(u => u.User)
                .WithMany(u => u.Contacts)
                .HasForeignKey(u => u.UserId);

            //TradeProvided
            modelBuilder.Entity<TradeProvided>()
                .HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TradeProvided>()
                .HasMany(t => t.TradeItems)
                .WithOne()
                .HasForeignKey(t => t.TradeId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TradeProvided>()
                .HasMany(t => t.Offers)
                .WithOne(o => o.Trade)
                .HasForeignKey(o => o.TradeId)
                .OnDelete(DeleteBehavior.Cascade);

            //TradeItem
            modelBuilder.Entity<TradeItem>()
                .HasOne(t => t.Item)
                .WithMany()
                .HasForeignKey(t => t.ItemId)
                .OnDelete(DeleteBehavior.SetNull);

            //OfferProvided
            modelBuilder.Entity<OfferProvided>()
                .HasOne(o => o.Trade)
                .WithMany(t => t.Offers)
                .HasForeignKey(o => o.TradeId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OfferProvided>()
                .HasOne(o => o.User)
                .WithMany()
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OfferProvided>()
                .HasMany(o => o.OfferItems)
                .WithOne()
                .HasForeignKey(o => o.OfferId)
                .OnDelete(DeleteBehavior.Cascade);

            //OfferItem
            modelBuilder.Entity<OfferItem>()
                .HasOne(o => o.Item)
                .WithMany()
                .HasForeignKey(o => o.ItemId)
                .OnDelete(DeleteBehavior.SetNull);

            //TradeReviewProvided
            modelBuilder.Entity<TradeReviewProvided>()
                .HasOne(t => t.ReviewerUser)
                .WithMany()
                .HasForeignKey(t => t.ReviewerId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<TradeReviewProvided>()
                .HasOne(t => t.RevieweeUser)
                .WithMany()
                .HasForeignKey(t => t.RevieweeId)
                .OnDelete(DeleteBehavior.Cascade);

            //ItemMessages
            modelBuilder.Entity<ItemMessage>()
                .HasOne(i => i.User)
                .WithMany()
                .HasForeignKey(i => i.UserId);

            modelBuilder.Entity<ItemMessage>()
                .HasOne(i => i.Item)
                .WithMany()
                .HasForeignKey(i => i.ItemId);
        }
    }

}
