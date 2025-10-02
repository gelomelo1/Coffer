using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class CollectionTypesRepository : ReadOnlyGenericRepository<int, CollectionTypeProvided, CollectionTypeProvided>
    {
        public CollectionTypesRepository(CofferDbContext dbContext, IIncludeProvider<CollectionTypeProvided> includeProvider) : base(dbContext, includeProvider)
        {
        }
    }
}
