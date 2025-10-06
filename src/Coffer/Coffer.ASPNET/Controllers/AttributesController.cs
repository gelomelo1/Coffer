
using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class AttributesController : ReadOnlyGenericController<int, Attribute, Attribute>
    {
        public AttributesController(IReadOnlyGenericRepository<int, Attribute, Attribute> repository) : base(repository)
        {
        }
    }
}
