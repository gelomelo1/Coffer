using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Coffer.Tests.Auth
{
    /// <summary>Shared helpers for the sign-in API tests.</summary>
    public static class SignInApi
    {
        public static async Task<JsonElement> Json(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        public static string? Str(this JsonElement e, string name) =>
            e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        public static async Task<HttpStatusCode> CurrentUserStatus(ApiFactory api, string accessToken)
        {
            var client = api.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            return (await client.GetAsync("api/auth/currentUser")).StatusCode;
        }
    }
}
