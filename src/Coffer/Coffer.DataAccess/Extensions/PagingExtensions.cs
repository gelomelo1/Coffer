using Coffer.Domain.Paging;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Extensions
{
    public static class PagingExtensions
    {
        /// <summary>Counts the (filtered) query, then takes one page of it. The query must already be ordered stably.</summary>
        public static async Task<PagedList<T>> ToPagedListAsync<T>(this IQueryable<T> query, int? page, int? pageSize)
        {
            var (p, size) = Paging.Normalize(page, pageSize);
            var total = await query.CountAsync();
            var items = await query.Skip(Paging.Skip(p, size)).Take(size).ToListAsync();
            return new PagedList<T>(items, p, size, total);
        }

        /// <summary>The same for a list that is already ranked in memory.</summary>
        public static PagedList<T> ToPagedList<T>(this IEnumerable<T> ranked, int? page, int? pageSize)
        {
            var (p, size) = Paging.Normalize(page, pageSize);
            var all = ranked as IReadOnlyList<T> ?? ranked.ToList();
            return new PagedList<T>(all.Skip(Paging.Skip(p, size)).Take(size).ToList(), p, size, all.Count);
        }

        public static PagedList<T> Empty<T>(int? page, int? pageSize)
        {
            var (p, size) = Paging.Normalize(page, pageSize);
            return new PagedList<T>(new List<T>(), p, size, 0);
        }
    }
}
