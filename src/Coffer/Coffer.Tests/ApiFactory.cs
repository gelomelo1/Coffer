using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Coffer.BusinessLogic.Services;
using Coffer.DataAccess;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Coffer.Tests
{
    /// <summary>Process-wide env vars the app reads via DotNetEnv (set once, shared by all tests).</summary>
    public static class TestEnvironment
    {
        public static readonly string Root = Path.Combine(Path.GetTempPath(), "coffer-tests-" + Guid.NewGuid().ToString("N"));
        public static string ItemImages => Path.Combine(Root, "images", "items");
        public static string CollectionImages => Path.Combine(Root, "images", "collectioncovers");
        public static string Temp => Path.Combine(Root, "temp");
        public const string PythonUrl = "http://python.test";

        static TestEnvironment()
        {
            Directory.CreateDirectory(ItemImages);
            Directory.CreateDirectory(CollectionImages);
            Directory.CreateDirectory(Temp);
            Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-test-secret-test-secret-1234");
            Environment.SetEnvironmentVariable("COFFER_CONNECTIONSTRING", "Host=unused");
            Environment.SetEnvironmentVariable("IMAGESTORE_PATH", Path.Combine(Root, "images"));
            Environment.SetEnvironmentVariable("IMAGECHECK_TEMP_PATH", Temp);
            Environment.SetEnvironmentVariable("FASTAPI_URL", PythonUrl);
        }

        public static void Ensure() { _ = Root; }
    }

    /// <summary>Stands in for the Python FastAPI service and records every call.</summary>
    public class FakePythonHandler : HttpMessageHandler
    {
        public List<(HttpMethod Method, string Path)> Calls { get; } = new();
        public HttpStatusCode StatusCode { get; set; } = HttpStatusCode.OK;
        public string Body { get; set; } = "{\"status\":\"ok\"}";

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls.Add((request.Method, request.RequestUri!.AbsolutePath));
            return Task.FromResult(new HttpResponseMessage(StatusCode)
            {
                Content = new StringContent(Body, Encoding.UTF8, "application/json")
            });
        }
    }

    public class ApiFactory : WebApplicationFactory<Coffer.ASPNET.Program>
    {
        public TestDb Db { get; } = new();
        public FakePythonHandler Python { get; } = new();
        public string Environment { get; set; } = "Development";

        static ApiFactory() => TestEnvironment.Ensure();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(Environment);
            builder.ConfigureTestServices(services =>
            {
                var dbDescriptors = services
                    .Where(d => d.ServiceType == typeof(CofferDbContext)
                             || d.ServiceType == typeof(DbContextOptions)
                             || (d.ServiceType.IsGenericType && d.ServiceType.GetGenericArguments().Contains(typeof(CofferDbContext))))
                    .ToList();
                foreach (var d in dbDescriptors)
                    services.Remove(d);
                services.AddDbContext<CofferDbContext>(o => o.UseSqlite(Db.Connection));

                services.AddTransient(_ => new HttpClient(Python, disposeHandler: false));

                // Background job is irrelevant for these tests.
                var hosted = services.Where(d => d.ServiceType == typeof(IHostedService) && d.ImplementationType == typeof(TradeCleanupService)).ToList();
                foreach (var d in hosted)
                    services.Remove(d);
            });
        }

        public HttpClient ClientFor(User? user)
        {
            var client = CreateClient();
            if (user != null)
            {
                var token = new JwtService().GenerateToken(user);
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }
            return client;
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing)
                Db.Dispose();
        }
    }
}
