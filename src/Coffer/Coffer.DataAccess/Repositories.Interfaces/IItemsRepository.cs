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
        public Task<IEnumerable<ItemProvided>> GetFeedItemsAsync(User user, string? filter = null, string? orderBy = null, int? page = null, int? pageSize = null);
        public Task<IEnumerable<ItemProvided>> SearchItems(string? collectionTypeIds, string searchText);
        public Task<IEnumerable<ItemProvided>> GetItemsByCollectionAsync(Guid collectionId);
    }
}
