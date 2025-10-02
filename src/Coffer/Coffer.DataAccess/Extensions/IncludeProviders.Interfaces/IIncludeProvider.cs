using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace Coffer.DataAccess.Extensions.IncludeProviders.Interfaces
{
    public interface IIncludeProvider<TEntity>
    {
        string[]? GetDefaultIncludes();
    }
}
