using System.Net.Http;
using System.Net.Http.Headers;
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
        private readonly HttpClient _httpClient;
        private readonly string relativePath = "items";
        public ItemsController(IGenericRepository<Guid, ItemProvided, ItemProvided, ItemRequired> repository, IImageService imageService, HttpClient httpClient) : base(repository)
        {
            _imageService = imageService;
            _httpClient = httpClient;
        }

        [HttpPost("ImageCheck")]
        public async Task<IActionResult> UploadCoverImage(IFormFile file)
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
                var response = await _httpClient.PostAsync("http://localhost:8000/image_check", formData);

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
