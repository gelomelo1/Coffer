using Coffer.Domain.Auth;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess
{
    /// <summary>Sign-in sessions and their refresh tokens. Must stay in sync with src/startup/oauth_sessions_migration.sql.</summary>
    internal static class AuthModel
    {
        public static void Configure(ModelBuilder b)
        {
            b.Entity<AuthSession>(e =>
            {
                e.ToTable("auth_sessions");
                e.HasOne<User>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
                e.Property(s => s.RevokeReason).HasMaxLength(40);
                e.HasIndex(s => s.UserId);
            });

            b.Entity<AuthRefreshToken>(e =>
            {
                e.ToTable("auth_refresh_tokens");
                e.HasOne<AuthSession>().WithMany().HasForeignKey(t => t.SessionId).OnDelete(DeleteBehavior.Cascade);
                e.Property(t => t.TokenHash).HasMaxLength(64).IsRequired();
                e.HasIndex(t => t.TokenHash).IsUnique();
                e.HasIndex(t => t.SessionId);
            });
        }
    }
}
