using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>
    /// A verified identity that has no Coffer account yet, waiting while the person picks a username (10 minutes).
    /// Only the verified identity is kept, never a provider token. The id is unguessable and single use.
    /// </summary>
    public sealed class PendingRegistrationStore
    {
        public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
        private readonly IMemoryCache _cache;
        private readonly object _gate = new();

        public PendingRegistrationStore(IMemoryCache cache) => _cache = cache;

        private static string Key(string id) => $"pending-registration:{id}";

        public string Put(ProviderIdentity identity)
        {
            var id = SecureRandom.Token();
            _cache.Set(Key(id), identity, Lifetime);
            return id;
        }

        /// <summary>The identity, if the id is still pending, without consuming it.</summary>
        public ProviderIdentity? Peek(string? id) =>
            !string.IsNullOrEmpty(id) && _cache.TryGetValue(Key(id), out ProviderIdentity? identity) ? identity : null;

        /// <summary>Gets and removes the identity in one step: two calls with the same id never both succeed.</summary>
        public ProviderIdentity? Take(string? id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            lock (_gate)
            {
                if (!_cache.TryGetValue(Key(id), out ProviderIdentity? identity)) return null;
                _cache.Remove(Key(id));
                return identity;
            }
        }
    }
}
