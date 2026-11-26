using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Coffer.BusinessLogic.Images;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Services;
using Coffer.Domain.Marketplace;
using Coffer.Tests.ItemTypes;
using Coffer.Tests.Marketplace;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;
using SixLabors.ImageSharp.PixelFormats;

namespace Coffer.Tests.Images
{
    /// <summary>
    /// The server's safety net for photo uploads: a photo the app prepared passes through untouched; a bigger one is
    /// resized to the path's width; one carrying metadata (GPS) is re-encoded without it.
    /// </summary>
    public class UploadedImagesTests
    {
        public static IFormFile FormFile(byte[] bytes, string name = "photo.jpg", string contentType = "image/jpeg") =>
            new Microsoft.AspNetCore.Http.FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType,
            };

        public static byte[] JpegWithGps(int width, int height)
        {
            using var image = new Image<Rgba32>(width, height, new Rgba32(10, 120, 200));
            var exif = new ExifProfile();
            exif.SetValue(ExifTag.GPSLatitudeRef, "N");
            exif.SetValue(ExifTag.GPSLatitude, new[] { new Rational(47, 1), new Rational(29, 1), new Rational(0, 1) });
            image.Metadata.ExifProfile = exif;
            using var stream = new MemoryStream();
            image.SaveAsJpeg(stream);
            return stream.ToArray();
        }

        [Fact]
        public async Task AppSizedPhotoIsStoredByteForByte()
        {
            var bytes = ItemTypeFilesTests.Jpeg(800, 600);

            var prepared = await UploadedImages.PrepareAsync(FormFile(bytes), UploadWidths.Small);

            Assert.Equal(bytes, prepared.Bytes);
            Assert.Equal(".jpg", prepared.Extension);
            Assert.Equal("image/jpeg", prepared.ContentType);
        }

        [Fact]
        public async Task WiderPhotoIsResizedToTheWidth()
        {
            var prepared = await UploadedImages.PrepareAsync(FormFile(ItemTypeFilesTests.Jpeg(3000, 2000)), UploadWidths.Small);

            using var image = Image.Load(prepared.Bytes);
            Assert.Equal(800, image.Width);
            Assert.Equal(533, image.Height);
        }

        [Fact]
        public async Task SmallPhotoWithGpsIsReencodedWithoutMetadata()
        {
            var original = JpegWithGps(400, 300);
            using (var check = Image.Load(original)) Assert.NotNull(check.Metadata.ExifProfile);

            var prepared = await UploadedImages.PrepareAsync(FormFile(original), UploadWidths.Small);

            using var image = Image.Load(prepared.Bytes);
            Assert.Null(image.Metadata.ExifProfile);
            Assert.Equal(400, image.Width);
        }

        [Fact]
        public async Task NarrowPhotoIsNeverUpscaled()
        {
            var prepared = await UploadedImages.PrepareAsync(FormFile(ItemTypeFilesTests.Jpeg(200, 100)), UploadWidths.Large);

            using var image = Image.Load(prepared.Bytes);
            Assert.Equal(200, image.Width);
        }

        [Fact]
        public async Task ImagesOver50MegapixelsAreRefusedBeforeDecoding()
        {
            // 8000 × 7000 = 56 MP: a small file (one grey level compresses to almost nothing) that would need a huge
            // amount of memory to decode — refused from its header alone.
            byte[] big;
            using (var image = new Image<L8>(8000, 7000, new L8(128)))
            using (var stream = new MemoryStream())
            {
                image.SaveAsPng(stream);
                big = stream.ToArray();
            }

            var error = await Assert.ThrowsAsync<MarketplaceException>(() => UploadedImages.PrepareAsync(FormFile(big, "a.png", "image/png"), UploadWidths.Small));

            Assert.Equal("theUploadedFileIsNotAValid", error.Code);
        }

        [Fact]
        public async Task NotAnImageIsRefused()
        {
            // Passes the signature check (JPEG magic bytes) but is not a decodable image.
            var fake = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46 };

            var error = await Assert.ThrowsAsync<MarketplaceException>(() => UploadedImages.PrepareAsync(FormFile(fake), UploadWidths.Small));

            Assert.Equal("theUploadedFileIsNotAValid", error.Code);
        }

        public class ListingPhotos : MarketplaceTestBase
        {
            [Fact]
            public async Task ListingPhotoWiderThan1600IsResized()
            {
                var folder = Path.Combine(Path.GetTempPath(), "coffer-listings-" + Guid.NewGuid().ToString("N"));
                var owner = Db.AddUser("owner");
                var listings = new ListingService(Db.Context, Clock, new ImageService(), new MarketplaceStorage(folder, folder));
                var input = new ListingInput(ListingKind.Sell, CollectionTypeId(), "Forint set", "1990s", 2500, null, ListingCondition.Good,
                    Budapest.Id, true, false, new List<ListingLineInput> { new("10 forint coin", 1) }, null, true);

                var created = await listings.CreateAsync(owner.Id, input, new[] { TestImages.File(bytes: ItemTypeFilesTests.Jpeg(3000, 2000)) });

                using var stored = Image.Load(Path.Combine(folder, created.Images.Single().FileName));
                Assert.Equal(1600, stored.Width);
            }
        }

        [Collection("api")]
        public class CoverUpload : IDisposable
        {
            private readonly ApiFactory _api = new();

            [Fact]
            public async Task CoverPhotoWiderThan800IsResized()
            {
                var owner = _api.Db.AddUser("cover-owner-" + Guid.NewGuid().ToString("N")[..6]);
                var collection = _api.Db.AddCollection(owner);
                var form = new MultipartFormDataContent();
                var part = new ByteArrayContent(ItemTypeFilesTests.Jpeg(2400, 1200));
                part.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
                form.Add(part, "file", "cover.jpg");

                var response = await _api.ClientFor(owner).PostAsync($"api/Collections/CoverImage/Upload/{collection.Id}", form);

                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                var fileName = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("image").GetString()!;
                using var stored = Image.Load(Path.Combine(TestEnvironment.CollectionImages, fileName));
                Assert.Equal(800, stored.Width);
            }

            [Fact]
            public async Task FailedCoverUploadKeepsTheCurrentCover()
            {
                var owner = _api.Db.AddUser("cover-keep-" + Guid.NewGuid().ToString("N")[..6]);
                var collection = _api.Db.AddCollection(owner);
                var client = _api.ClientFor(owner);
                var first = await client.PostAsync($"api/Collections/CoverImage/Upload/{collection.Id}", Cover(ItemTypeFilesTests.Jpeg(300, 200)));
                Assert.Equal(HttpStatusCode.OK, first.StatusCode);
                var current = JsonDocument.Parse(await first.Content.ReadAsStringAsync()).RootElement.GetProperty("image").GetString()!;

                // Right type and extension, but not a decodable image.
                var broken = await client.PostAsync($"api/Collections/CoverImage/Upload/{collection.Id}",
                    Cover(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 1, 2, 3 }));

                Assert.Equal(HttpStatusCode.BadRequest, broken.StatusCode);
                Assert.True(File.Exists(Path.Combine(TestEnvironment.CollectionImages, current)));
            }

            private static MultipartFormDataContent Cover(byte[] bytes)
            {
                var form = new MultipartFormDataContent();
                var part = new ByteArrayContent(bytes);
                part.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
                form.Add(part, "file", "cover.jpg");
                return form;
            }

            public void Dispose() => _api.Dispose();
        }
    }
}
