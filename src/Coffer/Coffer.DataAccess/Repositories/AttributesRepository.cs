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
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.DataAccess.Repositories
{
    public class AttributesRepository : ReadOnlyGenericRepository<int, Attribute, Attribute>
    {
        public AttributesRepository(CofferDbContext dbContext, IIncludeProvider<Attribute>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }
    }
}
