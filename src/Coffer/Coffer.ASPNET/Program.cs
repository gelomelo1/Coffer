using Coffer.ASPNET.Extensions;

namespace Coffer.ASPNET
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args)
                .SetupServices();
            var app = builder.Build()
                .SetupMiddleware();
            app.Run();
        }
    }
}
