using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class OffersController : GenericController<Guid, OfferProvided, OfferProvided, OfferRequired>
    {
        public OffersController(IOffersRepository repository) : base(repository)
        {
        }
    }
}
