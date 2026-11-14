using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Coffer.DataAccess
{
    /// <summary>EF mapping of the marketplace tables. Must stay in sync with src/startup/marketplace_migration.sql.</summary>
    internal static class MarketplaceModel
    {
        private sealed class SnakeEnumConverter<TEnum> : ValueConverter<TEnum, string> where TEnum : struct, Enum
        {
            public SnakeEnumConverter() : base(v => EnumText.ToSnake(v), v => EnumText.FromSnake<TEnum>(v)) { }
        }

        public static void Configure(ModelBuilder b)
        {
            b.Entity<City>(e =>
            {
                e.ToTable("cities");
                e.HasIndex(c => c.ExternalId).IsUnique();
            });

            b.Entity<Listing>(e =>
            {
                e.ToTable("listings", t =>
                {
                    t.HasCheckConstraint("ck_listings_delivery", "allows_local_pickup OR allows_shipping");
                });
                e.HasOne(l => l.Owner).WithMany().HasForeignKey(l => l.OwnerId).OnDelete(DeleteBehavior.Cascade);
                e.HasOne(l => l.CollectionType).WithMany().HasForeignKey(l => l.CollectionTypeId).OnDelete(DeleteBehavior.Restrict);
                e.HasOne(l => l.City).WithMany().HasForeignKey(l => l.CityId).OnDelete(DeleteBehavior.Restrict);
                e.HasMany(l => l.Lines).WithOne().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Cascade);
                e.HasMany(l => l.Images).WithOne().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Cascade);
                e.Property(l => l.Currency).HasDefaultValue("EUR");
                e.HasIndex(l => new { l.Status, l.CollectionTypeId });
                e.HasIndex(l => l.CityId);
            });
            b.Entity<ListingLine>().ToTable("listing_lines");
            b.Entity<ListingImage>().ToTable("listing_images");

            b.Entity<Conversation>(e =>
            {
                e.ToTable("conversations");
                e.HasMany(c => c.Participants).WithOne().HasForeignKey(p => p.ConversationId).OnDelete(DeleteBehavior.Cascade);
                e.HasMany(c => c.Messages).WithOne().HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
                e.HasIndex(c => new { c.SubjectType, c.SubjectId });
            });
            b.Entity<ConversationParticipant>(e =>
            {
                e.ToTable("conversation_participants");
                e.HasKey(p => new { p.ConversationId, p.UserId });
                e.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            });
            b.Entity<Message>(e =>
            {
                e.ToTable("messages");
                e.HasOne(m => m.Sender).WithMany().HasForeignKey(m => m.SenderId).OnDelete(DeleteBehavior.SetNull);
                e.Property(m => m.Payload).HasColumnType("jsonb");
                e.HasIndex(m => new { m.ConversationId, m.CreatedAt });
            });

            b.Entity<Deal>(e =>
            {
                e.ToTable("deals");
                e.HasOne(d => d.Listing).WithMany().HasForeignKey(d => d.ListingId).OnDelete(DeleteBehavior.Cascade);
                e.HasOne<Conversation>().WithMany().HasForeignKey(d => d.ConversationId).OnDelete(DeleteBehavior.Cascade);
                e.HasOne(d => d.Seller).WithMany().HasForeignKey(d => d.SellerId).OnDelete(DeleteBehavior.Cascade);
                e.HasOne(d => d.Buyer).WithMany().HasForeignKey(d => d.BuyerId).OnDelete(DeleteBehavior.Cascade);
                e.Property(d => d.HandoffPin).HasMaxLength(4);
                var open = string.Join(",", DealStatuses.Open.Select(s => $"'{EnumText.ToSnake(s)}'"));
                e.HasIndex(d => d.ListingId).IsUnique().HasFilter($"status IN ({open})").HasDatabaseName("ux_deals_one_open_per_listing");
            });

            b.Entity<Review>(e =>
            {
                e.ToTable("reviews", t =>
                {
                    t.HasCheckConstraint("ck_reviews_stars", "stars BETWEEN 1 AND 5");
                    t.HasCheckConstraint("ck_reviews_low_rating_context",
                        "stars > 2 OR (reason_tag IS NOT NULL AND comment IS NOT NULL AND length(trim(comment)) >= 20)");
                });
                e.HasOne(r => r.Deal).WithMany().HasForeignKey(r => r.DealId).OnDelete(DeleteBehavior.Cascade);
                e.HasOne(r => r.Reviewer).WithMany().HasForeignKey(r => r.ReviewerId).OnDelete(DeleteBehavior.SetNull);
                e.HasOne(r => r.Reviewee).WithMany().HasForeignKey(r => r.RevieweeId).OnDelete(DeleteBehavior.Cascade);
                e.HasIndex(r => new { r.DealId, r.ReviewerId }).IsUnique();
                e.HasIndex(r => r.RevieweeId);
            });

            b.Entity<Report>(e =>
            {
                e.ToTable("reports");
                e.HasOne<Coffer.Domain.Entities.User>().WithMany().HasForeignKey(r => r.ReporterId).OnDelete(DeleteBehavior.Cascade);
                e.Property(r => r.Snapshot).HasColumnType("jsonb");
                e.HasIndex(r => new { r.Status, r.CreatedAt });
                e.HasIndex(r => new { r.ReporterId, r.TargetType, r.TargetId });
                e.HasIndex(r => r.TargetOwnerId);
            });

            b.Entity<ModerationAction>(e =>
            {
                e.ToTable("moderation_actions");
                e.HasOne<Coffer.Domain.Entities.User>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
                e.HasIndex(a => new { a.UserId, a.CreatedAt });
            });

            ApplyEnumConverters(b);
        }

        /// <summary>Every marketplace enum (nullable or not) is stored as its snake_case text.</summary>
        private static void ApplyEnumConverters(ModelBuilder b)
        {
            foreach (var entity in b.Model.GetEntityTypes().Where(t => t.ClrType.Namespace == typeof(Listing).Namespace))
            {
                foreach (var property in entity.GetProperties())
                {
                    var enumType = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                    if (!enumType.IsEnum) continue;
                    var converter = (ValueConverter)Activator.CreateInstance(typeof(SnakeEnumConverter<>).MakeGenericType(enumType))!;
                    property.SetValueConverter(converter);
                    property.SetMaxLength(40);
                }
            }
        }
    }
}
