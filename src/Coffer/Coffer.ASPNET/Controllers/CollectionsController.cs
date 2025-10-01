using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{

    [Route("api/[controller]")]
    public class CollectionsController : GenericController<Guid, CollectionProvided, CollectionProvided, CollectionRequired>
    {
        private readonly IImageService _imageService;
        private readonly string relativePath = "collectioncovers";
        public CollectionsController(IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired> genericRepository, IImageService imageService) : base(genericRepository)
        {
            _imageService = imageService;
        }

        [HttpPost("CoverImage/Upload/{id}")]
        public async Task<IActionResult> UploadCoverImage(Guid id, IFormFile? file)
        {
            try
            {
                var collection = await _repository.GetItemByIdAsync(id);
                if (collection == null)
                    return BadRequest("No collection with given id");

                if(file == null)
                {
                    if(!string.IsNullOrEmpty(collection.Image))
                    {
                        await _imageService.DeleteImageAsync(collection.Image, relativePath);
                    }
                    collection.Image = null;
                }
                else
                {
                    var fileName = await _imageService.SaveImageAsync(file, id, relativePath);
                    collection.Image = fileName;
                }
                await _repository.UpdateItemAsync(id, collection);
                return Ok(collection);
            }
            catch(Exception e)
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
