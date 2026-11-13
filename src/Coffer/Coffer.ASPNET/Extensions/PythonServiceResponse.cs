using System.Text.Json;

namespace Coffer.ASPNET.Extensions
{
    public static class PythonServiceResponse
    {
        /// <summary>
        /// The FastAPI service historically answers HTTP 200 with {"status": "error"} when something fails,
        /// so a successful status code alone does not mean the vector DB was updated. Both must be OK before a
        /// database transaction that depends on the call is committed.
        /// </summary>
        public static async Task<bool> IsOkAsync(HttpResponseMessage response)
        {
            if (!response.IsSuccessStatusCode)
                return false;

            try
            {
                var body = await response.Content.ReadAsStringAsync();
                using var json = JsonDocument.Parse(body);

                return json.RootElement.ValueKind == JsonValueKind.Object
                    && json.RootElement.TryGetProperty("status", out var status)
                    && status.ValueKind == JsonValueKind.String
                    && string.Equals(status.GetString(), "ok", StringComparison.OrdinalIgnoreCase);
            }
            catch (JsonException)
            {
                return false;
            }
        }
    }
}
