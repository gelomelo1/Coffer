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

        }
    }

}
