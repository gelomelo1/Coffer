using Coffer.DataAccess.Extensions;
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

        /// <summary>Unpublished item types don't exist for the app.</summary>
        protected override IQueryable<CollectionTypeProvided> Visible(IQueryable<CollectionTypeProvided> query) => Live(query).WherePublished();
    }
}
