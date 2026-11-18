using System.Net;

namespace Coffer.Tests
{
    /// <summary>The app asks this when a request failed although the phone is online, to tell "server down" from a one-off error.</summary>
    [Collection("api")]
    public class HealthApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        [Fact]
        public async Task Health_AnswersWithoutSigningIn()
        {
            var response = await _api.CreateClient().GetAsync("api/Health");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
