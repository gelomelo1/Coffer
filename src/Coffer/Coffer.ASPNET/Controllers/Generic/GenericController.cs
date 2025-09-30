using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Update.Internal;

namespace Coffer.ASPNET.Controllers.Generic
{
    [ApiController]
    [Route("api/[controller]")]
    public class GenericController<TKey, TEntity, TProvied, TRequired> : ControllerBase
        where TKey : notnull
        where TEntity : class, TProvied
        where TProvied : class, IGenericEntity<TKey>
        where TRequired : class
    {
        protected readonly IGenericRepository<TKey, TEntity, TProvied, TRequired> _repository;

        public GenericController(IGenericRepository<TKey, TEntity, TProvied, TRequired> genericRepository)
        {
            _repository = genericRepository;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TProvied>>> Get([FromQuery] string? filter = null, [FromQuery] string? orderBy = null, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            var items = await _repository.GetItemsAsync(filter, orderBy, page, pageSize);
            return Ok(items);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TProvied>> GetById(TKey id)
        {
            var item = await _repository.GetItemByIdAsync(id);
            if(item == null) return NotFound();
            return Ok(item);
        }

        [HttpPost]
        public async Task<ActionResult<TProvied>> Create([FromBody] TRequired required)
        {
            var item = await _repository.InsertItemAsync(required);
            return CreatedAtAction(nameof(GetById), new { id = (item as dynamic).Id }, item);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TProvied>> Update(TKey id, [FromBody] TRequired required)
        {
            var item = await _repository.UpdateItemAsync(id, required);
            if(item == null) return NotFound();
            return Ok(item);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(TKey id)
        {
            var success = await _repository.DeleteItemAsync(id);
            if(!success) return NotFound();
            return NoContent();
        }
    }
}
