using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories.Generic
{
    public abstract class GenericRepository<Tkey, TEntity, TProvided, TRequired> : IGenericRepository<Tkey, TEntity, TProvided, TRequired>
        where Tkey : notnull
        where TEntity : class, TProvided
        where TProvided : class, IGenericEntity<Tkey>
        where TRequired : class
    {
        protected readonly DbContext _dbContext;
        protected readonly DbSet<TEntity> _dbSet;

        public GenericRepository(DbContext dbContext)
        {
            _dbContext = dbContext;
            _dbSet = dbContext.Set<TEntity>();
        }

        public virtual async Task<bool> DeleteItemAsync(Tkey id)
        {
            var entity = await _dbSet.FindAsync(id);
            if (entity == null) return false;

            _dbSet.Remove(entity);
            await _dbContext.SaveChangesAsync();
            return true;
        }

        public virtual async Task<TProvided?> GetItemByIdAsync(Tkey id)
        {
            var entity = await _dbSet.FindAsync(id);
            return entity == null ? null : (TProvided)entity;
        }

        public virtual async Task<IEnumerable<TProvided>> GetItemsAsync(string? filter = null, string? orderBy = null, int? page = null, int? pageSize = null)
        {
            IQueryable<TEntity> query = _dbSet;

            if(!string.IsNullOrWhiteSpace(filter))
            {
                query = query.Where(filter);
            }    

            if(!string.IsNullOrWhiteSpace(orderBy))
            {
                query = query.OrderBy(orderBy);
            }

            if (page.HasValue && pageSize.HasValue)
            {
                query = query.Skip((page.Value - 1) * pageSize.Value).Take(pageSize.Value);
            }

            var list = await query.ToListAsync();
            return list.Cast<TProvided>();
        }

        public async Task<TProvided> InsertItemAsync(TRequired item)
        {
            var entity = MapToEntity(item);
            _dbSet.Add(entity);
            await _dbContext.SaveChangesAsync();
            return (TProvided)entity;
        }

        public async Task<TProvided?> UpdateItemAsync(Tkey id, TRequired item)
        {
            var entity = await _dbSet.FindAsync(id);
            if (entity == null) return null;

            entity = MapToEntity(item, entity);
            await _dbContext.SaveChangesAsync();
            return (TProvided)entity;
        }

        protected abstract TEntity MapToEntity(TRequired required, TEntity? entity = null);
    }
}
