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
        public Task<Coffer.Domain.Paging.PagedList<ItemProvided>> SearchItemsSmart(string? collectionTypeIds, string searchText, int? page, int? pageSize);
        public Task<IDbContextTransaction> BeginTransactionAsync();
        /// <summary>Other people's items from the last week, followed collections and the same country first, newest next.</summary>
        /// <summary>Sum of Quantity over the items matching the (dynamic) filter.</summary>
        public Task<int> SumQuantityAsync(string? filter);
        public Task<Coffer.Domain.Paging.PagedList<ItemProvided>> GetFeedPageAsync(User user, string? filter, int? page, int? pageSize);
        public Task<IEnumerable<ItemProvided>> SearchItems(string? collectionTypeIds, string searchText);
        public Task<IEnumerable<ItemProvided>> GetItemsByCollectionAsync(Guid collectionId);
    }
}
