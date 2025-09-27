using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Components;

namespace Coffer.ASPNET.Controllers
{

    [Route("api/[controller]")]
    public class CollectionsController : GenericController<Guid, CollectionProvided, CollectionProvided, CollectionRequired>
    {
        public CollectionsController(IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired> genericRepository) : base(genericRepository)
        {
        }
    }
}
