using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess.Extensions;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.News
{
    /// <summary>Something a news post can link to: <see cref="Link"/> is the in-app address ("coffer://{type}/{id}").</summary>
    public sealed record LinkTargetDto(string Type, Guid Id, string Label, string? Detail, string Link);

    public sealed partial class NewsService
    {
        public const int MaxLinkTargets = 20;
        private static readonly string[] LinkTypes = { "user", "collection", "item", "listing", "news" };

        /// <summary>
        /// The Manager's link picker: up to 20 live rows of <paramref name="type"/> whose name contains <paramref name="query"/>
        /// (any case). Deleted users, tombstoned rows, removed listings and anything of an unpublished item type are never offered,
        /// because the app could not open them.
        /// </summary>
        public async Task<List<LinkTargetDto>> LinkTargetsAsync(string? type, string? query)
        {
            var kind = (type ?? "").Trim().ToLowerInvariant();
            if (!LinkTypes.Contains(kind))
                throw MarketplaceException.Validation("unknownLinkTargetType", "The link type must be user, collection, item, listing or news.");
            var q = (query ?? "").Trim().ToLowerInvariant();
            if (q.Length > 100) q = q[..100];

            var users = _db.Users.AsNoTracking().Where(u => u.DeletedAt == null);
            var collections = _db.Collections.AsNoTracking().Where(c => c.DeletedAt == null && users.Any(u => u.Id == c.UserId)).WherePublished(_db);

            List<(Guid Id, string Label, string? Detail)> rows;
            switch (kind)
            {
                case "user":
                    rows = (await users.Where(u => q == "" || u.Name.ToLower().Contains(q))
                        .OrderBy(u => u.Name).ThenBy(u => u.Id).Take(MaxLinkTargets)
                        .Select(u => new { u.Id, u.Name }).ToListAsync())
                        .Select(u => (u.Id, u.Name, (string?)null)).ToList();
                    break;
                case "collection":
                    rows = (await collections.Where(c => q == "" || c.Name.ToLower().Contains(q))
                        .OrderBy(c => c.Name).ThenBy(c => c.Id).Take(MaxLinkTargets)
                        .Select(c => new { c.Id, c.Name, Owner = users.Where(u => u.Id == c.UserId).Select(u => u.Name).FirstOrDefault() }).ToListAsync())
                        .Select(c => (c.Id, c.Name, c.Owner)).ToList();
                    break;
                case "item":
                    var named = _db.Items.AsNoTracking().Where(i => i.DeletedAt == null && collections.Any(c => c.Id == i.CollectionId))
                        .Select(i => new
                        {
                            i.Id,
                            Name = _db.ItemAttributes.Where(a => a.ItemId == i.Id && a.Attribute.Primary).Select(a => a.ValueString).FirstOrDefault(),
                            i.Description,
                            Collection = collections.Where(c => c.Id == i.CollectionId).Select(c => c.Name).FirstOrDefault(),
                        });
                    rows = (await named.Where(i => q == "" || (i.Name != null && i.Name.ToLower().Contains(q))
                            || (i.Description != null && i.Description.ToLower().Contains(q)))
                        .OrderBy(i => i.Name ?? i.Description).ThenBy(i => i.Id).Take(MaxLinkTargets).ToListAsync())
                        .Select(i => (i.Id, i.Name ?? i.Description ?? "Item", i.Collection)).ToList();
                    break;
                case "listing":
                    var types = _db.CollectionTypes.AsNoTracking().Where(t => t.Published);
                    rows = (await _db.Listings.AsNoTracking()
                        .Where(l => l.DeletedAt == null && l.Status != ListingStatus.Removed && users.Any(u => u.Id == l.OwnerId)
                            && types.Any(t => t.Id == l.CollectionTypeId))
                        .Where(l => q == "" || l.Title.ToLower().Contains(q))
                        .OrderBy(l => l.Title).ThenBy(l => l.Id).Take(MaxLinkTargets)
                        .Select(l => new { l.Id, l.Title, Owner = users.Where(u => u.Id == l.OwnerId).Select(u => u.Name).FirstOrDefault() }).ToListAsync())
                        .Select(l => (l.Id, l.Title, l.Owner)).ToList();
                    break;
                default:
                    rows = (await _db.NewsPosts.AsNoTracking().Where(n => q == "" || n.Title.ToLower().Contains(q))
                        .OrderByDescending(n => n.UpdatedAt).ThenBy(n => n.Id).Take(MaxLinkTargets)
                        .Select(n => new { n.Id, n.Title, n.Status }).ToListAsync())
                        .Select(n => (n.Id, n.Title, (string?)(n.Status == NewsStatus.Published ? "published" : "draft"))).ToList();
                    break;
            }
            return rows.Select(r => new LinkTargetDto(kind, r.Id, r.Label, r.Detail, $"coffer://{kind}/{r.Id}")).ToList();
        }
    }
}
