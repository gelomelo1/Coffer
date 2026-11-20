using System.Net.Http.Json;
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
        /// <summary>Crops and fingerprints of caps waiting for review (IMAGESTORE_PATH/pending).</summary>
        public static string Pending => Path.Combine(Root, "images", "pending");
        public const string PythonUrl = "http://python.test";

        static TestEnvironment()
        {
            Directory.CreateDirectory(ItemImages);
            Directory.CreateDirectory(CollectionImages);
            Directory.CreateDirectory(Temp);
            Directory.CreateDirectory(Pending);
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
        /// <summary>When set, answers per request (path-specific fakes); otherwise StatusCode + Body.</summary>
        public Func<HttpRequestMessage, (HttpStatusCode Status, string Body)>? Responder { get; set; }
        /// <summary>Request bodies, in call order (for asserting what was sent).</summary>
        public List<string> Bodies { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls.Add((request.Method, request.RequestUri!.AbsolutePath));
            Bodies.Add(request.Content is StringContent or JsonContent ? await request.Content!.ReadAsStringAsync(cancellationToken) : "");
            var (status, body) = Responder?.Invoke(request) ?? (StatusCode, Body);
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
        }
    }

    public class ApiFactory : WebApplicationFactory<Coffer.ASPNET.Program>
    {
        public TestDb Db { get; } = new();
        public FakePythonHandler Python { get; } = new();
        public string Environment { get; set; } = "Development";
        /// <summary>Extra test service overrides (fake GitHub client, admin list, …), applied last.</summary>
        public Action<IServiceCollection>? Overrides { get; set; }

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
                services.AddDbContext<CofferDbContext>(o => o.UseSqlite(Db.Connection).UseSnakeCaseNamingConvention());

                services.AddTransient(_ => new HttpClient(Python, disposeHandler: false));

                // Background sweeper is driven explicitly in tests.
                foreach (var d in services.Where(d => d.ServiceType == typeof(IHostedService) && d.ImplementationType == typeof(Coffer.BusinessLogic.Marketplace.MarketplaceMaintenanceService)).ToList())
                    services.Remove(d);

                Overrides?.Invoke(services);
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

        /// <summary>Client signed in to Coffer.Manager as the given admin identity (Manager-audience token).</summary>
        public HttpClient ManagerClientFor(Coffer.Domain.Moderation.ManagerAdmin admin)
        {
            var client = CreateClient();
            var (token, _) = Coffer.BusinessLogic.Moderation.ManagerTokens.Issue(admin, DateTime.UtcNow);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
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
