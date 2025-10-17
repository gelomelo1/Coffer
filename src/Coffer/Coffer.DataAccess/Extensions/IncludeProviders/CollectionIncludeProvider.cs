using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Extensions.IncludeProviders
{
    public class CollectionIncludeProvider : IIncludeProvider<CollectionProvided>
    {
        public string[]? GetDefaultIncludes()
        {
            return new[]
            {
                "Follows"
            };
        }
    }
}
