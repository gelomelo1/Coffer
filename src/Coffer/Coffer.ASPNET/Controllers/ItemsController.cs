using System.Net.Http;
using System.Net.Http.Headers;
using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class ItemsController : GenericController<Guid, ItemProvided, ItemProvided, ItemRequired>
    {
        private readonly IItemsRepository _itemsRepository;
        private readonly IImageService _imageService;
        private readonly string imageFolder =
            Path.Combine(Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set"), "items");
        private readonly string tempFolder = Env.GetString("IMAGECHECK_TEMP_PATH") ?? throw new InvalidOperationException("IMAGECHECK_TEMP_PATH envionmental variable is not set");
        private readonly HttpClient _httpClient;
        public ItemsController(IItemsRepository repository, IImageService imageService, HttpClient httpClient) : base(repository)
        {
            _itemsRepository = repository;
            _imageService = imageService;
            _httpClient = httpClient;
        }

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

        [HttpPut("{id}")]
        public override async Task<ActionResult<ItemProvided>> Update(Guid id, [FromBody] ItemRequired required)
        {
            if (required.Quantity == 0)
            {
                var item = await _repository.GetItemByIdAsync(id);
                if (item == null) return NotFound();

                if (!string.IsNullOrEmpty(item.Image))
                    await _imageService.DeleteImageAsync(item.Image, imageFolder);

                return await base.Delete(id);
            }

            return await base.Update(id, required);
        }

        public record ItemIds(Guid TempId, Guid Id);
        public record InsertedItem(ItemIds ItemIds, ItemProvided ItemProvided);
        public record UpsertItemRequest(Guid Id, ItemRequired Item);

        [HttpPost("Upsert")]
        public async Task<ActionResult> Upsert([FromBody] UpsertItemRequest[] request)
        {
            if (request == null || request.Length == 0)
                return BadRequest("No items provided.");

            List<string> savedImages = new();
            var collectionId = request[0].Item.CollectionId; // Use first item's collection

            using var transaction = await _itemsRepository.BeginTransactionAsync();
            try
            {
                List<InsertedItem> newItems = new();

                foreach (var upsertItem in request)
                {
                    var itemFound = await _repository.GetItemByIdAsync(upsertItem.Id);
                    if (itemFound == null)
                    {
                        var newItem = await _repository.InsertItemAsync(upsertItem.Item);
                        newItems.Add(new InsertedItem(new ItemIds(upsertItem.Id, newItem.Id), newItem));
                    }
                    else
                    {
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
                        $"http://localhost:8000/save_embeddings/{collectionId}",
                        itemIds
                    );

                    if (!response.IsSuccessStatusCode)
                    {
                        await transaction.RollbackAsync();
                        foreach (var image in savedImages)
                        {
                            await _imageService.DeleteImageAsync(image, imageFolder);
                        }
                        return StatusCode((int)response.StatusCode, "Failed to notify Python service");
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
                return StatusCode(500, $"Internal server error\n{e.Message}");
            }
        }

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

        [HttpDelete("{id}")]
        public override async Task<ActionResult> Delete(Guid id)
        {
            var item = await _repository.GetItemByIdAsync(id);
            if (item == null)
                return NotFound();

            var deletedImage = await _imageService.GetImageAsync(item.Image, imageFolder);

            using var transaction = await _itemsRepository.BeginTransactionAsync();
            try
            {
                if (!string.IsNullOrEmpty(item.Image))
                {
                    await _imageService.DeleteImageAsync(item.Image, imageFolder);
                }

                await _repository.DeleteItemAsync(id);

                var response = await _httpClient.DeleteAsync($"http://localhost:8000/delete_embeddings/{id}");

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Failed to delete embedding via FastAPI: {errorContent}");
                }

                await transaction.CommitAsync();
                return Ok();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                    try
                    {
                    await _imageService.SaveImageAsync(deletedImage.Bytes, id, imageFolder, item.Image);
                    }
                    catch
                    {
                        // Log error if restore fails, but don't mask original exception
                    }

                return StatusCode(500, $"Failed to delete item: {ex.Message}");
            }
        }
    }
}
