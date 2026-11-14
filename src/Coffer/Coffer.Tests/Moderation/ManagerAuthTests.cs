using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Moderation;
using Coffer.Tests.Marketplace;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Moderation
{
    public class ManagerAdminConfigTests
    {
        [Theory]
        [InlineData("[\"12345678\"]", new[] { "12345678" })]
        [InlineData("'[\"1\", \"22\"]'", new[] { "1", "22" })]
        [InlineData("[12345678, \"87654321\"]", new[] { "12345678", "87654321" })]
        public void Parse_AcceptsJsonArraysOfNumericIds(string raw, string[] expected)
        {
            var config = ManagerAdminConfig.Parse(raw);
            Assert.True(config.HasAdmins);
            Assert.Equal(expected.OrderBy(x => x), config.Ids.OrderBy(x => x));
            Assert.Null(config.Problem);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("[]")]
        [InlineData("octocat")]
        [InlineData("[\"octocat\"]")]
        [InlineData("{\"id\":1}")]
        public void Parse_EmptyOrInvalid_GrantsNobody_WithDiagnostic(string? raw)
        {
            var config = ManagerAdminConfig.Parse(raw);
            Assert.False(config.HasAdmins);
            Assert.False(config.IsAdmin("octocat"));
            Assert.False(config.IsAdmin("1"));
            Assert.Contains(ManagerAdminConfig.EnvName, config.Problem);
        }
    }

    [Collection("api")]
    public class ManagerAuthApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private readonly FakeGithubDeviceFlow _github = new();

        private void Configure(string admins) => _api.Overrides = services =>
        {
            services.AddSingleton(ManagerAdminConfig.Parse(admins));
            services.AddSingleton<IGithubDeviceFlowClient>(_github);
        };

        [Fact]
        public async Task DeviceFlow_ConfiguredAdmin_GetsManagerToken_ThatWorksOnAdminEndpoints()
        {
            Configure("[\"1001\"]");
            var client = _api.CreateClient();

            var start = await client.PostAsync("api/Manager/Auth/Device", null);
            Assert.Equal(HttpStatusCode.OK, start.StatusCode);
            Assert.Contains("ABCD-1234", await start.Content.ReadAsStringAsync());

            var pending = await client.PostAsJsonAsync("api/Manager/Auth/Device/Token", new { deviceCode = "device-123" });
            Assert.Contains("\"pending\"", await pending.Content.ReadAsStringAsync());

            _github.Next = new GithubDevicePoll(GithubDevicePollStatus.Authorized, "gho_secret");
            var done = await client.PostAsJsonAsync("api/Manager/Auth/Device/Token", new { deviceCode = "device-123" });
            Assert.Equal(HttpStatusCode.OK, done.StatusCode);
            var dto = await done.Content.ReadFromJsonAsync<ManagerDeviceTokenDto>();
            Assert.Equal("authorized", dto!.Status);
            Assert.Equal("1001", dto.Admin!.GithubId);
            Assert.DoesNotContain("gho_secret", await done.Content.ReadAsStringAsync());

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(dto.Token);
            Assert.Contains(ManagerTokens.Audience, jwt.Audiences);

            var authed = _api.CreateClient();
            authed.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", dto.Token);
            Assert.Equal(HttpStatusCode.OK, (await authed.GetAsync("api/Admin/Reports")).StatusCode);
            Assert.Contains("octo-admin", await authed.GetStringAsync("api/Manager/Auth/Me"));

            var ctx = _api.Db.NewContext();
            Assert.Equal("1001", ctx.ManagerAdmins.Single().GithubId);
            Assert.Single(ctx.AdminAuditLog.Where(a => a.Action == "login"));
        }

        [Fact]
        public async Task DeviceFlow_NonAdminGithubAccount_IsRejected_WithoutToken()
        {
            Configure("[\"1001\"]");
            _github.Identity = new GithubIdentity("5555", "octo-admin"); // same login, different immutable id
            _github.Next = new GithubDevicePoll(GithubDevicePollStatus.Authorized, "gho_secret");

            var response = await _api.CreateClient().PostAsJsonAsync("api/Manager/Auth/Device/Token", new { deviceCode = "device-123" });

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            Assert.Contains("not_admin", body);
            Assert.DoesNotContain("token\":\"ey", body);
            Assert.Empty(_api.Db.NewContext().ManagerAdmins);
        }

        [Fact]
        public async Task NoAdminsConfigured_SignInIsUnavailable_WithProvisioningMessage()
        {
            Configure("");
            var response = await _api.CreateClient().PostAsync("api/Manager/Auth/Device", null);

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            Assert.Contains(ManagerAdminConfig.ProvisioningRequiredCode, body);
            Assert.Contains(ManagerAdminConfig.EnvName, body);
        }

        [Fact]
        public async Task ExpiredOrDeniedCodes_AreUnauthorized()
        {
            Configure("[\"1001\"]");
            _github.Next = new GithubDevicePoll(GithubDevicePollStatus.Expired);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.CreateClient().PostAsJsonAsync("api/Manager/Auth/Device/Token", new { deviceCode = "x" })).StatusCode);
            _github.Next = new GithubDevicePoll(GithubDevicePollStatus.Denied);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.CreateClient().PostAsJsonAsync("api/Manager/Auth/Device/Token", new { deviceCode = "x" })).StatusCode);
        }

        [Fact]
        public async Task ForgedOrUserTokens_DontPassManagerEndpoints()
        {
            Configure("[\"1001\"]");
            var user = _api.Db.AddUser("someone", Coffer.Domain.Constants.UserRole.Admin);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(user).GetAsync("api/Manager/Auth/Me")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.CreateClient().GetAsync("api/Manager/Auth/Me")).StatusCode);

            var forged = _api.CreateClient();
            forged.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "eyJhbGciOiJub25lIn0.eyJnaXRodWJfaWQiOiIxMDAxIn0.");
            Assert.Equal(HttpStatusCode.Unauthorized, (await forged.GetAsync("api/Admin/Reports")).StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
