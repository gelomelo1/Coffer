using System.Net;
using Coffer.BusinessLogic.Auth.OAuth;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>Whatever goes wrong at the callback, the in-app browser is sent back to the app (never left on an error page).</summary>
    public class GoogleCallbackRobustnessTests : IDisposable
    {
        private sealed class ExplodingGoogle : IGoogleOAuthClient
        {
            public string AuthorizeUrl(OAuthTransaction transaction) => $"https://accounts.google.com/o/oauth2/v2/auth?state={transaction.State}";
            public Task<ProviderIdentity> CompleteAsync(OAuthTransaction transaction, string code) => throw new InvalidOperationException("unexpected");
        }

        private readonly ApiFactory _api = new();
        public void Dispose() => _api.Dispose();

        [Fact]
        public async Task An_unexpected_error_still_returns_to_the_app()
        {
            _api.Overrides = s => s.AddSingleton<IGoogleOAuthClient>(new ExplodingGoogle());
            var client = _api.CreateClient();
            var browser = _api.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
            var start = await SignInApi.Json(await client.PostAsync("api/auth/google/start", null));
            var state = FakeHttp.Form(new Uri(start.Str("authorizeUrl")!).Query.TrimStart('?'))["state"];

            var response = await browser.GetAsync($"api/auth/google/callback?state={Uri.EscapeDataString(state)}&code=x");

            Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
            Assert.Equal($"com.gelomelo.coffer://oauth/google?state={state}&error=failed", response.Headers.Location!.ToString());
        }
    }
}
