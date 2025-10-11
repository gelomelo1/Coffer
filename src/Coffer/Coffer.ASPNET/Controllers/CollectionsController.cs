using System.Net.Http;
using System.Net.Http.Headers;
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
        private readonly HttpClient _httpClient;
        public CollectionsController(IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired> genericRepository, IImageService imageService, HttpClient httpClient) : base(genericRepository)
        {
            _imageService = imageService;
            _httpClient = httpClient;
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

        [HttpPost("ImageCheck/Test")]
        public async Task<IActionResult> UploadImageCheckTest(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            using var formData = new MultipartFormDataContent();
            using var stream = file.OpenReadStream();
            using var streamContent = new StreamContent(stream);

            streamContent.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
            formData.Add(streamContent, "file", file.FileName);

            try
            {
                // Point to your Python FastAPI endpoint
                var response = await _httpClient.PostAsync("http://localhost:8000/image_check/test", formData);

                if (response.IsSuccessStatusCode)
                    return Ok(await response.Content.ReadAsStringAsync());

                var error = await response.Content.ReadAsStringAsync();
                return BadRequest($"Python API error: {error}");
            }
            catch (HttpRequestException ex)
            {
                return BadRequest($"Error contacting Python API: {ex.Message}");
            }
        }

        [HttpPost("ImageCheck/{id}")]
        public async Task<IActionResult> UploadImageCheckTest(Guid id, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var collection = await _repository.GetItemByIdAsync(id);

            if (collection == null)
                return BadRequest("No collection with given id");

            var collectionId = collection.Id;
            var collectionTypeId = collection.CollectionTypeId;

            using var formData = new MultipartFormDataContent();
            using var stream = file.OpenReadStream();
            using var streamContent = new StreamContent(stream);

            streamContent.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
            formData.Add(streamContent, "file", file.FileName);

            try
            {
                // Point to your Python FastAPI endpoint
                var response = await _httpClient.PostAsync($"http://localhost:8000/image_check/{collectionTypeId}/{collectionId}", formData);

                if (response.IsSuccessStatusCode)
                    return Ok(await response.Content.ReadAsStringAsync());

                var error = await response.Content.ReadAsStringAsync();
                return BadRequest($"Python API error: {error}");
            }
            catch (HttpRequestException ex)
            {
                return BadRequest($"Error contacting Python API: {ex.Message}");
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
