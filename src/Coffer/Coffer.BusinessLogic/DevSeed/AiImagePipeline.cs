using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DotNetEnv;

namespace Coffer.BusinessLogic.DevSeed
{
    /// <summary>
    /// The Python AI service seen from the seeder: the same calls the app makes when a user adds items
    /// (detect + crop + embed a raw photo, then store the embedding under the new item id).
    /// </summary>
    public interface IAiImagePipeline
    {
        Task<bool> IsAvailableAsync(CancellationToken ct = default);

        /// <summary>Runs object detection on a raw photo; returns the temp ids of the cropped objects (crop + embedding in the temp folder).</summary>
        Task<List<Guid>> DetectAsync(string rawImagePath, int collectionTypeId, Guid collectionId, CancellationToken ct = default);

        Task SaveEmbeddingsAsync(Guid collectionId, IEnumerable<(Guid TempId, Guid ItemId)> items, CancellationToken ct = default);

        Task DeleteCollectionEmbeddingsAsync(Guid collectionId, CancellationToken ct = default);
    }

    public sealed class AiImagePipeline : IAiImagePipeline
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly HttpClient _http;

        public AiImagePipeline(HttpClient http)
        {
            _http = http;
        }

        private static string Url => (Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set")).TrimEnd('/');

        public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
        {
            try
            {
                using var response = await _http.GetAsync($"{Url}/hello", ct);
                return response.IsSuccessStatusCode;
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
            {
                return false;
            }
        }

        public async Task<List<Guid>> DetectAsync(string rawImagePath, int collectionTypeId, Guid collectionId, CancellationToken ct = default)
        {
            await using var stream = File.OpenRead(rawImagePath);
            using var form = new MultipartFormDataContent();
            var content = new StreamContent(stream);
            content.Headers.ContentType = new MediaTypeHeaderValue(Path.GetExtension(rawImagePath).ToLowerInvariant() == ".png" ? "image/png" : "image/jpeg");
            form.Add(content, "file", Path.GetFileName(rawImagePath));

            using var response = await _http.PostAsync($"{Url}/image_check/{collectionTypeId}/{collectionId}", form, ct);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json, ct);
            if (body.TryGetProperty("status", out var status) && status.GetString() != "ok")
                throw new InvalidOperationException(body.TryGetProperty("message", out var m) ? m.GetString() : "AI service error");
            return body.GetProperty("response").EnumerateArray().Select(r => Guid.Parse(r.GetProperty("id").GetString()!)).ToList();
        }

        public async Task SaveEmbeddingsAsync(Guid collectionId, IEnumerable<(Guid TempId, Guid ItemId)> items, CancellationToken ct = default)
        {
            var payload = items.Select(i => new { tempId = i.TempId, id = i.ItemId }).ToList();
            if (payload.Count == 0) return;
            using var response = await _http.PostAsJsonAsync($"{Url}/save_embeddings/{collectionId}", payload, Json, ct);
            await EnsureOkAsync(response, ct);
        }

        public async Task DeleteCollectionEmbeddingsAsync(Guid collectionId, CancellationToken ct = default)
        {
            using var response = await _http.DeleteAsync($"{Url}/delete_collection_embeddings/{collectionId}", ct);
            await EnsureOkAsync(response, ct);
        }

        private static async Task EnsureOkAsync(HttpResponseMessage response, CancellationToken ct)
        {
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadAsStringAsync(ct);
            if (body.Contains("\"error\"", StringComparison.Ordinal)) throw new InvalidOperationException($"AI service error: {body}");
        }
    }
}
