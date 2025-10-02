using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;

namespace Coffer.ASPNET.Controllers
{
    public class ItemsController : GenericController<Guid, ItemProvided, ItemProvided, ItemRequired>
    {
        public ItemsController(IGenericRepository<Guid, ItemProvided, ItemProvided, ItemRequired> repository) : base(repository)
        {
        }
    }
}
