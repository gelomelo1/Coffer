using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories.Generic
{
    public abstract class GenericRepository<Tkey, TEntity, TProvided, TRequired>
        : ReadOnlyGenericRepository<Tkey, TEntity, TProvided>, IGenericRepository<Tkey, TEntity, TProvided, TRequired>
        where Tkey : notnull
        where TEntity : class, TProvided
        where TProvided : class, IGenericEntity<Tkey>
        where TRequired : class
    {
        protected GenericRepository(DbContext dbContext, IIncludeProvider<TEntity>? includeProvider = null) : base(dbContext, includeProvider) 
        {
        }

        public virtual async Task<TProvided> InsertItemAsync(TRequired item)
        {
            var entity = MapToEntity(item);
            _dbSet.Add(entity);
            await _dbContext.SaveChangesAsync();
            return (TProvided)entity;
        }

        public virtual async Task<TProvided?> UpdateItemAsync(Tkey id, TRequired item)
        {
            IQueryable<TEntity> query = _dbSet;

            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }
            var entity = await query.FirstOrDefaultAsync(e => EF.Property<Tkey>(e, "Id").Equals(id));

            entity = MapToEntity(item, entity);
            await _dbContext.SaveChangesAsync();
            return (TProvided)entity;
        }

        public virtual async Task<bool> DeleteItemAsync(Tkey id)
        {
            var entity = await _dbSet.FindAsync(id);
            if (entity == null) return false;

            _dbSet.Remove(entity);
            await _dbContext.SaveChangesAsync();
            return true;
        }

        protected abstract TEntity MapToEntity(TRequired required, TEntity? entity = null);
    }
}
