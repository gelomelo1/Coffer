using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>What the API's callback found: the verified identity, or null when the sign-in failed or was denied.</summary>
    public sealed record PendingCallback(string State, ProviderIdentity? Identity);

    /// <summary>
    /// Results of sign-ins that come back to the API (Google), waiting for the app to collect them with its transaction
    /// id: 10 minutes, single use. Only the verified identity is kept — no provider token, and no Coffer session until the
    /// app collects it, so an abandoned sign-in leaves nothing behind.
    /// </summary>
    public sealed class PendingCallbackStore
    {
        public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
        private readonly IMemoryCache _cache;
        private readonly object _gate = new();

        public PendingCallbackStore(IMemoryCache cache) => _cache = cache;

        private static string Key(string transactionId) => $"oauth-callback:{transactionId}";

        public void Put(string transactionId, PendingCallback result) => _cache.Set(Key(transactionId), result, Lifetime);

        public PendingCallback? Take(string? transactionId)
        {
            if (string.IsNullOrEmpty(transactionId)) return null;
            lock (_gate)
            {
                if (!_cache.TryGetValue(Key(transactionId), out PendingCallback? result)) return null;
                _cache.Remove(Key(transactionId));
                return result;
            }
        }
    }
}
