using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Coffer.BusinessLogic.Community
{
    public interface IItemRemovalService
    {
        /// <summary>
        /// Deletes a collection item like its owner would: DB row (comments, reactions, … cascade) and its vector
        /// embedding now; the image file via <see cref="DeleteFileAsync"/> after the caller committed.
        /// </summary>
        Task<string?> RemoveAsync(Guid itemId);

        Task DeleteFileAsync(Guid itemId, string? fileName);
    }

    public sealed class ItemRemovalService : IItemRemovalService
    {
        private readonly CofferDbContext _db;
        private readonly IImageService _images;
        private readonly HttpClient _http;
        private readonly ILogger<ItemRemovalService> _log;

        public ItemRemovalService(CofferDbContext db, IImageService images, HttpClient http, ILogger<ItemRemovalService> log)
        {
            _db = db;
            _images = images;
            _http = http;
            _log = log;
        }

        private static string PythonUrl => Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set");

        public static string ItemFolder =>
            Path.Combine(Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set"), "items");

        public async Task<string?> RemoveAsync(Guid itemId)
        {
            var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
            if (item == null) return null;

            _db.Items.Remove(item);
            await _db.SaveChangesAsync();

            HttpResponseMessage response;
            try
            {
                response = await _http.DeleteAsync($"{PythonUrl}/delete_embeddings/{itemId}");
            }
            catch (HttpRequestException e)
            {
                _log.LogWarning("Could not reach the AI service to delete the embedding of item {ItemId}: {Error}", itemId, e.Message);
                throw MarketplaceException.Unavailable("The AI service is not reachable, so the item could not be removed. Try again later.");
            }
            // The Python service answers 200 with {"status":"error"} on failure.
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode || body.Contains("\"error\"", StringComparison.Ordinal))
                throw MarketplaceException.Unavailable("The AI service refused to delete the item's embedding. Try again later.");

            return item.Image;
        }

        public Task DeleteFileAsync(Guid itemId, string? fileName) => _images.DeleteOwnedImageAsync(fileName, itemId, ItemFolder);
    }
}
