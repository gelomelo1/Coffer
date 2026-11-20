using Coffer.BusinessLogic.Marketplace.Common;
using System.Net.Http;
using System.Net.Http.Headers;
using Coffer.ASPNET.Controllers.Generic;
using Coffer.ASPNET.Extensions;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class ItemsController : GenericController<Guid, ItemProvided, ItemProvided, ItemRequired>
    {
        private readonly IItemsRepository _itemsRepository;
        private readonly IUsersRepository _usersRepositry;
        private readonly IImageService _imageService;
        private readonly string imageFolder =
            Path.Combine(Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set"), "items");
        private readonly string tempFolder = Env.GetString("IMAGECHECK_TEMP_PATH") ?? throw new InvalidOperationException("IMAGECHECK_TEMP_PATH envionmental variable is not set");
        private readonly string pythonServiceUrl = Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set");
        private readonly HttpClient _httpClient;
        private readonly Coffer.BusinessLogic.Account.IContentTombstoneService _tombstones;
        private readonly Coffer.BusinessLogic.Activity.IActivityLog _activity;
        /// <summary>A page of items plus TotalQuantity: the pieces across every item matching the filter.</summary>
        public record ItemPage(List<ItemProvided> Items, int Page, int PageSize, int Total, int TotalQuantity);

        public override async Task<ActionResult<Coffer.Domain.Paging.PagedList<ItemProvided>>> GetPage([FromQuery] string? filter = null,
                                                                                                        [FromQuery] string? orderBy = null,
                                                                                                        [FromQuery] int? page = null,
                                                                                                        [FromQuery] int? pageSize = null)
        {
            if (!Coffer.DataAccess.Extensions.DynamicQueryGuard.IsAllowed(filter) || !Coffer.DataAccess.Extensions.DynamicQueryGuard.IsAllowed(orderBy))
                return this.ApiError(StatusCodes.Status400BadRequest, "filteringOrOrderingOnThisFieldIs", "Filtering or ordering on this field is not allowed");

            var result = await _itemsRepository.GetPageAsync(filter, orderBy, page, pageSize);
            var quantity = await _itemsRepository.SumQuantityAsync(filter);
            return Ok(new ItemPage(result.Items, result.Page, result.PageSize, result.Total, quantity));
        }

        public ItemsController(IItemsRepository repository, IUsersRepository usersRepository, IImageService imageService, IPermissionService<Guid, ItemRequired> permissionService, HttpClient httpClient, Coffer.BusinessLogic.Account.IContentTombstoneService tombstones, Coffer.BusinessLogic.Activity.IActivityLog activity) : base(repository, permissionService)
        {
            _activity = activity;
            _tombstones = tombstones;
            _itemsRepository = repository;
            _imageService = imageService;
            _httpClient = httpClient;
            _usersRepositry = usersRepository;
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
        [HttpPut("{id}")]
        public override async Task<ActionResult<ItemProvided>> Update(Guid id, [FromBody] ItemRequired required)
        {

            if (!UserId.HasValue)
            {
                return Unauthorized();
            }

            if (required.Quantity == 0)
            {
                // Same as an explicit delete: DB row, vector embedding and image file go together.
                return await Delete(id);
            }
            else
            {
                bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, id, null);
                if (!isPermissionGranted)
                {
                    return Forbid();
                }

                var result = await base.Update(id, required);
                if (result.Result is OkObjectResult)
                    await _activity.RecordNowAsync(UserId.Value, "item.edited", new Coffer.BusinessLogic.Activity.ActivityTargets(ItemId: id, CollectionId: required.CollectionId));
                return result;
            }
        }

        public record ItemIds(Guid TempId, Guid Id);
        public record InsertedItem(ItemIds ItemIds, ItemProvided ItemProvided);
        public record UpsertItemRequest(Guid Id, ItemRequired Item);

        [Authorize]
        [HttpPost("Upsert")]
        public async Task<ActionResult> Upsert([FromBody] UpsertItemRequest[] request)
        {

            if (!UserId.HasValue)
            {
                return Unauthorized();
            }

            if (request == null || request.Length == 0)
                return this.ApiError(StatusCodes.Status400BadRequest, "noItemsProvided", "No items provided.");

            List<string> savedImages = new();
            var collectionId = request[0].Item.CollectionId;

            using var transaction = await _itemsRepository.BeginTransactionAsync();
            try
            {
                List<InsertedItem> newItems = new();

                foreach (var upsertItem in request)
                {

                    var itemFound = await _repository.GetItemByIdAsync(upsertItem.Id);
                    if (itemFound == null)
                    {

                        bool isPermissionGranted = await _permissionService.CanCreate(UserId.Value, upsertItem.Item);
                        if (!isPermissionGranted)
                        {
                            return Forbid();
                        }

                        var newItem = await _repository.InsertItemAsync(upsertItem.Item);
                        // Saved with the image update below, inside this transaction.
                        _activity.Record(UserId.Value, "item.added", new Coffer.BusinessLogic.Activity.ActivityTargets(ItemId: newItem.Id, CollectionId: upsertItem.Item.CollectionId), new { quantity = upsertItem.Item.Quantity });
                        newItems.Add(new InsertedItem(new ItemIds(upsertItem.Id, newItem.Id), newItem));
                    }
                    else
                    {
                        bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, upsertItem.Id, upsertItem.Item);
                        if (!isPermissionGranted)
                        {
                            return Forbid();
                        }

                        _activity.Record(UserId.Value, "item.edited", new Coffer.BusinessLogic.Activity.ActivityTargets(ItemId: upsertItem.Id, CollectionId: upsertItem.Item.CollectionId));
                        await _repository.UpdateItemAsync(upsertItem.Id, upsertItem.Item);
                    }
                }

                if (newItems.Any())
                {
                    List<ItemIds> itemIds = new List<ItemIds>();
                    foreach (var item in newItems)
                    {
                        var image = await _imageService.CopyImageAsync(
                            item.ItemIds.Id,
                            Path.Combine(tempFolder, item.ItemIds.TempId.ToString()),
                            imageFolder
                        );
                        savedImages.Add(image);
                        item.ItemProvided.Image = image;
                        await _repository.UpdateItemAsync(item.ItemProvided.Id, item.ItemProvided);
                        itemIds.Add(item.ItemIds);
                    }


                    var response = await _httpClient.PostAsJsonAsync(
                        $"{pythonServiceUrl}/save_embeddings/{collectionId}",
                        itemIds
                    );

                    if (!await PythonServiceResponse.IsOkAsync(response))
                    {
                        await transaction.RollbackAsync();
                        foreach (var image in savedImages)
                        {
                            await _imageService.DeleteImageAsync(image, imageFolder);
                        }
                        return StatusCode(response.IsSuccessStatusCode ? StatusCodes.Status502BadGateway : (int)response.StatusCode, "Failed to notify Python service");
                    }
                }

                await transaction.CommitAsync();
                return Ok();
            }
            catch (Exception e)
            {
                await transaction.RollbackAsync();
                foreach (var image in savedImages)
                {
                    await _imageService.DeleteImageAsync(image, imageFolder);
                }
                return this.ApiError(500, "internalServerError", $"Internal server error\n{e.Message}", ErrorArgs.Of($"{e.Message}"));
            }
        }

        [Authorize]
        [HttpGet("TempImage/{fileName}")]
        public async Task<IActionResult> GetTempImage(string fileName)
        {
            try
            {
                var (bytes, contentType) = await _imageService.GetImageAsync(fileName, tempFolder);
                return File(bytes, contentType);
            }
            catch (FileNotFoundException)
            {
                return NotFound();
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

            var item = await _repository.GetItemByIdAsync(id);
            if (item == null)
                return NotFound();

            // Tombstone, not a hard delete: other users' comments, reactions and reports on the item stay linked.
            var cleanup = await _tombstones.TombstoneItemAsync(id);
            await _activity.RecordNowAsync(UserId.Value, "item.deleted", new Coffer.BusinessLogic.Activity.ActivityTargets(ItemId: id, CollectionId: item.CollectionId));
            await _tombstones.CleanupAsync(cleanup);

            return Ok();
        }
    }
}
