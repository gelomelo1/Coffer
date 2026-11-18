using Coffer.ASPNET.Extensions;
using Coffer.Domain.Entities.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Coffer.DataAccess.Extensions;
using Coffer.DataAccess.Repositories.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace Coffer.ASPNET.Controllers.Generic
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReadOnlyGenericController<TKey, TEntity, TProvided> : BaseController
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
            if (!DynamicQueryGuard.IsAllowed(filter) || !DynamicQueryGuard.IsAllowed(orderBy))
                return this.ApiError(StatusCodes.Status400BadRequest, "filteringOrOrderingOnThisFieldIs", "Filtering or ordering on this field is not allowed");

            var items = await _repository.GetItemsAsync(filter, orderBy, page, pageSize);
            return Ok(items);
        }

        /// <summary>One page of the filtered list plus the total for that filter (20 per page by default, at most 50).</summary>
        [Authorize]
        [HttpGet("Page")]
        public virtual async Task<ActionResult<Coffer.Domain.Paging.PagedList<TProvided>>> GetPage([FromQuery] string? filter = null,
                                                                                                    [FromQuery] string? orderBy = null,
                                                                                                    [FromQuery] int? page = null,
                                                                                                    [FromQuery] int? pageSize = null)
        {
            if (!DynamicQueryGuard.IsAllowed(filter) || !DynamicQueryGuard.IsAllowed(orderBy))
                return this.ApiError(StatusCodes.Status400BadRequest, "filteringOrOrderingOnThisFieldIs", "Filtering or ordering on this field is not allowed");

            return Ok(await _repository.GetPageAsync(filter, orderBy, page, pageSize));
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
