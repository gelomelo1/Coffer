using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class FollowsController : GenericController<Guid, FollowProvided, FollowProvided, FollowRequired>
    {
        public FollowsController(IGenericRepository<Guid, FollowProvided, FollowProvided, FollowRequired> repository) : base(repository)
        {
        }
    }
}
