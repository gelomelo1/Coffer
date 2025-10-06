using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class ItemOptionsRepository : ReadOnlyGenericRepository<int, ItemOptions, ItemOptions>
    {
        public ItemOptionsRepository(CofferDbContext dbContext, IIncludeProvider<ItemOptions>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }
    }
}
