using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>
    /// One browser sign-in in progress (Google, Facebook, Discord, GitHub). Everything that proves the answer belongs to this attempt
    /// stays on the server: the state, the nonce and the PKCE verifier. The app holds only the id, which never appears
    /// in a URL, so an app that intercepts the redirect gets the code and the state but cannot finish the sign-in.
    /// </summary>
    public sealed record OAuthTransaction(string Id, string Provider, string State, string? Nonce, string? CodeVerifier, DateTime CreatedAt);

    /// <summary>What api/auth/{provider}/start answers: the app opens AuthorizeUrl and waits for RedirectUri.</summary>
    public sealed record OAuthStart(string TransactionId, string AuthorizeUrl, string RedirectUri);

    /// <summary>Pending browser sign-ins, 10 minutes each, single use (in memory: one API instance).</summary>
    public sealed class OAuthTransactionStore
    {
        public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
        private readonly IMemoryCache _cache;
        private readonly object _gate = new();

        public OAuthTransactionStore(IMemoryCache cache) => _cache = cache;

        private static string Key(string id) => $"oauth-transaction:{id}";
        private static string StateKey(string state) => $"oauth-transaction-state:{state}";

        /// <param name="withNonce">OIDC providers (Google, Facebook): a nonce the ID token must echo.</param>
        /// <param name="withPkce">A PKCE verifier kept here; only its S256 challenge goes to the provider.</param>
        public OAuthTransaction Create(string provider, bool withNonce, bool withPkce)
        {
            var transaction = new OAuthTransaction(
                SecureRandom.Token(), provider, SecureRandom.Token(),
                withNonce ? SecureRandom.Token() : null,
                withPkce ? SecureRandom.Token() : null,
                DateTime.UtcNow);
            _cache.Set(Key(transaction.Id), transaction, Lifetime);
            _cache.Set(StateKey(transaction.State), transaction.Id, Lifetime);
            return transaction;
        }

        /// <summary>Gets and removes the transaction in one step: a callback can be completed only once.</summary>
        public OAuthTransaction? Take(string? id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            lock (_gate)
            {
                if (!_cache.TryGetValue(Key(id), out OAuthTransaction? transaction)) return null;
                _cache.Remove(Key(id));
                _cache.Remove(StateKey(transaction!.State));
                return transaction;
            }
        }
    
        /// <summary>
        /// For a provider that redirects to the API (Google): the transaction whose state came back, taken in one step,
        /// and only if it belongs to that provider. An unknown, used or foreign state gives null.
        /// </summary>
        public OAuthTransaction? TakeByState(string provider, string? state)
        {
            if (string.IsNullOrEmpty(state)) return null;
            lock (_gate)
            {
                if (!_cache.TryGetValue(StateKey(state), out string? id) || id == null) return null;
                if (!_cache.TryGetValue(Key(id), out OAuthTransaction? transaction) || transaction!.Provider != provider) return null;
                _cache.Remove(Key(id));
                _cache.Remove(StateKey(state));
                return transaction;
            }
        }
}
}
