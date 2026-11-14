using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Http;

namespace Coffer.BusinessLogic.Marketplace.Common
{
    /// <summary>Folders where marketplace images live.</summary>
    public sealed record MarketplaceStorage(string ListingImages, string DealImages);

    public sealed record UserSummaryDto(Guid Id, string Name, string? Avatar)
    {
        public static UserSummaryDto From(User u) => new(u.Id, u.Name, u.Avatar);
    }

    /// <summary>
    /// Validates uploaded photos before they touch the disk: size, extension, declared type and the real file
    /// signature (the declared content type alone is client-controlled).
    /// </summary>
    public static class ImageUploadGuard
    {
        public const long MaxBytes = 8 * 1024 * 1024;
        private static readonly string[] Extensions = { ".jpg", ".jpeg", ".png" };
        private static readonly string[] ContentTypes = { "image/jpeg", "image/png" };

        public static void Validate(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                throw MarketplaceException.Validation("An image file is empty.");
            if (file.Length > MaxBytes)
                throw MarketplaceException.Validation("Images must be at most 8 MB.");
            if (!Extensions.Contains(Path.GetExtension(file.FileName).ToLowerInvariant())
                || !ContentTypes.Contains((file.ContentType ?? "").ToLowerInvariant()))
                throw MarketplaceException.Validation("Only JPG and PNG images are allowed.");

            var header = new byte[8];
            using var stream = file.OpenReadStream();
            var read = stream.Read(header, 0, header.Length);
            var isJpeg = read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
            var isPng = read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
            if (!isJpeg && !isPng)
                throw MarketplaceException.Validation("The uploaded file is not a valid image.");
        }
    }

    public static class Text
    {
        /// <summary>Trims; returns null for empty. Throws when longer than max.</summary>
        public static string? Optional(string? value, int max, string field)
        {
            var t = value?.Trim();
            if (string.IsNullOrEmpty(t)) return null;
            if (t.Length > max) throw MarketplaceException.Validation($"{field} must be at most {max} characters.");
            return t;
        }

        public static string Required(string? value, int min, int max, string field)
        {
            var t = value?.Trim() ?? "";
            if (t.Length < min || t.Length > max)
                throw MarketplaceException.Validation(min <= 1
                    ? $"{field} is required (max {max} characters)."
                    : $"{field} must be {min} to {max} characters.");
            return t;
        }
    }
}
