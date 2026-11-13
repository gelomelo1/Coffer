namespace Coffer.ASPNET.Extensions
{
    public static class AuthSettings
    {
        // Public OAuth client id (not a secret) the mobile app requests Google ID tokens for
        // (Coffer.ReactNative/src/const/authAccessConfiguration.ts -> webGoogleClientId).
        private const string DefaultGoogleWebClientId = "652829495328-7n61l38u1h20q7bnl469pr1i0s68khrv.apps.googleusercontent.com";

        /// <summary>
        /// Google ID tokens are only accepted when their "aud" is one of these client ids.
        /// Override with GOOGLE_CLIENT_IDS (comma separated) in the .env file.
        /// </summary>
        public static string[] GoogleAudiences()
        {
            var configured = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_IDS");

            if (string.IsNullOrWhiteSpace(configured))
                return new[] { DefaultGoogleWebClientId };

            return configured
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }
    }
}
