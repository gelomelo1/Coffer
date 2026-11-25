using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>
    /// One browser sign-in in progress (Facebook, Discord, GitHub). Everything that proves the answer belongs to this attempt
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

        /// <param name="withNonce">OIDC providers (Facebook): a nonce the ID token must echo.</param>
        /// <param name="withPkce">A PKCE verifier kept here; only its S256 challenge goes to the provider.</param>
        public OAuthTransaction Create(string provider, bool withNonce, bool withPkce)
        {
            var transaction = new OAuthTransaction(
                SecureRandom.Token(), provider, SecureRandom.Token(),
                withNonce ? SecureRandom.Token() : null,
                withPkce ? SecureRandom.Token() : null,
                DateTime.UtcNow);
            _cache.Set(Key(transaction.Id), transaction, Lifetime);
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
                return transaction;
            }
        }
    }
}
