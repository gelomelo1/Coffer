using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static Coffer.ASPNET.Controllers.CollectionsController;
using static Coffer.ASPNET.Controllers.ItemsController;

namespace Coffer.ASPNET.Controllers
{

    [Route("api/[controller]")]
    public class CollectionsController : GenericController<Guid, CollectionProvided, CollectionProvided, CollectionRequired>
    {
        private readonly IItemsRepository _itemsRepository;
        private readonly IImageService _imageService;
        private readonly ICollectionsRepository _collectionsRepository;
        private readonly string imageFolder = 
            Path.Combine(Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set"), "collectioncovers");
        private readonly string itemImageFolder =
    Path.Combine(Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set"), "items");
        private readonly HttpClient _httpClient;
        public CollectionsController(ICollectionsRepository collectionsRepository, IItemsRepository itemsRepository, IImageService imageService, IPermissionService<Guid, CollectionRequired> permissionService, HttpClient httpClient) : base(collectionsRepository, permissionService)
        {
            _collectionsRepository = collectionsRepository;
            _imageService = imageService;
            _httpClient = httpClient;
            _itemsRepository = itemsRepository;
        }

        [Authorize]
        [HttpPost("CoverImage/Upload/{id}")]
        public async Task<IActionResult> UploadCoverImage(Guid id, IFormFile? file)
        {

            if(!UserId.HasValue)
            {
                return Unauthorized();
            }

            try
            {
                var collection = await _repository.GetItemByIdAsync(id);
                if (collection == null)
                    return BadRequest("No collection with given id");

                if(file == null)
                {

                    bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, id);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    if (!string.IsNullOrEmpty(collection.Image))
                    {
                        await _imageService.DeleteImageAsync(collection.Image, imageFolder);
                    }
                    collection.Image = null;
                }
                else
                {

                    bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, id, null);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    var fileName = await _imageService.SaveImageAsync(file, id, imageFolder);
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

        [Authorize]
        [HttpGet("CoverImage/{fileName}")]
        public async Task<IActionResult> GetCoverImage(string fileName)
        {

            try
            {
                var (bytes, contentType) = await _imageService.GetImageAsync(fileName, imageFolder);
                return File(bytes, contentType);
            }
            catch (FileNotFoundException)
            {
                return NotFound();
            }
        }

        [Authorize]
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

        public record ImageCheckResponse(Guid Id, string State, int Quantity, List<ItemProvided> Similars);

        public record ImageCheckResult(Guid Id, string State, int Quantity, List<Guid> Similars);

        public record ImageCheckPythonServiceResponse(string Status, List<ImageCheckResult> Response);

        [Authorize]
        [HttpPost("ImageCheck/{id}")]
        public async Task<ActionResult<IEnumerable<ImageCheckResponse>>> UploadImageCheckTest(Guid id, IFormFile file)
        {

            if (!UserId.HasValue)
            {
                return Unauthorized();
            }
            bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, id, null);
            if (!isPermissionGranted)
            {
                return Forbid();
            }

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
                var response = await _httpClient.PostAsync($"http://localhost:8000/image_check/{collectionTypeId}/{collectionId}", formData);

                response.EnsureSuccessStatusCode();

                var jsonString = await response.Content.ReadAsStringAsync();

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var imageCheckPythonServiceResponse = JsonSerializer.Deserialize<ImageCheckPythonServiceResponse>(jsonString, options);

                List<ImageCheckResult> results = imageCheckPythonServiceResponse?.Response ?? new List<ImageCheckResult>();

                List<ImageCheckResponse> imageCheckResponses = new List<ImageCheckResponse>();

                foreach (var result in results)
                {
                    List<ItemProvided> items = new List<ItemProvided>();
                    foreach(var similar in result.Similars)
                    {
                        var item = await _itemsRepository.GetItemByIdAsync(similar);
                        if (item != null)
                        {
                            items.Add(item);
                        }
                    }
                    imageCheckResponses.Add(new ImageCheckResponse(result.Id, result.State, result.Quantity, items));
                }

                return Ok(imageCheckResponses);
            }
            catch (HttpRequestException ex)
            {
                return BadRequest($"Error contacting Python API: {ex.Message}");
            }
        }

        public record ItemImage(
            byte[] Bytes,
            string ContentType,
            Guid id,
            string fileName
            );

        [Authorize]
        [HttpDelete("{id}")]
        public override async Task<ActionResult> Delete(Guid id)
        {

            if (!UserId.HasValue)
            {
                return Unauthorized();
            }
            bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, id);
            if (!isPermissionGranted)
            {
                return Forbid();
            }

            var collection = await _collectionsRepository.GetCollectionByIdForDelete(id);
            if (collection == null) return NotFound();

            (byte[] Bytes, string ContentType)? deletedCollectionImage = null;
            if (collection.Image != null)
            {
                deletedCollectionImage = await _imageService.GetImageAsync(collection.Image, imageFolder);
            }

            var items = await _itemsRepository.GetItemsByCollectionAsync(id);

            List<ItemImage> deletedItemImages = new List<ItemImage>();
            foreach(var item in items)
            {
                var deletedImage = await _imageService.GetImageAsync(item.Image, itemImageFolder);
                deletedItemImages.Add(new ItemImage(deletedImage.Bytes, deletedImage.ContentType, item.Id, item.Image));
            }

            using var transaction = await _collectionsRepository.BeginTransactionAsync();
            try
            {
                if (!string.IsNullOrEmpty(collection.Image))
                {
                    await _imageService.DeleteImageAsync(collection.Image, imageFolder);
                }

                foreach (var image in deletedItemImages)
                {
                    await _imageService.DeleteImageAsync(image.fileName, itemImageFolder);
                }

                await _repository.DeleteItemAsync(id);

                var response = await _httpClient.DeleteAsync($"http://localhost:8000/delete_collection_embeddings/{id}");

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Failed to delete embedding via FastAPI: {errorContent}");
                }

                await transaction.CommitAsync();
                return Ok();
            }
            catch(Exception ex)
            {
                await transaction.RollbackAsync();
                try
                {
                    if(deletedCollectionImage.HasValue)
                    {
                        await _imageService.SaveImageAsync(deletedCollectionImage.Value.Bytes, id, imageFolder, collection.Image);
                    }

                    foreach(var image in deletedItemImages)
                    {
                        await _imageService.SaveImageAsync(image.Bytes, image.id, itemImageFolder, image.fileName);
                    }
                }
                catch
                {

                }

                return StatusCode(500, $"Failed to delete item: {ex.Message}");
            }
        }
    }
}
