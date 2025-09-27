using System.Linq.Dynamic.Core;
using Coffer.ASPNET.Controllers.Generic;
using Coffer.ASPNET.Extensions;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class CollectionTypesController : GenericController<Guid, CollectionTypeProvided, CollectionTypeProvided, CollectionTypeRequired>
    {
        public CollectionTypesController(IGenericRepository<Guid, CollectionTypeProvided, CollectionTypeProvided, CollectionTypeRequired> genericRepository) : base(genericRepository)
        {
        }
    }
}
