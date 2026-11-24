namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>
    /// A sign-in the provider vouched for. (Provider, Subject) is the account's identity: the provider's stable,
    /// immutable user id (Google/Facebook "sub", Reddit account id), never an e-mail or a username. The rest is profile
    /// data, used only to pre-fill a new account.
    /// </summary>
    public sealed record ProviderIdentity(string Provider, string Subject, string? Email, string? DisplayName, string? AvatarUrl);

    /// <summary>A provider sign-in that did not verify. The message is for the log only; clients get providerSignInFailed.</summary>
    public sealed class ProviderSignInException : Exception
    {
        public ProviderSignInException(string message, Exception? inner = null) : base(message, inner) { }
    }

    public static class Providers
    {
        public const string Google = "google";
        public const string Facebook = "facebook";
        public const string Reddit = "reddit";
        /// <summary>Only for users from the development seed and accounts made before GitHub sign-in was removed.</summary>
        public const string Github = "github";
    }
}
