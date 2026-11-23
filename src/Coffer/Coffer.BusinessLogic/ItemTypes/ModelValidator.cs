using System.Net.Http.Json;
using DotNetEnv;

namespace Coffer.BusinessLogic.ItemTypes
{
    public sealed record ModelValidation(bool Ok, string? Message);

    /// <summary>Asks the AI service whether it can load a model file that is waiting in MODELS_PATH.</summary>
    public interface IModelValidator
    {
        /// <param name="fileName">A file name in MODELS_PATH (e.g. "3_detection.pt.candidate").</param>
        /// <param name="kind">"detection" or "embedding".</param>
        Task<ModelValidation> ValidateAsync(string fileName, string kind, CancellationToken ct = default);
    }

    /// <summary>POST {FASTAPI_URL}/models/validate. An unreachable service counts as "cannot load": a model nobody
    /// checked is never published.</summary>
    public sealed class HttpModelValidator : IModelValidator
    {
        private readonly HttpClient _http;

        public HttpModelValidator(HttpClient http)
        {
            _http = http;
        }

        private static string PythonUrl => Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set");

        public async Task<ModelValidation> ValidateAsync(string fileName, string kind, CancellationToken ct = default)
        {
            try
            {
                var response = await _http.PostAsJsonAsync($"{PythonUrl}/models/validate", new { fileName, kind }, ct);
                if (response.IsSuccessStatusCode) return new ModelValidation(true, null);
                var body = await response.Content.ReadAsStringAsync(ct);
                return new ModelValidation(false, $"{(int)response.StatusCode}: {body}");
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or InvalidOperationException)
            {
                return new ModelValidation(false, e.Message);
            }
        }
    }
}
