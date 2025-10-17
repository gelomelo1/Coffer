using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class ReactionsController : GenericController<Guid, ReactionProvided, ReactionProvided, ReactionRequired>
    {
        public ReactionsController(IGenericRepository<Guid, ReactionProvided, ReactionProvided, ReactionRequired> repository) : base(repository)
        {
        }
    }
}
