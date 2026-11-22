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
        private readonly Coffer.BusinessLogic.Account.IContentTombstoneService _tombstones;
        private readonly Coffer.BusinessLogic.Pending.IPendingItemService _pending;
        private readonly Coffer.BusinessLogic.Activity.IActivityLog _activity;
        private readonly IWebHostEnvironment _environment;
        private readonly Coffer.BusinessLogic.ItemTypes.IItemTypeVisibility _visibility;
        public CollectionsController(ICollectionsRepository collectionsRepository, IItemsRepository itemsRepository, IImageService imageService, IPermissionService<Guid, CollectionRequired> permissionService, HttpClient httpClient, IWebHostEnvironment environment, Coffer.BusinessLogic.Account.IContentTombstoneService tombstones, Coffer.BusinessLogic.Pending.IPendingItemService pending, Coffer.BusinessLogic.Activity.IActivityLog activity,
            Coffer.BusinessLogic.ItemTypes.IItemTypeVisibility visibility) : base(collectionsRepository, permissionService)
        {
            _visibility = visibility;
            _activity = activity;
            _pending = pending;
            _tombstones = tombstones;
            _collectionsRepository = collectionsRepository;
            _imageService = imageService;
            _httpClient = httpClient;
            _itemsRepository = itemsRepository;
            _environment = environment;
        }

        [Authorize]
        /// <summary>
        /// A user's collections a page at a time, ordered by collection type so the app can show them grouped;
        /// byName lists the type ids sorted by name (e.g. "1,3"), other types are newest first.
        /// </summary>
        [Authorize]
        [HttpGet("Grouped")]
        public async Task<ActionResult<Coffer.Domain.Paging.GroupedPagedList<CollectionProvided>>> Grouped([FromQuery] Guid userId, [FromQuery] string? byName = null,
                                                                                                      [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            var byNameIds = (byName ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => int.TryParse(x, out var id) ? id : (int?)null).Where(x => x.HasValue).Select(x => x!.Value).ToList();
            return Ok(await _collectionsRepository.GetGroupedPageAsync(userId, byNameIds, page, pageSize));
        }

        public override async Task<ActionResult<CollectionProvided>> Create([FromBody] CollectionRequired required)
        {
            await _visibility.EnsureTypeAsync(required.CollectionTypeId);
            var result = await base.Create(required);
            if (result.Result is CreatedAtActionResult { Value: CollectionProvided created })
                await _activity.RecordNowAsync(UserId!.Value, "collection.created", new Coffer.BusinessLogic.Activity.ActivityTargets(CollectionId: created.Id));
            return result;
        }

        public override async Task<ActionResult<CollectionProvided>> Update(Guid id, [FromBody] CollectionRequired required)
        {
            await _visibility.EnsureTypeAsync(required.CollectionTypeId);
            var result = await base.Update(id, required);
            if (result.Result is OkObjectResult)
                await _activity.RecordNowAsync(UserId!.Value, "collection.edited", new Coffer.BusinessLogic.Activity.ActivityTargets(CollectionId: id));
            return result;
        }

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
                await _activity.RecordNowAsync(UserId.Value, "collection.edited", new Coffer.BusinessLogic.Activity.ActivityTargets(CollectionId: id));
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
        public async Task<ActionResult<Coffer.BusinessLogic.Pending.ImageCheckResultDto>> UploadImageCheck(Guid id, IFormFile file)
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

            try
            {
                // Every detected cap goes onto the collection's waiting-for-review list (files moved out of temp).
                return Ok(await _pending.CreateFromImageAsync(UserId.Value, collection, file));
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

            // Tombstones, not a hard delete: other users' comments, reactions and reports on its items stay linked.
            var cleanup = await _tombstones.TombstoneCollectionAsync(id);
            await _activity.RecordNowAsync(UserId.Value, "collection.deleted", new Coffer.BusinessLogic.Activity.ActivityTargets(CollectionId: id));
            await _tombstones.CleanupAsync(cleanup);

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
