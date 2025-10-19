using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface ICollectionsRepository : IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired>
    {
        public Task<IEnumerable<CollectionProvided>> SearchCollections(int collectionTypeId, string searchText);
    }
}
