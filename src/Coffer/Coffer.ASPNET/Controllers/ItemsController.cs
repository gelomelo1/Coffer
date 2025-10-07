using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace Coffer.ASPNET.Controllers
{
    public class ItemsController : GenericController<Guid, ItemProvided, ItemProvided, ItemRequired>
    {
        private readonly IImageService _imageService;
        private readonly string relativePath = "items";
        public ItemsController(IGenericRepository<Guid, ItemProvided, ItemProvided, ItemRequired> repository, IImageService imageService) : base(repository)
        {
            _imageService = imageService;
        }

        //LEHET NEM KELL
        [HttpPost("CoverImage/Upload/{id}")]
        public async Task<IActionResult> UploadCoverImage(Guid id, IFormFile? file)
        {
            try
            {
                var item = await _repository.GetItemByIdAsync(id);
                if (item == null)
                    return BadRequest("No Item with given id");

                if(item.Image == null)

                if (file == null)
                {
                    return BadRequest("No Image was provided");
                }
                var fileName = await _imageService.SaveImageAsync(file, id, relativePath);
                item.Image = fileName;
                await _repository.UpdateItemAsync(id, item);
                return Ok(item);
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
                return BadRequest(e.Message);
            }
        }

        [HttpGet("CoverImage/{fileName}")]
        public async Task<IActionResult> GetCoverImage(string fileName)
        {
            try
            {
                var (bytes, contentType) = await _imageService.GetImageAsync(fileName, relativePath);
                return File(bytes, contentType);
            }
            catch (FileNotFoundException)
            {
                return NotFound();
            }
        }

        [HttpPut("{id}")]
        public override async Task<ActionResult<ItemProvided>> Update(Guid id, [FromBody] ItemRequired required)
        {
            Console.WriteLine("item update");
            if (required.Quantity == 0)
            {
                var collection = await _repository.GetItemByIdAsync(id);
                if (collection == null) return NotFound();

                if (!string.IsNullOrEmpty(collection.Image))
                    await _imageService.DeleteImageAsync(collection.Image, relativePath);

                return await base.Delete(id);
            }

            return await base.Update(id, required);
        }

        [HttpDelete("{id}")]
        public override async Task<ActionResult> Delete(Guid id)
        {
            var collection = await _repository.GetItemByIdAsync(id);
            if (collection == null) return NotFound();

            if (!string.IsNullOrEmpty(collection.Image))
                await _imageService.DeleteImageAsync(collection.Image, relativePath);

            return await base.Delete(id);
        }
    }
}
