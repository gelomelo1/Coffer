using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class OffersController : GenericController<Guid, OfferProvided, OfferProvided, OfferRequired>
    {
        private readonly IOffersRepository _offersRepository;
        private readonly IOfferPermissionService _offerPermissionService;
        public OffersController(IOffersRepository repository, IOfferPermissionService permissionService) : base(repository, permissionService)
        {
            _offersRepository = repository;
            _offerPermissionService = permissionService;
        }

        public record OfferStatusChangeRequest
        {
            public string Status { get; set; }
        }

        [Authorize]
        [HttpPost("ChangeStatus/{id}")]
        public async Task<ActionResult<OfferProvided>> ChangeStatus(Guid id, [FromBody] OfferStatusChangeRequest request)
        {
            if (!UserId.HasValue)
            {
                return Unauthorized();
            }

            bool isPermissionGranted = await _offerPermissionService.CanChangeStatus(UserId.Value, id, request.Status);
            if (!isPermissionGranted)
            {
                return Forbid();
            }

            var entity = await _offersRepository.ChangeOfferStatus(id, request.Status);
            if(entity == null)
                return NotFound();

            return Ok(entity);
        }

        [Authorize]
        [HttpPut("{id}")]
        public override async Task<ActionResult<OfferProvided>> Update(Guid id, [FromBody] OfferRequired required)
        {
            if (!UserId.HasValue)
            {
                return Unauthorized();
            }

            bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, id, required);
            if (!isPermissionGranted)
            {
                return Forbid();
            }

            var item = await _offersRepository.UpdateOfferAsync(id, required);
            if (item == null) return NotFound();
            return Ok(item);
        }
    }
}
