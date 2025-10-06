using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class ItemOptionsController : ReadOnlyGenericController<int, ItemOptions, ItemOptions>
    {
        public ItemOptionsController(IReadOnlyGenericRepository<int, ItemOptions, ItemOptions> repository) : base(repository)
        {
        }
    }
}
