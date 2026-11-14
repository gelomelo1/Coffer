using Coffer.Domain.Community;
using Coffer.Domain.Entities;
using Coffer.Domain.Moderation;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess
{
    /// <summary>
    /// EF mapping of item comments and the Coffer.Manager moderation tables.
    /// Must stay in sync with src/startup/moderation_comments_migration.sql.
    /// </summary>
    internal static class CommunityModel
    {
        public static void Configure(ModelBuilder b)
        {
            b.Entity<ItemComment>(e =>
            {
                e.ToTable("item_comments");
                e.HasOne(c => c.Item).WithMany().HasForeignKey(c => c.ItemId).OnDelete(DeleteBehavior.Cascade);
                e.HasOne(c => c.Author).WithMany().HasForeignKey(c => c.AuthorId).OnDelete(DeleteBehavior.Cascade);
                // Parent rows are never hard-deleted while they have replies (tombstones). NO ACTION (checked at the end
                // of the statement) lets whole threads go together when their item is deleted (cascade from items).
                e.HasOne<ItemComment>().WithMany().HasForeignKey(c => c.ParentId).OnDelete(DeleteBehavior.NoAction);
                e.HasMany(c => c.Mentions).WithOne().HasForeignKey(m => m.CommentId).OnDelete(DeleteBehavior.Cascade);
                e.Property(c => c.Body).IsRequired();
                e.HasIndex(c => new { c.ItemId, c.ParentId, c.CreatedAt });
                e.HasIndex(c => c.RootId);
                e.HasIndex(c => c.AuthorId);
            });

            b.Entity<ItemCommentMention>(e =>
            {
                e.ToTable("item_comment_mentions");
                e.HasKey(m => new { m.CommentId, m.UserId });
                e.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
            });

            b.Entity<ManagerAdmin>(e =>
            {
                e.ToTable("manager_admins");
                e.HasIndex(a => a.GithubId).IsUnique();
                e.Property(a => a.GithubId).HasMaxLength(40);
                e.Property(a => a.Login).HasMaxLength(100);
            });

            b.Entity<UserSuspension>(e =>
            {
                e.ToTable("user_suspensions", t =>
                {
                    t.HasCheckConstraint("ck_user_suspensions_period", "ends_at > starts_at");
                });
                e.HasOne<User>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
                e.HasOne<ManagerAdmin>().WithMany().HasForeignKey(s => s.CreatedByAdminId).OnDelete(DeleteBehavior.Restrict);
                e.HasOne<ManagerAdmin>().WithMany().HasForeignKey(s => s.RevokedByAdminId).OnDelete(DeleteBehavior.Restrict);
                e.HasIndex(s => new { s.UserId, s.EndsAt });
            });

            b.Entity<AdminAuditEntry>(e =>
            {
                e.ToTable("admin_audit_log");
                e.HasOne<ManagerAdmin>().WithMany().HasForeignKey(a => a.AdminId).OnDelete(DeleteBehavior.Restrict);
                e.Property(a => a.Details).HasColumnType("jsonb");
                e.Property(a => a.Action).HasMaxLength(60);
                e.Property(a => a.TargetType).HasMaxLength(40);
                e.HasIndex(a => a.CreatedAt);
            });
        }
    }
}
