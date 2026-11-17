using Coffer.Domain.Community;
using Coffer.Domain.Entities;
using Coffer.Domain.Moderation;
using Coffer.Domain.Marketplace;
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
        // Community
        public DbSet<ItemComment> ItemComments { get; set; }
        public DbSet<ItemCommentMention> ItemCommentMentions { get; set; }

        // Coffer.Manager moderation
        public DbSet<ManagerAdmin> ManagerAdmins { get; set; }
        public DbSet<UserSuspension> UserSuspensions { get; set; }
        public DbSet<AdminAuditEntry> AdminAuditLog { get; set; }

        // Marketplace
        public DbSet<City> Cities { get; set; }
        public DbSet<Listing> Listings { get; set; }
        public DbSet<ListingLine> ListingLines { get; set; }
        public DbSet<ListingImage> ListingImages { get; set; }
        public DbSet<Conversation> Conversations { get; set; }
        public DbSet<ConversationParticipant> ConversationParticipants { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<Deal> Deals { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<Report> Reports { get; set; }
        public DbSet<ModerationAction> ModerationActions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            MarketplaceModel.Configure(modelBuilder);
            CommunityModel.Configure(modelBuilder);

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

            // Translations of reference names: language code → text, stored as JSON (jsonb on PostgreSQL).
            Translations<CollectionTypeProvided>(modelBuilder, t => t.NameTranslations);
            Translations<Coffer.Domain.Entities.Attribute>(modelBuilder, a => a.NameTranslations);
            Translations<ItemOptions>(modelBuilder, o => o.OptionLabelsTranslations);

            //Collection
            modelBuilder.Entity<CollectionProvided>()
                   .HasOne(c => c.User)
                   .WithMany()
                   .HasForeignKey(c => c.UserId);
        }

        private static readonly System.Text.Json.JsonSerializerOptions TranslationJson = new();

        private static readonly Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<Dictionary<string, string>, string> TranslationConverter =
            new(v => System.Text.Json.JsonSerializer.Serialize(v, TranslationJson),
                v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(v, TranslationJson) ?? new Dictionary<string, string>());

        private static readonly Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<Dictionary<string, string>> TranslationComparer =
            new((a, b) => System.Text.Json.JsonSerializer.Serialize(a, TranslationJson) == System.Text.Json.JsonSerializer.Serialize(b, TranslationJson),
                v => System.Text.Json.JsonSerializer.Serialize(v, TranslationJson).GetHashCode(),
                v => new Dictionary<string, string>(v));

        private void Translations<T>(ModelBuilder modelBuilder, System.Linq.Expressions.Expression<Func<T, Dictionary<string, string>>> property) where T : class
        {
            var p = modelBuilder.Entity<T>().Property(property).HasConversion(TranslationConverter, TranslationComparer).IsRequired();
            if (Database.IsNpgsql()) p.HasColumnType("jsonb");
        }
    }

}
