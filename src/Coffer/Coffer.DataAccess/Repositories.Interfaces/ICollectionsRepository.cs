using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore.Storage;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface ICollectionsRepository : IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired>
    {
        public Task<Coffer.Domain.Paging.PagedList<CollectionProvided>> SearchCollectionsSmart(string? collectionTypeIds, string searchText, int? page, int? pageSize);
        public Task<IEnumerable<CollectionProvided>> SearchCollections(string? collectionTypeIds, string searchText);
        Task<IDbContextTransaction> BeginTransactionAsync();
        public Task<CollectionProvided?> GetCollectionByIdForDelete(Guid id);
        /// <summary>A user's collections ordered by type; types in <paramref name="byNameTypeIds"/> by name, the others newest first.</summary>
        public Task<Coffer.Domain.Paging.GroupedPagedList<CollectionProvided>> GetGroupedPageAsync(Guid userId, IReadOnlyCollection<int> byNameTypeIds, int? page, int? pageSize);
    }
}
