namespace Coffer.ASPNET.Extensions
{
    /// <summary>
    /// Adds the shared INTERNAL_API_KEY header to requests going to the Python service (FASTAPI_URL) only,
    /// so the key never leaks to third-party hosts. When no key is configured nothing is added and the
    /// Python service keeps accepting unauthenticated calls (previous behaviour).
    /// </summary>
    public class InternalApiKeyHandler : DelegatingHandler
    {
        public const string HeaderName = "X-Internal-Api-Key";

        private readonly Uri? _pythonServiceUri;
        private readonly string? _apiKey;

        public InternalApiKeyHandler(string? pythonServiceUrl, string? apiKey)
        {
            _apiKey = string.IsNullOrWhiteSpace(apiKey) ? null : apiKey;
            if (!string.IsNullOrWhiteSpace(pythonServiceUrl) && Uri.TryCreate(pythonServiceUrl, UriKind.Absolute, out var uri))
                _pythonServiceUri = uri;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (_apiKey != null && _pythonServiceUri != null && request.RequestUri != null
                && Uri.Compare(request.RequestUri, _pythonServiceUri, UriComponents.SchemeAndServer, UriFormat.Unescaped, StringComparison.OrdinalIgnoreCase) == 0)
            {
                request.Headers.Remove(HeaderName);
                request.Headers.Add(HeaderName, _apiKey);
            }

            return base.SendAsync(request, cancellationToken);
        }
    }
}
