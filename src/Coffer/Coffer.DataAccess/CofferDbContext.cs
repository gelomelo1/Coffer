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
        

            // Unique constraint for (item_id, attribute_id)
            modelBuilder.Entity<ItemAttribute>()
                .HasIndex(ia => new { ia.ItemId, ia.AttributeId })
                .IsUnique();
          
        }
    }

}
