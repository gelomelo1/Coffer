using System.Net;
using System.Net.Http.Json;
using Coffer.Domain.Constants;

namespace Coffer.Tests.Auth
{
    /// <summary>
    /// The sign-in identity (provider + provider account id) of an account is set by the sign-in alone. Nobody, not
    /// even an in-app Admin, can create an account for someone else's identity or move an account to another identity:
    /// either would hand the account to whoever controls that identity.
    /// </summary>
    public class AccountIdentityTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        public void Dispose() => _api.Dispose();

        private static object UserBody(string name, string provider, string subject, string email, string? role = null) => new
        {
            provider,
            providerUserId = subject,
            name,
            email,
            country = "HU",
            role,
        };

        [Fact]
        public async Task Admin_cannot_create_accounts_through_the_generic_api()
        {
            var admin = _api.Db.AddUser("boss", UserRole.Admin);

            var response = await _api.ClientFor(admin).PostAsJsonAsync("api/Users", UserBody("victim2", "google", "victims-google-sub", "v@example.com"));

            Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
            Assert.DoesNotContain(_api.Db.NewContext().Users, u => u.ProviderUserId == "victims-google-sub");
        }

        [Fact]
        public async Task Admin_cannot_move_an_account_to_another_identity()
        {
            var admin = _api.Db.AddUser("boss", UserRole.Admin);
            var victim = _api.Db.AddUser("victim");

            var response = await _api.ClientFor(admin).PutAsJsonAsync($"api/Users/{victim.Id}",
                UserBody("victim", "google", "attackers-google-sub", victim.Email));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            var stored = _api.Db.NewContext().Users.Single(u => u.Id == victim.Id);
            Assert.Equal(("google", "sub-victim"), (stored.Provider, stored.ProviderUserId));
        }

        [Fact]
        public async Task Admin_cannot_switch_the_provider_either()
        {
            var admin = _api.Db.AddUser("boss", UserRole.Admin);
            var victim = _api.Db.AddUser("victim");

            var response = await _api.ClientFor(admin).PutAsJsonAsync($"api/Users/{victim.Id}",
                UserBody("victim", "reddit", "sub-victim", victim.Email));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task A_user_cannot_change_their_own_identity()
        {
            var user = _api.Db.AddUser("anna");

            var response = await _api.ClientFor(user).PutAsJsonAsync($"api/Users/{user.Id}",
                UserBody("anna", "facebook", "someone-elses-sub", user.Email));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }
}
