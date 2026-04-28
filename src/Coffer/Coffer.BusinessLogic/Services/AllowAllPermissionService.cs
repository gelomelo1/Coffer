using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;

namespace Coffer.BusinessLogic.Services
{
    public class AllowAllPermissionService<Tkey, TRequired> : IPermissionService<Tkey, TRequired>
        where Tkey : notnull
        where TRequired : class
    {
        Task<bool> IPermissionService<Tkey, TRequired>.CanCreate(Guid userId, TRequired data)
        {
            return Task.FromResult(true);
        }

        Task<bool> IPermissionService<Tkey, TRequired>.CanDelete(Guid userId, Tkey id)
        {
            return Task.FromResult(true);
        }

        Task<bool> IPermissionService<Tkey, TRequired>.CanUpdate(Guid userId, Tkey id, TRequired data)
        {
            return Task.FromResult(true);
        }
    }
}
