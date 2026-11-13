using System.Net;
using Coffer.ASPNET.Extensions;
using Coffer.BusinessLogic.Services;
using Coffer.DataAccess.Extensions;

namespace Coffer.Tests
{
    public class ImageServicePathTests
    {
        private readonly ImageService _sut = new();
        private readonly string _folder = Path.Combine(TestEnvironment.Root, "unit-images-" + Guid.NewGuid().ToString("N"));

        public ImageServicePathTests()
        {
            Directory.CreateDirectory(_folder);
        }

        [Fact]
        public async Task GetImage_RejectsTraversal_AsNotFound()
        {
            var outside = Path.Combine(TestEnvironment.Root, $"outside-{Guid.NewGuid()}.png");
            File.WriteAllBytes(outside, new byte[] { 1 });

            await Assert.ThrowsAsync<FileNotFoundException>(() => _sut.GetImageAsync(Path.Combine("..", Path.GetFileName(outside)), _folder));
            await Assert.ThrowsAsync<FileNotFoundException>(() => _sut.GetImageAsync(outside, _folder));
        }

        [Fact]
        public async Task DeleteImage_RejectsPathsOutsideFolder()
        {
            var outside = Path.Combine(TestEnvironment.Root, $"outside-{Guid.NewGuid()}.png");
            File.WriteAllBytes(outside, new byte[] { 1 });

            await Assert.ThrowsAsync<ArgumentException>(() => _sut.DeleteImageAsync(outside, _folder));
            Assert.True(File.Exists(outside));
        }

        [Fact]
        public async Task GetAndDelete_StillWork_ForPlainFileNames()
        {
            var name = $"{Guid.NewGuid()}_20260101000000.jpg";
            File.WriteAllBytes(Path.Combine(_folder, name), new byte[] { 1, 2 });

            var (bytes, contentType) = await _sut.GetImageAsync(name, _folder);
            Assert.Equal(2, bytes.Length);
            Assert.Equal("image/jpg", contentType);

            await _sut.DeleteImageAsync(name, _folder);
            Assert.False(File.Exists(Path.Combine(_folder, name)));
        }

        [Fact]
        public void ImageOwnership_IsBasedOnTheIdPrefix()
        {
            var id = Guid.NewGuid();
            Assert.True(ImageService.IsImageOf($"{id}_20260101000000.png", id));
            Assert.False(ImageService.IsImageOf($"{Guid.NewGuid()}_20260101000000.png", id));
            Assert.False(ImageService.IsImageOf(null, id));
        }
    }

    public class DynamicQueryGuardTests
    {
        [Theory]
        [InlineData("PrivateNote != null")]
        [InlineData("email.StartsWith(\"a\")")]
        [InlineData("User.ProviderUserId == \"1\"")]
        [InlineData("Collection.User.Email.Contains(\"@\")")]
        public void Rejects_HiddenFields(string expression)
        {
            Assert.False(DynamicQueryGuard.IsAllowed(expression));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("userId == \"6f3c\" AND collectionTypeId == 1")]
        [InlineData("title.ToLower().Contains(\"email me for details\")")] // user search text is not a field reference
        [InlineData("createdAt desc")]
        public void Allows_NormalQueries(string? expression)
        {
            Assert.True(DynamicQueryGuard.IsAllowed(expression));
        }
    }

    public class AuthSettingsTests
    {
        [Fact]
        public void GoogleAudiences_DefaultToTheAppsWebClientId()
        {
            Environment.SetEnvironmentVariable("GOOGLE_CLIENT_IDS", null);

            Assert.Equal(new[] { "652829495328-7n61l38u1h20q7bnl469pr1i0s68khrv.apps.googleusercontent.com" }, AuthSettings.GoogleAudiences());
        }

        [Fact]
        public void GoogleAudiences_CanBeConfigured()
        {
            Environment.SetEnvironmentVariable("GOOGLE_CLIENT_IDS", " a.apps.googleusercontent.com , b.apps.googleusercontent.com ");
            try
            {
                Assert.Equal(new[] { "a.apps.googleusercontent.com", "b.apps.googleusercontent.com" }, AuthSettings.GoogleAudiences());
            }
            finally
            {
                Environment.SetEnvironmentVariable("GOOGLE_CLIENT_IDS", null);
            }
        }

        [Fact]
        public async Task GithubExchange_FailsClosed_WhenSecretNotConfigured()
        {
            Environment.SetEnvironmentVariable("GITHUB_CLIENT_SECRET", null);

            await Assert.ThrowsAsync<InvalidOperationException>(() => new GithubService().ExchangeCodeForToken("code", "verifier"));
        }
    }

    public class InternalApiKeyHandlerTests
    {
        private sealed class Capture : HttpMessageHandler
        {
            public HttpRequestMessage? Last;
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            {
                Last = request;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            }
        }

        [Fact]
        public async Task AddsKey_OnlyForPythonServiceRequests()
        {
            var capture = new Capture();
            var client = new HttpClient(new InternalApiKeyHandler("http://fastapi:8000", "k3y") { InnerHandler = capture });

            await client.GetAsync("http://fastapi:8000/hello");
            Assert.Equal("k3y", capture.Last!.Headers.GetValues(InternalApiKeyHandler.HeaderName).Single());

            await client.GetAsync("https://api.github.com/user");
            Assert.False(capture.Last!.Headers.Contains(InternalApiKeyHandler.HeaderName));
        }

        [Fact]
        public async Task AddsNothing_WhenNoKeyConfigured()
        {
            var capture = new Capture();
            var client = new HttpClient(new InternalApiKeyHandler("http://fastapi:8000", null) { InnerHandler = capture });

            await client.GetAsync("http://fastapi:8000/hello");
            Assert.False(capture.Last!.Headers.Contains(InternalApiKeyHandler.HeaderName));
        }
    }
}
