using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Update.Internal;

namespace Coffer.ASPNET.Controllers.Generic
{
    [ApiController]
    [Route("api/[controller]")]
    public class GenericController<TKey, TEntity, TProvided, TRequired>
        : ReadOnlyGenericController<TKey, TEntity, TProvided>
        where TKey : notnull
        where TEntity : class, TProvided
        where TProvided : class, IGenericEntity<TKey>
        where TRequired : class
    {
        protected new readonly IGenericRepository<TKey, TEntity, TProvided, TRequired> _repository;
        protected readonly IPermissionService<TKey, TRequired> _permissionService;

        public GenericController(IGenericRepository<TKey, TEntity, TProvided, TRequired> repository, IPermissionService<TKey, TRequired> permissionService)
            : base(repository)
        {
            _repository = repository;
            _permissionService = permissionService;
        }

        [Authorize]
        [HttpPost]
        public virtual async Task<ActionResult<TProvided>> Create([FromBody] TRequired required)
        {
            if(!UserId.HasValue)
            {
                return Unauthorized();
            }
            bool isPermissionGranted = await _permissionService.CanCreate(UserId.Value, required);
            if (!isPermissionGranted)
                 return Forbid();

            var item = await _repository.InsertItemAsync(required);
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
        }

        [Authorize]
        [HttpPut("{id}")]
        public virtual async Task<ActionResult<TProvided>> Update(TKey id, [FromBody] TRequired required)
        {
            if (!UserId.HasValue)
            {
                return Unauthorized(); ;
            }
            bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, id, required);
             if (!isPermissionGranted)
                 return Forbid();

            var item = await _repository.UpdateItemAsync(id, required);
            if (item == null) return NotFound();
            return Ok(item);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public virtual async Task<ActionResult> Delete(TKey id)
        {
            if (!UserId.HasValue)
            {
                return Unauthorized();
            }
            bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, id);
             if (!isPermissionGranted)
                 return Forbid();

            var success = await _repository.DeleteItemAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
