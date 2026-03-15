using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Coffer.BusinessLogic.Services.Interfaces
{
    public interface IPermissionService<Tkey, TRequired>
        where Tkey : notnull
        where TRequired : class
    {
        Task<bool> CanCreate(Guid userId, TRequired data);
        Task<bool> CanUpdate(Guid userId, Tkey id, TRequired? data);
        Task<bool> CanDelete(Guid userId, Tkey id);
    }
}
