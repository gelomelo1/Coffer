using Coffer.BusinessLogic.AppConfig;

namespace Coffer.Tests.Auth
{
    /// <summary>Every data folder comes from the single COFFER_ROOT_PATH.</summary>
    public class AppPathsTests
    {
        static AppPathsTests() => TestEnvironment.Ensure();

        [Fact]
        public void Derives_every_folder_from_the_root()
        {
            var root = Environment.GetEnvironmentVariable("COFFER_ROOT_PATH")!;
            Assert.Equal(Path.Combine(root, "data", "images"), AppPaths.Images);
            Assert.Equal(Path.Combine(root, "data", "icons"), AppPaths.Icons);
            Assert.Equal(Path.Combine(root, "data", "vectors"), AppPaths.Vectors);
            Assert.Equal(Path.Combine(root, "data", "temp"), AppPaths.Temp);
            Assert.Equal(Path.Combine(root, "models"), AppPaths.Models);
        }
    }
}
