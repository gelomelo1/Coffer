using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.DataAccess.Repositories.Interfaces
{
        public interface IReadOnlyGenericRepository<Tkey, TEntity, TProvided>
            where Tkey : notnull
            where TEntity : TProvided
            where TProvided : class, IGenericEntity<Tkey>
        {
            Task<IEnumerable<TProvided>> GetItemsAsync(string? filter = null, string? orderBy = null, int? page = null, int? pageSize = null);
            Task<TProvided?> GetItemByIdAsync(Tkey id);
        }
}
