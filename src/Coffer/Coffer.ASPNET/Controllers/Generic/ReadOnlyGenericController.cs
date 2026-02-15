using Coffer.Domain.Entities.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Coffer.DataAccess.Repositories.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace Coffer.ASPNET.Controllers.Generic
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReadOnlyGenericController<TKey, TEntity, TProvided> : ControllerBase
    where TKey : notnull
    where TEntity : class, TProvided
    where TProvided : class, IGenericEntity<TKey>
    {
        protected readonly IReadOnlyGenericRepository<TKey, TEntity, TProvided> _repository;

        public ReadOnlyGenericController(IReadOnlyGenericRepository<TKey, TEntity, TProvided> repository)
        {
            _repository = repository;
        }

        [Authorize]
        [HttpGet]
        public virtual async Task<ActionResult<IEnumerable<TProvided>>> Get([FromQuery] string? filter = null,
                                                                            [FromQuery] string? orderBy = null,
                                                                            [FromQuery] int? page = null,
                                                                            [FromQuery] int? pageSize = null)
        {
            var items = await _repository.GetItemsAsync(filter, orderBy, page, pageSize);
            return Ok(items);
        }

        [Authorize]
        [HttpGet("{id}")]
        public virtual async Task<ActionResult<TProvided>> GetById(TKey id)
        {
            var item = await _repository.GetItemByIdAsync(id);
            if (item == null) return NotFound();
            return Ok(item);
        }
    }
}
