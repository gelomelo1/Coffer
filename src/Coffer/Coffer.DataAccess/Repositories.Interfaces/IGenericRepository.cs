using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IGenericRepository<Tkey, TEntity, TProvided, TRequired>
    : IReadOnlyGenericRepository<Tkey, TEntity, TProvided>
    where Tkey : notnull
    where TEntity : class, TProvided
    where TProvided : class, IGenericEntity<Tkey>
    where TRequired : class
    {
        Task<TProvided> InsertItemAsync(TRequired item);
        Task<TProvided?> UpdateItemAsync(Tkey id, TRequired item);
        Task<bool> DeleteItemAsync(Tkey id);
    }
}
