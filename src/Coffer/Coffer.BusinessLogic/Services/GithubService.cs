using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;

namespace Coffer.BusinessLogic.Services
{
    public class GithubService : IGithubService
    {
        public async Task<string> ExchangeCodeForToken(string code, string codeVerifier)
        {
            using var client = new HttpClient();
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        {"client_id", "Ov23liTJaxWIA5j85V7M"},
        {"client_secret", "b2359453f042db8ec7211c63275a44fa5190eeaf"},
        {"code", code},
        {"code_verifier", codeVerifier }
    });

            client.DefaultRequestHeaders.Add("Accept", "application/json");
            var response = await client.PostAsync("https://github.com/login/oauth/access_token", content);
            var raw = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"GitHub token exchange raw response: {raw}");
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
            return (result["access_token"]);
        }

        public async Task<(string Id, string Email, string Name, string? AvatarUrl)> GetGithubUser(string accessToken)
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", accessToken);

            // GitHub requires User-Agent header
            client.DefaultRequestHeaders.Add("User-Agent", "CofferApp");

            // Get basic user info
            var response = await client.GetAsync("https://api.github.com/user");
            response.EnsureSuccessStatusCode();

            var user = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
            string email = "";

            // If email is null, fetch primary email
            if (user.ContainsKey("email") && user["email"] != null)
            {
                email = user["email"].ToString();
            }
            else
            {
                // Some users don't have public email, fetch via /user/emails
                var emailResponse = await client.GetAsync("https://api.github.com/user/emails");
                emailResponse.EnsureSuccessStatusCode();
                var emails = await emailResponse.Content.ReadFromJsonAsync<List<Dictionary<string, object>>>();
                var primary = emails.FirstOrDefault(e =>
                {
                    var primaryValue = ((JsonElement)e["primary"]).GetBoolean();
                    var verifiedValue = ((JsonElement)e["verified"]).GetBoolean();
                    return primaryValue && verifiedValue;
                });
                if (primary != null)
                {
                    email = ((JsonElement)primary["email"]).GetString();
                }
            }

            string? avatarUrl = null;
            if (user.ContainsKey("avatar_url") && user["avatar_url"] != null)
            {
                avatarUrl = user["avatar_url"].ToString();
            }

            return (user["id"].ToString(), email, user["login"].ToString(), avatarUrl);
        }
    }
}
