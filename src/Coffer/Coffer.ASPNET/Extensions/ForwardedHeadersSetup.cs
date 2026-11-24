using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace Coffer.ASPNET.Extensions
{
    /// <summary>
    /// Behind nginx the socket address is the proxy's. Only the proxies listed in TRUSTED_PROXIES (comma separated IPs
    /// or CIDR networks, e.g. the Docker network nginx connects from) may set X-Forwarded-For / -Proto; anyone else's
    /// headers are ignored, so the per-IP rate limits can't be dodged by sending a fake header. Unset = trust nobody.
    /// </summary>
    public static class ForwardedHeadersSetup
    {
        public const string Variable = "TRUSTED_PROXIES";

        public static ForwardedHeadersOptions Options(string? trustedProxies)
        {
            var options = new ForwardedHeadersOptions
            {
                ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
                ForwardLimit = 1,
            };
            // The defaults trust loopback; only the configured entries count.
            options.KnownProxies.Clear();
            options.KnownNetworks.Clear();

            foreach (var entry in (trustedProxies ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var slash = entry.IndexOf('/');
                if (slash < 0)
                {
                    if (!IPAddress.TryParse(entry, out var ip)) throw Invalid(entry);
                    options.KnownProxies.Add(ip);
                    continue;
                }

                if (!IPAddress.TryParse(entry[..slash], out var prefix) || !int.TryParse(entry[(slash + 1)..], out var length)
                    || length < 0 || length > (prefix.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork ? 32 : 128))
                    throw Invalid(entry);
                options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(prefix, length));
            }

            return options;
        }

        private static InvalidOperationException Invalid(string entry) =>
            new($"{Variable} has an invalid entry: '{entry}'. Use IP addresses or CIDR networks, separated by commas.");
    }
}
