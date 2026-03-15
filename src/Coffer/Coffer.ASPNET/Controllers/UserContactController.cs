using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class UserContactController : GenericController<Guid, UserContactProvided, UserContactProvided, UserContactRequired>
    {
        public UserContactController(IGenericRepository<Guid, UserContactProvided, UserContactProvided, UserContactRequired> repository, IPermissionService<Guid, UserContactRequired> permissionService) : base(repository, permissionService)
        {
        }
    }
}
