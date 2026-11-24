using System.Net;
using Coffer.ASPNET.Extensions;

namespace Coffer.Tests.Auth
{
    /// <summary>Only the proxies in TRUSTED_PROXIES may tell the API the client's real IP (rate limits key on it).</summary>
    public class ForwardedHeadersTests
    {
        [Fact]
        public void Nothing_is_trusted_without_the_setting()
        {
            var options = ForwardedHeadersSetup.Options(null);
            Assert.Empty(options.KnownProxies);
            Assert.Empty(options.KnownNetworks);
        }

        [Fact]
        public void Networks_and_single_proxies_are_trusted()
        {
            var options = ForwardedHeadersSetup.Options("172.18.0.0/16, 10.0.0.5");

            var network = Assert.Single(options.KnownNetworks);
            Assert.Equal(IPAddress.Parse("172.18.0.0"), network.Prefix);
            Assert.Equal(16, network.PrefixLength);
            Assert.Equal(IPAddress.Parse("10.0.0.5"), Assert.Single(options.KnownProxies));
            Assert.Equal(1, options.ForwardLimit);
        }

        [Fact]
        public void An_invalid_entry_stops_startup()
        {
            var e = Assert.Throws<InvalidOperationException>(() => ForwardedHeadersSetup.Options("nope"));
            Assert.Contains("TRUSTED_PROXIES", e.Message);
        }
    }
}
