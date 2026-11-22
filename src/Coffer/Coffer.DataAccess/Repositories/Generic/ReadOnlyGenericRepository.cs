using Coffer.DataAccess.Extensions;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;

namespace Coffer.DataAccess.Repositories.Generic
{
    public abstract class ReadOnlyGenericRepository<Tkey, TEntity, TProvided>
      : IReadOnlyGenericRepository<Tkey, TEntity, TProvided>
      where Tkey : notnull
      where TEntity : class, TProvided
      where TProvided : class, IGenericEntity<Tkey>
    {
        protected readonly DbContext _dbContext;
        protected readonly DbSet<TEntity> _dbSet;
        protected readonly IIncludeProvider<TEntity>? _includeProvider;

        protected ReadOnlyGenericRepository(DbContext dbContext, IIncludeProvider<TEntity>? includeProvider = null)
        {
            _dbContext = dbContext;
            _dbSet = dbContext.Set<TEntity>();
            _includeProvider = includeProvider;
        }

        /// <summary>Hides tombstones (deleted rows kept only as placeholders) of entities that have them.</summary>
        protected static IQueryable<TEntity> Live(IQueryable<TEntity> query) =>
            typeof(ITombstoned).IsAssignableFrom(typeof(TEntity))
                ? query.Where(e => EF.Property<DateTime?>(e, nameof(ITombstoned.DeletedAt)) == null)
                : query;

        /// <summary>
        /// What the app may see of this entity: tombstones hidden, and (overridden where it applies) everything of an
        /// unpublished item type. Every generic list, page, get-by-id and update goes through here.
        /// </summary>
        protected virtual IQueryable<TEntity> Visible(IQueryable<TEntity> query) => Live(query);

        public virtual async Task<IEnumerable<TProvided>> GetItemsAsync(string? filter = null, string? orderBy = null, int? page = null, int? pageSize = null)
        {
            IQueryable<TEntity> query = Visible(_dbSet);


            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }

            if (!string.IsNullOrWhiteSpace(filter))
                query = query.Where(filter);

            if (!string.IsNullOrWhiteSpace(orderBy))
                query = query.OrderBy(orderBy);

            if (page.HasValue && pageSize.HasValue)
                query = query.Skip((page.Value - 1) * pageSize.Value).Take(pageSize.Value);

            var list = await query.ToListAsync();
            return list.Cast<TProvided>();
        }

        public virtual async Task<Coffer.Domain.Paging.PagedList<TProvided>> GetPageAsync(string? filter, string? orderBy, int? page, int? pageSize)
        {
            IQueryable<TEntity> query = Visible(_dbSet);
            if (!string.IsNullOrWhiteSpace(filter))
                query = query.Where(filter);
            // Id last, so rows with equal sort values keep one order and no row shows up on two pages.
            query = query.OrderBy(string.IsNullOrWhiteSpace(orderBy) ? "Id" : orderBy + ", Id");

            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }

            var result = await Coffer.DataAccess.Extensions.PagingExtensions.ToPagedListAsync(query, page, pageSize);
            return new Coffer.Domain.Paging.PagedList<TProvided>(result.Items.Cast<TProvided>().ToList(), result.Page, result.PageSize, result.Total);
        }

        public virtual async Task<TProvided?> GetItemByIdAsync(Tkey id)
        {
            IQueryable<TEntity> query = Visible(_dbSet);

            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }

            var entity = await query.FirstOrDefaultAsync(e => EF.Property<Tkey>(e, "Id").Equals(id));
            return entity == null ? null : (TProvided)entity;
        }
    }
}
