using Coffer.BusinessLogic.Marketplace.Common;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using Coffer.ASPNET.Controllers.Generic;
using Coffer.ASPNET.Extensions;
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
        private readonly string pythonServiceUrl = Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set");
        private readonly HttpClient _httpClient;
        private readonly IWebHostEnvironment _environment;
        public CollectionsController(ICollectionsRepository collectionsRepository, IItemsRepository itemsRepository, IImageService imageService, IPermissionService<Guid, CollectionRequired> permissionService, HttpClient httpClient, IWebHostEnvironment environment) : base(collectionsRepository, permissionService)
        {
            _collectionsRepository = collectionsRepository;
            _imageService = imageService;
            _httpClient = httpClient;
            _itemsRepository = itemsRepository;
            _environment = environment;
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
                    return this.ApiError(StatusCodes.Status400BadRequest, "noCollectionWithGivenId", "No collection with given id");

                if(file == null)
                {

                    bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, id);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    await _imageService.DeleteOwnedImageAsync(collection.Image, collection.Id, imageFolder);
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
                return BadRequest(e is ArgumentException ? e.Message : "Failed to update cover image");
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
            // Debugging endpoint of the ML pipeline: not part of the app, not exposed outside development.
            if (!_environment.IsDevelopment())
                return NotFound();

            if (file == null || file.Length == 0)
                return this.ApiError(StatusCodes.Status400BadRequest, "noFileUploaded", "No file uploaded.");

            using var formData = new MultipartFormDataContent();
            using var stream = file.OpenReadStream();
            using var streamContent = new StreamContent(stream);

            streamContent.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
            formData.Add(streamContent, "file", file.FileName);

            try
            {
                // Point to your Python FastAPI endpoint
                var response = await _httpClient.PostAsync($"{pythonServiceUrl}/image_check/test", formData);

                if (response.IsSuccessStatusCode)
                    return Ok(await response.Content.ReadAsStringAsync());

                var error = await response.Content.ReadAsStringAsync();
                return this.ApiError(StatusCodes.Status400BadRequest, "pythonApiError", $"Python API error: {error}", ErrorArgs.Of($"{error}"));
            }
            catch (HttpRequestException ex)
            {
                return this.ApiError(StatusCodes.Status400BadRequest, "errorContactingPythonApi", $"Error contacting Python API: {ex.Message}", ErrorArgs.Of($"{ex.Message}"));
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
                return this.ApiError(StatusCodes.Status400BadRequest, "noFileUploaded", "No file uploaded.");

            var collection = await _repository.GetItemByIdAsync(id);

            if (collection == null)
                return this.ApiError(StatusCodes.Status400BadRequest, "noCollectionWithGivenId", "No collection with given id");

            var collectionId = collection.Id;
            var collectionTypeId = collection.CollectionTypeId;

            using var formData = new MultipartFormDataContent();
            using var stream = file.OpenReadStream();
            using var streamContent = new StreamContent(stream);

            streamContent.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
            formData.Add(streamContent, "file", file.FileName);

            try
            {
                var response = await _httpClient.PostAsync($"{pythonServiceUrl}/image_check/{collectionTypeId}/{collectionId}", formData);

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
                return this.ApiError(StatusCodes.Status400BadRequest, "errorContactingPythonApi", $"Error contacting Python API: {ex.Message}", ErrorArgs.Of($"{ex.Message}"));
            }
        }

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

            var items = (await _itemsRepository.GetItemsByCollectionAsync(id)).ToList();

            using (var transaction = await _collectionsRepository.BeginTransactionAsync())
            {
                try
                {
                    await _repository.DeleteItemAsync(id);

                    var response = await _httpClient.DeleteAsync($"{pythonServiceUrl}/delete_collection_embeddings/{id}");

                    if (!await PythonServiceResponse.IsOkAsync(response))
                    {
                        throw new Exception("Failed to delete embedding via FastAPI");
                    }

                    await transaction.CommitAsync();
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    Console.WriteLine($"Failed to delete collection {id}: {ex.Message}");
                    return this.ApiError(500, "failedToDeleteItem", "Failed to delete item");
                }
            }

            // Files cannot take part in the DB transaction, so they are only removed after a successful commit.
            await _imageService.DeleteOwnedImageAsync(collection.Image, collection.Id, imageFolder);
            foreach (var item in items)
            {
                await _imageService.DeleteOwnedImageAsync(item.Image, item.Id, itemImageFolder);
            }

            return Ok();
        }

        [Authorize]
        [HttpGet("ItemTags/{id}")]
        public async Task<ActionResult<IEnumerable<ItemTags>>> GetItemTagsForCollection(Guid id)
        {
            var items = await _itemsRepository.GetItemsByCollectionAsync(id);

            var tags = items
                .SelectMany(i => i.ItemTags)
                .GroupBy(t => t.Tag.ToLower())
                .Select(g => g.First())
                .ToList();

            Console.WriteLine($"ITEM COUNT: {items.Count()}");
            Console.WriteLine($"TAGS COUNT: {tags.Count()}");

            return Ok(tags);
        }
    }
}
