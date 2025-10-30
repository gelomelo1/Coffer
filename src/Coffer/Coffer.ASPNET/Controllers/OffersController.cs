using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class OffersController : GenericController<Guid, OfferProvided, OfferProvided, OfferRequired>
    {
        private readonly IOffersRepository _offersRepository;
        public OffersController(IOffersRepository repository) : base(repository)
        {
            _offersRepository = repository;
        }

        [HttpPost("ChangeStatus/{id}")]
        public async Task<ActionResult<OfferProvided>> ChangeStatus(Guid id, [FromBody]string status)
        {
            var entity = await _offersRepository.ChangeOfferStatus(id, status);
            if(entity == null)
                return NotFound();

            return Ok(entity);
        }
    }
}
