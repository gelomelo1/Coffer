using Coffer.ASPNET.Controllers.Generic;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Coffer.DataAccess.Repositories.Interfaces;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class CollectionTypesController : ReadOnlyGenericController<int, CollectionTypeProvided, CollectionTypeProvided>
    {
        public CollectionTypesController(IReadOnlyGenericRepository<int, CollectionTypeProvided, CollectionTypeProvided> genericRepository) : base(genericRepository)
        {
        }
    }
}
