using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Extensions
{
    /// <summary>
    /// Read filters for the app: things of an unpublished item type don't exist for users (nothing is deleted; the
    /// Manager publishes the type again). Deals in progress and their chats deliberately don't use these.
    /// </summary>
    public static class PublishedTypes
    {
        public static IQueryable<CollectionProvided> WherePublished(this IQueryable<CollectionProvided> q, DbContext db)
        {
            var types = db.Set<CollectionTypeProvided>();
            return q.Where(c => types.Any(t => t.Id == c.CollectionTypeId && t.Published));
        }

        public static IQueryable<ItemProvided> WherePublished(this IQueryable<ItemProvided> q, DbContext db)
        {
            var types = db.Set<CollectionTypeProvided>();
            var collections = db.Set<CollectionProvided>();
            return q.Where(i => collections.Any(c => c.Id == i.CollectionId && types.Any(t => t.Id == c.CollectionTypeId && t.Published)));
        }

        public static IQueryable<CollectionTypeProvided> WherePublished(this IQueryable<CollectionTypeProvided> q) => q.Where(t => t.Published);

        public static IQueryable<Coffer.Domain.Entities.Attribute> WherePublished(this IQueryable<Coffer.Domain.Entities.Attribute> q, DbContext db)
        {
            var types = db.Set<CollectionTypeProvided>();
            return q.Where(a => types.Any(t => t.Id == a.CollectionTypeId && t.Published));
        }

        public static IQueryable<FollowProvided> WherePublished(this IQueryable<FollowProvided> q, DbContext db)
        {
            var shown = db.Set<CollectionProvided>().WherePublished(db);
            return q.Where(f => shown.Any(c => c.Id == f.CollectionId));
        }

        public static IQueryable<ItemTags> WherePublished(this IQueryable<ItemTags> q, DbContext db)
        {
            var shown = db.Set<ItemProvided>().WherePublished(db);
            return q.Where(t => shown.Any(i => i.Id == t.ItemId));
        }

        public static IQueryable<ReactionProvided> WherePublished(this IQueryable<ReactionProvided> q, DbContext db)
        {
            var shown = db.Set<ItemProvided>().WherePublished(db);
            return q.Where(r => shown.Any(i => i.Id == r.ItemId));
        }

        public static IQueryable<Listing> WherePublished(this IQueryable<Listing> q, DbContext db)
        {
            var types = db.Set<CollectionTypeProvided>();
            return q.Where(l => types.Any(t => t.Id == l.CollectionTypeId && t.Published));
        }
    }
}
