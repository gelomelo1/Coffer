namespace Coffer.BusinessLogic.Auth.OAuth
{
    public static class OAuthTimeouts
    {
        /// <summary>Revoking the provider's token after sign-in is best effort and may take at most this long.</summary>
        public static readonly TimeSpan Revoke = TimeSpan.FromSeconds(3);
    }
}
