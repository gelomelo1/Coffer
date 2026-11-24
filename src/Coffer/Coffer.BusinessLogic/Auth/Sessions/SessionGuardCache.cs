using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Auth.Sessions
{
    /// <summary>
    /// "Is this session still live?" for every request, cached for at most 10 seconds. Revocations in this process evict
    /// the entry at once, so logout and reuse detection take effect on the next request.
    /// </summary>
    public sealed class SessionGuardCache
    {
        private static readonly TimeSpan LiveFor = TimeSpan.FromSeconds(10);
        private readonly IMemoryCache _cache;

        public SessionGuardCache(IMemoryCache cache) => _cache = cache;

        private static string Key(Guid sessionId) => $"auth-session:{sessionId}";

        public bool? Get(Guid sessionId) => _cache.TryGetValue(Key(sessionId), out bool active) ? active : null;

        public void Set(Guid sessionId, bool active) => _cache.Set(Key(sessionId), active, LiveFor);

        public void Evict(Guid sessionId) => _cache.Remove(Key(sessionId));
    }
}
