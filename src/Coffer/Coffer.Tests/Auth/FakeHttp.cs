using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.Tests.Auth
{
    /// <summary>Stands in for a provider's HTTP endpoints; records every request (URL, headers, body).</summary>
    public sealed class FakeHttp : HttpMessageHandler
    {
        public sealed record Call(HttpMethod Method, Uri Url, string Body, string? Authorization, string? UserAgent);

        public List<Call> Calls { get; } = new();
        public Func<HttpRequestMessage, string, (HttpStatusCode Status, string Body)> Responder { get; set; } =
            (_, _) => (HttpStatusCode.NotFound, "{}");
        /// <summary>Optional per-request delay (honours cancellation), to simulate a slow provider.</summary>
        public Func<HttpRequestMessage, TimeSpan?> Delay { get; set; } = _ => null;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content == null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            if (Delay(request) is { } delay) await Task.Delay(delay, cancellationToken);
            Calls.Add(new Call(request.Method, request.RequestUri!, body, request.Headers.Authorization?.ToString(),
                request.Headers.UserAgent.ToString()));
            var (status, text) = Responder(request, body);
            return new HttpResponseMessage(status) { Content = new StringContent(text, Encoding.UTF8, "application/json") };
        }

        public int CallsTo(string urlStart) => Calls.Count(c => c.Url.ToString().StartsWith(urlStart, StringComparison.Ordinal));

        public static Dictionary<string, string> Form(string body) =>
            body.Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Split('=', 2))
                .ToDictionary(p => Uri.UnescapeDataString(p[0].Replace('+', ' ')), p => Uri.UnescapeDataString(p.Length > 1 ? p[1].Replace('+', ' ') : ""));
    }

    /// <summary>An RSA signing key with its JWKS, to mint ID tokens the way an OIDC provider would.</summary>
    public sealed class TestJwks
    {
        public RsaSecurityKey Key { get; }
        public string Kid { get; }

        public TestJwks(string kid)
        {
            Kid = kid;
            Key = new RsaSecurityKey(RSA.Create(2048)) { KeyId = kid };
        }

        public static string Json(params TestJwks[] keys)
        {
            var entries = keys.Select(k =>
            {
                var jwk = JsonWebKeyConverter.ConvertFromRSASecurityKey(k.Key);
                return $"{{\"kty\":\"RSA\",\"use\":\"sig\",\"alg\":\"RS256\",\"kid\":\"{k.Kid}\",\"n\":\"{jwk.N}\",\"e\":\"{jwk.E}\"}}";
            });
            return $"{{\"keys\":[{string.Join(",", entries)}]}}";
        }

        public string Sign(IDictionary<string, object> claims, DateTime? expires = null, DateTime? issuedAt = null)
        {
            var now = issuedAt ?? DateTime.UtcNow;
            return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
            {
                Claims = claims,
                IssuedAt = now,
                NotBefore = now,
                Expires = expires ?? now.AddHours(1),
                SigningCredentials = new SigningCredentials(Key, SecurityAlgorithms.RsaSha256),
            });
        }

        /// <summary>Algorithm confusion: an HS256 token whose HMAC secret is this key's public modulus.</summary>
        public string SignHs256WithPublicKey(IDictionary<string, object> claims)
        {
            var secret = JsonWebKeyConverter.ConvertFromRSASecurityKey(Key).N;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)) { KeyId = Kid };
            return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
            {
                Claims = claims,
                Expires = DateTime.UtcNow.AddHours(1),
                SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
            });
        }
    }

    /// <summary>Keeps every log line, to prove secrets never reach the log.</summary>
    public sealed class CapturingLoggerProvider : ILoggerProvider
    {
        public List<string> Lines { get; } = new();
        public ILogger CreateLogger(string categoryName) => new Logger(this);
        public void Dispose() { }

        private sealed class Logger : ILogger
        {
            private readonly CapturingLoggerProvider _owner;
            public Logger(CapturingLoggerProvider owner) => _owner = owner;
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                lock (_owner.Lines) _owner.Lines.Add(formatter(state, exception) + " " + exception);
            }
        }
    }
}
