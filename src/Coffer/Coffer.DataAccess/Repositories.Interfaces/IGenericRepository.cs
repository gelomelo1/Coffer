using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IGenericRepository<Tkey, TEntity, TProvided, TRequired>
        where Tkey : notnull
        where TEntity : TProvided
        where TProvided : class, IGenericEntity<Tkey>
        where TRequired : class
    {
        Task<IEnumerable<TProvided>> GetItemsAsync(string? filter = null, string? orderBy = null, int? page = null, int? pageSize = null);
        Task<TProvided?> GetItemByIdAsync(Tkey id);
        Task<TProvided> InsertItemAsync(TRequired item);
        Task<TProvided?> UpdateItemAsync(Tkey id, TRequired item);
        Task<bool> DeleteItemAsync(Tkey id);
    }
}
