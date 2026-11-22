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

        public static IQueryable<Listing> WherePublished(this IQueryable<Listing> q, DbContext db)
        {
            var types = db.Set<CollectionTypeProvided>();
            return q.Where(l => types.Any(t => t.Id == l.CollectionTypeId && t.Published));
        }
    }
}
