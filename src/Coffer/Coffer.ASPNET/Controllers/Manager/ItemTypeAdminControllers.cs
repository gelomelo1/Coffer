using Coffer.BusinessLogic.ItemTypes;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers.Manager
{
    /// <summary>Item types (collection types) for Coffer.Manager administrators: names, colour, attributes.</summary>
    [Route("api/Admin/ItemTypes")]
    public class AdminItemTypesController : ManagerControllerBase
    {
        /// <summary>Both model files plus form overhead (each file at most ItemTypeFiles.MaxModelBytes).</summary>
        private const long MaxModelsRequest = 2 * ItemTypeFiles.MaxModelBytes + 1_000_000;
        private const long MaxIconRequest = ItemTypeFiles.MaxIconBytes + 100_000;

        private readonly IItemTypeAdminService _types;
        private readonly IItemTypePublishing _publishing;

        public AdminItemTypesController(IItemTypeAdminService types, IItemTypePublishing publishing)
        {
            _types = types;
            _publishing = publishing;
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

        /// <summary>Multipart "file": PNG, JPEG or WebP; stored re-encoded as PNG.</summary>
        [HttpPost("{id:int}/Icon")]
        [RequestSizeLimit(MaxIconRequest)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxIconRequest)]
        public async Task<ActionResult<AdminItemTypeDto>> Icon(int id, IFormFile? file) => Ok(await _types.SetIconAsync(AdminId, id, file));

        /// <summary>Multipart "detection" and / or "embedding" (.pt) and "classCount" (required with the embedding model).</summary>
        [HttpPost("{id:int}/Models")]
        [RequestSizeLimit(MaxModelsRequest)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxModelsRequest)]
        public async Task<ActionResult<AdminItemTypeDto>> Models(int id, IFormFile? detection, IFormFile? embedding, [FromForm] int? classCount)
            => Ok(await _types.SetModelsAsync(AdminId, id, detection, embedding, classCount));

        /// <summary>The live model file ("detection" or "embedding"), for the Manager's comparison with a new model.</summary>
        [HttpGet("{id:int}/Models/{kind}")]
        public async Task<IActionResult> ModelFile(int id, string kind)
        {
            var path = await _types.ModelFileAsync(id, kind);
            return PhysicalFile(path, "application/octet-stream", Path.GetFileName(path));
        }

        [HttpPost("{id:int}/Publish")]
        public async Task<ActionResult<AdminItemTypeDto>> Publish(int id, [FromBody] PublishInput input)
            => Ok(await _publishing.SetPublishedAsync(AdminId, id, input.Published));
    }

    public sealed record PublishInput(bool Published);

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
