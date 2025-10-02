using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Extensions.IncludeProviders
{
    public class ItemIncludeProvider : IIncludeProvider<ItemProvided>
    {
        public string[]? GetDefaultIncludes()
        {
            return new[]
            {
                "ItemAttributes.Attribute",
                "ItemTags"
            };
        }
    }
}
