using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.Tests.Auth
{
    /// <summary>Shared steps of the backend-held browser sign-ins (start → provider page → complete).</summary>
    public abstract class BrowserSignInTestBase : IDisposable
    {
        protected readonly ApiFactory Api = new();
        protected readonly FakeHttp Http = new();
        protected readonly CapturingLoggerProvider Logs = new();
        protected HttpClient Client = null!;

        /// <summary>"discord" or "github" (the api/auth/{provider}/… path).</summary>
        protected abstract string Provider { get; }

        /// <summary>Called by the subclass constructor after it set up its fakes.</summary>
        protected void Init(Action<IServiceCollection> overrides)
        {
            Api.Overrides = services =>
            {
                overrides(services);
                services.AddSingleton<Microsoft.Extensions.Logging.ILoggerProvider>(Logs);
            };
            Client = Api.CreateClient();
        }

        public void Dispose() => Api.Dispose();

        protected sealed record Started(string Id, Dictionary<string, string> Query, Uri Url, string RedirectUri)
        {
            public string State => Query["state"];
        }

        protected async Task<Started> Start()
        {
            var response = await Client.PostAsync($"api/auth/{Provider}/start", null);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await SignInApi.Json(response);
            var url = new Uri(body.Str("authorizeUrl")!);
            return new Started(body.Str("transactionId")!, FakeHttp.Form(url.Query.TrimStart('?')), url, body.Str("redirectUri")!);
        }

        protected Task<HttpResponseMessage> Complete(Started s, string? state = null, string? transactionId = null, string code = "the-code") =>
            Client.PostAsJsonAsync($"api/auth/{Provider}/complete", new { transactionId = transactionId ?? s.Id, code, state = state ?? s.State });

        protected async Task<HttpResponseMessage> StartAndComplete() => await Complete(await Start());

        protected async Task AssertFailed(HttpResponseMessage response)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("providerSignInFailed", (await SignInApi.Json(response)).Str("code"));
            Assert.Empty(Api.Db.NewContext().AuthSessions);
        }

        /// <summary>Nothing secret may reach the log, whatever went wrong.</summary>
        protected void AssertLogHasNo(params string[] secrets)
        {
            var log = string.Join("\n", Logs.Lines);
            Assert.Contains($"{Provider} sign-in failed", log, StringComparison.OrdinalIgnoreCase);
            foreach (var secret in secrets) Assert.DoesNotContain(secret, log);
        }

        protected static string S256(string verifier) => Base64UrlEncoder.Encode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
    }
}
