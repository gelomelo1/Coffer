using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore.Storage;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IItemsRepository : IGenericRepository<Guid, ItemProvided, ItemProvided, ItemRequired>
    {
        Task<IDbContextTransaction> BeginTransactionAsync();
        public Task<IEnumerable<ItemProvided>> GetFeedItemsAsync(User user);
        public Task<IEnumerable<ItemProvided>> SearchItems(int collectionTypeId, string searchText);
    }
}
