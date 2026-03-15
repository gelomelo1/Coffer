using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class OffersController : GenericController<Guid, OfferProvided, OfferProvided, OfferRequired>
    {
        private readonly IOffersRepository _offersRepository;
        public OffersController(IOffersRepository repository, IPermissionService<Guid, OfferRequired> permissionService) : base(repository, permissionService)
        {
            _offersRepository = repository;
        }

        public record OfferStatusChangeRequest
        {
            public string Status { get; set; }
        }

        [HttpPost("ChangeStatus/{id}")]
        public async Task<ActionResult<OfferProvided>> ChangeStatus(Guid id, [FromBody] OfferStatusChangeRequest request)
        {
            var entity = await _offersRepository.ChangeOfferStatus(id, request.Status);
            if(entity == null)
                return NotFound();

            return Ok(entity);
        }

        [HttpPut("{id}")]
        public override async Task<ActionResult<OfferProvided>> Update(Guid id, [FromBody] OfferRequired required)
        {
            var item = await _offersRepository.UpdateOfferAsync(id, required);
            if (item == null) return NotFound();
            return Ok(item);
        }
    }
}
