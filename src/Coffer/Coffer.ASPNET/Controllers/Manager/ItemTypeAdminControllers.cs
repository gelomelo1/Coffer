using Coffer.BusinessLogic.ItemTypes;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Manager
{
    /// <summary>Item types (collection types) for Coffer.Manager administrators: names, colour, attributes.</summary>
    [Route("api/Admin/ItemTypes")]
    public class AdminItemTypesController : ManagerControllerBase
    {
        private readonly IItemTypeAdminService _types;

        public AdminItemTypesController(IItemTypeAdminService types)
        {
            _types = types;
        }

        [HttpGet]
        public async Task<ActionResult<List<AdminItemTypeDto>>> List() => Ok(await _types.ListAsync());

        [HttpGet("{id:int}")]
        public async Task<ActionResult<AdminItemTypeDto>> Get(int id) => Ok(await _types.GetAsync(id));

        [HttpPost]
        public async Task<ActionResult<AdminItemTypeDto>> Create([FromBody] ItemTypeInput input) => Ok(await _types.CreateAsync(AdminId, input));

        [HttpPut("{id:int}")]
        public async Task<ActionResult<AdminItemTypeDto>> Update(int id, [FromBody] ItemTypeInput input) => Ok(await _types.UpdateAsync(AdminId, id, input));

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _types.DeleteAsync(AdminId, id);
            return NoContent();
        }

        [HttpPost("{id:int}/Attributes")]
        public async Task<ActionResult<AdminAttributeDto>> AddAttribute(int id, [FromBody] AttributeInput input)
            => Ok(await _types.AddAttributeAsync(AdminId, id, input));
    }

    [Route("api/Admin/Attributes")]
    public class AdminAttributesController : ManagerControllerBase
    {
        private readonly IItemTypeAdminService _types;

        public AdminAttributesController(IItemTypeAdminService types)
        {
            _types = types;
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<AdminAttributeDto>> Update(int id, [FromBody] AttributeInput input)
            => Ok(await _types.UpdateAttributeAsync(AdminId, id, input));

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _types.DeleteAttributeAsync(AdminId, id);
            return NoContent();
        }
    }
}

namespace Coffer.ASPNET.Controllers.Manager
{
    /// <summary>Option sets: the lists select, multi-select and autocomplete attributes pick from.</summary>
    [Route("api/Admin/OptionSets")]
    public class AdminOptionSetsController : ManagerControllerBase
    {
        private readonly IOptionSetAdminService _sets;

        public AdminOptionSetsController(IOptionSetAdminService sets)
        {
            _sets = sets;
        }

        [HttpGet]
        public async Task<ActionResult<List<AdminOptionSetDto>>> List() => Ok(await _sets.ListAsync());

        [HttpPost]
        public async Task<ActionResult<AdminOptionSetDto>> Create([FromBody] OptionSetInput input) => Ok(await _sets.CreateAsync(AdminId, input));

        [HttpPut("{id:int}")]
        public async Task<ActionResult<AdminOptionSetDto>> Update(int id, [FromBody] OptionSetInput input) => Ok(await _sets.UpdateAsync(AdminId, id, input));

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _sets.DeleteAsync(AdminId, id);
            return NoContent();
        }
    }
}
