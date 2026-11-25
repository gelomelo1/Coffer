using Coffer.BusinessLogic.Marketplace.Common;
using Google.Apis.Auth;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    public interface IGoogleIdTokenValidator
    {
        /// <summary>The verified Google identity, or <see cref="ProviderSignInException"/>.</summary>
        Task<ProviderIdentity> ValidateAsync(string idToken);
    }

    /// <summary>
    /// Google ID tokens from the native sign-in. Google's library checks the RS256 signature against Google's keys, the
    /// issuer (accounts.google.com), the audience (our client ids) and the expiry. On top of that the token must be
    /// fresh: the native SDK can't carry a nonce, so a leaked token is only usable for 10 minutes after Google issued it.
    /// </summary>
    public sealed class GoogleIdTokenValidator : IGoogleIdTokenValidator
    {
        public static readonly TimeSpan MaxAge = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan FutureSkew = TimeSpan.FromMinutes(2);

        private readonly AuthOptions _options;
        private readonly IClock _clock;

        public GoogleIdTokenValidator(AuthOptions options, IClock clock)
        {
            _options = options;
            _clock = clock;
        }

        public async Task<ProviderIdentity> ValidateAsync(string idToken)
        {
            if (string.IsNullOrWhiteSpace(idToken)) throw new ProviderSignInException("empty Google ID token");
            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = (_options.Google ?? throw new ProviderNotConfiguredException(Providers.Google)).ClientIds,
                });
            }
            catch (Exception e) when (e is InvalidJwtException or FormatException or ArgumentException)
            {
                throw new ProviderSignInException($"Google ID token rejected: {e.GetType().Name}");
            }
            return Accept(payload, _clock.UtcNow);
        }

        /// <summary>Coffer's own rules on a payload Google already verified.</summary>
        public static ProviderIdentity Accept(GoogleJsonWebSignature.Payload payload, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(payload.Subject)) throw new ProviderSignInException("Google ID token without subject");
            if (payload.IssuedAtTimeSeconds is not { } iat) throw new ProviderSignInException("Google ID token without iat");
            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(iat).UtcDateTime;
            if (issuedAt < now - MaxAge || issuedAt > now + FutureSkew)
                throw new ProviderSignInException("Google ID token is not fresh");

            // An unverified address is not proof of ownership: it is not stored.
            var email = payload.EmailVerified ? payload.Email : null;
            return new ProviderIdentity(Providers.Google, payload.Subject, email, payload.Name, payload.Picture);
        }
    }
}
