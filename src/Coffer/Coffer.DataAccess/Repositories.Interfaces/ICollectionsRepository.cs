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
        public Task<IEnumerable<CollectionProvided>> SearchCollections(int collectionTypeId, string searchText);
        Task<IDbContextTransaction> BeginTransactionAsync();
        public Task<CollectionProvided?> GetCollectionByIdForDelete(Guid id);
    }
}
