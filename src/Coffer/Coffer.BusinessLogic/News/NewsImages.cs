using System.Text.RegularExpressions;
using Coffer.BusinessLogic.Marketplace.Common;
using DotNetEnv;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Coffer.BusinessLogic.News
{
    /// <summary>
    /// Banner and content images of news posts, in IMAGESTORE_PATH/news. Every upload is re-encoded (metadata and
    /// anything hidden in the file dropped), at most 1600 px on its longest side, named by a fresh guid.
    /// </summary>
    public static class NewsImages
    {
        public const long MaxBytes = 8L * 1024 * 1024;
        public const int MaxSide = 1600;
        public static readonly Regex Name = new("^[0-9a-f]{32}\\.(jpg|png)$", RegexOptions.CultureInvariant);
        private static readonly Regex Reference = new("coffer-image:([0-9a-f]{32}\\.(?:jpg|png))", RegexOptions.CultureInvariant);

        private static readonly DecoderOptions Decoder = new()
        {
            Configuration = new Configuration(new PngConfigurationModule(), new JpegConfigurationModule(), new WebpConfigurationModule()),
            MaxFrames = 1,
        };

        public static string Folder => Path.Combine(
            Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH environmental variable is not set"), "news");

        public static async Task<string> SaveAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0 || file.Length > MaxBytes) throw Invalid();
            Image<Rgba32> image;
            try
            {
                await using var input = file.OpenReadStream();
                image = await Image.LoadAsync<Rgba32>(Decoder, input);
            }
            catch (Exception e) when (e is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                throw Invalid();
            }

            using (image)
            {
                if (image.Width > MaxSide || image.Height > MaxSide)
                    image.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(MaxSide, MaxSide) }));
                image.Metadata.ExifProfile = null;
                image.Metadata.XmpProfile = null;
                image.Metadata.IccProfile = null;

                Directory.CreateDirectory(Folder);
                var transparent = HasTransparency(image);
                var name = $"{Guid.NewGuid():N}.{(transparent ? "png" : "jpg")}";
                var path = Path.Combine(Folder, name);
                if (transparent) await image.SaveAsPngAsync(path);
                else await image.SaveAsJpegAsync(path, new JpegEncoder { Quality = 85 });
                return name;
            }
        }

        private static bool HasTransparency(Image<Rgba32> image)
        {
            var found = false;
            image.ProcessPixelRows(rows =>
            {
                for (var y = 0; y < rows.Height && !found; y++)
                    foreach (var pixel in rows.GetRowSpan(y))
                        if (pixel.A < 255) { found = true; break; }
            });
            return found;
        }

        public static bool Exists(string? fileName) =>
            fileName != null && Name.IsMatch(fileName) && File.Exists(Path.Combine(Folder, fileName));

        public static (Stream Stream, string ContentType)? Open(string fileName)
        {
            if (!Exists(fileName)) return null;
            return (File.OpenRead(Path.Combine(Folder, fileName)), fileName.EndsWith(".png") ? "image/png" : "image/jpeg");
        }

        /// <summary>Content images a post's markdown refers to (coffer-image:{name}).</summary>
        public static IReadOnlySet<string> ReferencedIn(string? markdown) =>
            Reference.Matches(markdown ?? "").Select(m => m.Groups[1].Value).ToHashSet();

        public static void Delete(string? fileName)
        {
            if (!Exists(fileName)) return;
            File.Delete(Path.Combine(Folder, fileName!));
        }

        /// <summary>
        /// Deletes stored images that no post refers to and that were uploaded before <paramref name="uploadedBeforeUtc"/>:
        /// replaced banners and uploads that were never saved into a post. Younger files are kept, so an image uploaded into
        /// a post that is still being written survives. Returns how many were deleted.
        /// </summary>
        public static int DeleteUnused(IReadOnlySet<string> referenced, DateTime uploadedBeforeUtc)
        {
            if (!Directory.Exists(Folder)) return 0;
            var deleted = 0;
            foreach (var path in Directory.EnumerateFiles(Folder))
            {
                var name = Path.GetFileName(path);
                if (!Name.IsMatch(name) || referenced.Contains(name) || File.GetLastWriteTimeUtc(path) >= uploadedBeforeUtc) continue;
                try
                {
                    File.Delete(path);
                    deleted++;
                }
                catch (IOException)
                {
                    // In use or already gone: the next save tries again.
                }
            }
            return deleted;
        }

        private static MarketplaceException Invalid() =>
            MarketplaceException.Validation("invalidImage", "An image must be a PNG, JPEG or WebP picture of at most 8 MB.");
    }
}
