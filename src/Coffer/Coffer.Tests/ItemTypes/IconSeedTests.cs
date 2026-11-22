using Coffer.BusinessLogic.ItemTypes;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>The icons that used to ship in wwwroot/icons are copied into the icon store once (never overwritten).</summary>
    public class IconSeedTests
    {
        [Fact]
        public void CopiesMissingIconsOnly()
        {
            var source = Directory.CreateTempSubdirectory("coffer-icons-src").FullName;
            var target = Path.Combine(Path.GetTempPath(), "coffer-icons-dst-" + Guid.NewGuid().ToString("N"));
            File.WriteAllBytes(Path.Combine(source, "cap.png"), new byte[] { 1 });
            File.WriteAllBytes(Path.Combine(source, "stamp.png"), new byte[] { 2 });
            File.WriteAllText(Path.Combine(source, "readme.txt"), "not an icon");
            Directory.CreateDirectory(target);
            File.WriteAllBytes(Path.Combine(target, "stamp.png"), new byte[] { 9 });

            var copied = IconSeed.CopyMissing(source, target);

            Assert.Equal(1, copied);
            Assert.Equal(new byte[] { 1 }, File.ReadAllBytes(Path.Combine(target, "cap.png")));
            Assert.Equal(new byte[] { 9 }, File.ReadAllBytes(Path.Combine(target, "stamp.png")));
            Assert.False(File.Exists(Path.Combine(target, "readme.txt")));
            Assert.Equal(0, IconSeed.CopyMissing(Path.Combine(source, "missing"), target));
        }
    }
}
