using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities.Interfaces;
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

        public GenericController(IGenericRepository<TKey, TEntity, TProvided, TRequired> repository)
            : base(repository)
        {
            _repository = repository;
        }

        [HttpPost]
        public virtual async Task<ActionResult<TProvided>> Create([FromBody] TRequired required)
        {
            var item = await _repository.InsertItemAsync(required);
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
        }

        [HttpPut("{id}")]
        public virtual async Task<ActionResult<TProvided>> Update(TKey id, [FromBody] TRequired required)
        {
            var item = await _repository.UpdateItemAsync(id, required);
            if (item == null) return NotFound();
            return Ok(item);
        }

        [HttpDelete("{id}")]
        public virtual async Task<ActionResult> Delete(TKey id)
        {
            var success = await _repository.DeleteItemAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
