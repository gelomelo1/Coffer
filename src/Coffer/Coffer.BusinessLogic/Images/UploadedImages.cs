using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Coffer.BusinessLogic.Images
{
    /// <summary>The widths the app resizes photos to before uploading (src/const/image_resize_config.ts).</summary>
    public static class UploadWidths
    {
        /// <summary>Item photos (AI check), collection covers, contribution photos — the app's highImageResize.</summary>
        public const int Small = 800;

        /// <summary>Listing and shipping / receipt photos — the app's listingImageResize.</summary>
        public const int Large = 1600;
    }

    public sealed record PreparedImage(byte[] Bytes, string Extension, string ContentType);

    /// <summary>
    /// The server's safety net for user photo uploads. The app resizes every photo before sending it; a photo it
    /// prepared (no wider than the path's width, no metadata) is kept byte for byte. A photo sent some other way that
    /// is wider, or that carries metadata (EXIF with GPS location, XMP, IPTC), is re-encoded: orientation applied,
    /// resized to the width, metadata dropped.
    /// </summary>
    public static class UploadedImages
    {
        private static readonly DecoderOptions Decoder = new()
        {
            Configuration = new Configuration(new PngConfigurationModule(), new JpegConfigurationModule()),
            MaxFrames = 1,
        };

        public static async Task<PreparedImage> PrepareAsync(IFormFile file, int maxWidth, int quality = 85)
        {
            // Judged by content (size, decodes as JPEG / PNG), not by the client's file name or declared type: paths
            // that check those (ImageUploadGuard) do so before calling this.
            if (file == null || file.Length == 0)
                throw MarketplaceException.Validation("anImageFileIsEmpty", "An image file is empty.");
            if (file.Length > ImageUploadGuard.MaxBytes)
                throw MarketplaceException.Validation("imagesMustBeAtMost8Mb", "Images must be at most 8 MB.");
            await using var buffer = new MemoryStream();
            await using (var input = file.OpenReadStream()) await input.CopyToAsync(buffer);
            var bytes = buffer.ToArray();

            ImageInfo info;
            try
            {
                info = Image.Identify(Decoder, bytes);
            }
            catch (Exception e) when (e is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                throw Invalid();
            }

            var isPng = info.Metadata.DecodedImageFormat is PngFormat;
            var hasMetadata = info.Metadata.ExifProfile != null || info.Metadata.XmpProfile != null || info.Metadata.IptcProfile != null;
            if (info.Width <= maxWidth && !hasMetadata)
                return isPng ? new PreparedImage(bytes, ".png", "image/png") : new PreparedImage(bytes, ".jpg", "image/jpeg");

            Image<Rgba32> image;
            try
            {
                image = Image.Load<Rgba32>(Decoder, bytes);
            }
            catch (Exception e) when (e is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                throw Invalid();
            }

            using (image)
            {
                image.Mutate(x => x.AutoOrient());
                if (image.Width > maxWidth)
                    image.Mutate(x => x.Resize(maxWidth, 0));
                image.Metadata.ExifProfile = null;
                image.Metadata.XmpProfile = null;
                image.Metadata.IptcProfile = null;

                await using var output = new MemoryStream();
                if (isPng && HasTransparency(image))
                {
                    await image.SaveAsPngAsync(output);
                    return new PreparedImage(output.ToArray(), ".png", "image/png");
                }
                await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = quality });
                return new PreparedImage(output.ToArray(), ".jpg", "image/jpeg");
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

        private static MarketplaceException Invalid() =>
            MarketplaceException.Validation("theUploadedFileIsNotAValid", "The uploaded file is not a valid image.");
    }
}
