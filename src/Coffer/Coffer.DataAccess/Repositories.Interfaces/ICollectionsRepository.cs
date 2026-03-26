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
        public Task<IEnumerable<CollectionProvided>> SearchCollectionsSmart(string? collectionTypeIds, string searchText);
        public Task<IEnumerable<CollectionProvided>> SearchCollections(string? collectionTypeIds, string searchText);
        Task<IDbContextTransaction> BeginTransactionAsync();
        public Task<CollectionProvided?> GetCollectionByIdForDelete(Guid id);
    }
}
