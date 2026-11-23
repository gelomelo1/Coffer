using System.Text.RegularExpressions;
using Coffer.BusinessLogic.ItemTypes;
using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>Icons (ICONSTORE_PATH) and AI models (MODELS_PATH) of an item type: names come from the type id only.</summary>
    public class ItemTypeFilesTests
    {
        /// <summary>Sets MODELS_PATH / ICONSTORE_PATH even when no API test has run yet.</summary>
        static ItemTypeFilesTests() => TestEnvironment.Ensure();

        private static readonly byte[] PngMagic = { 0x89, 0x50, 0x4E, 0x47 };
        private static readonly ItemTypeFiles Sut = new();
        private static readonly DateTime Now = new(2026, 11, 22, 10, 30, 0, DateTimeKind.Utc);

        /// <summary>Distinct per test: the folders are shared by the whole test run.</summary>
        private static int NewTypeId() => Random.Shared.Next(100_000, 2_000_000_000);

        public static IFormFile Upload(byte[] bytes, string name, string contentType = "application/octet-stream", string field = "file") =>
            new FormFile(new MemoryStream(bytes), 0, bytes.Length, field, name) { Headers = new HeaderDictionary(), ContentType = contentType };

        public static byte[] Jpeg(int width = 32, int height = 32)
        {
            using var image = new Image<Rgba32>(width, height, new Rgba32(169, 141, 60));
            using var stream = new MemoryStream();
            image.SaveAsJpeg(stream);
            return stream.ToArray();
        }

        /// <summary>A .pt file is a ZIP archive: only the signature matters here.</summary>
        public static byte[] Model(int size = 64)
        {
            var bytes = new byte[size];
            new byte[] { 0x50, 0x4B, 0x03, 0x04 }.CopyTo(bytes, 0);
            Random.Shared.NextBytes(bytes.AsSpan(4));
            return bytes;
        }

        private static string Code(Func<Task> act) => Assert.ThrowsAsync<MarketplaceException>(act).GetAwaiter().GetResult().Code;

        [Fact]
        public async Task IconIsReencodedToPng()
        {
            var id = NewTypeId();

            var name = await Sut.SaveIconAsync(id, Upload(Jpeg(), "coin.jpg", "image/jpeg"), Now);

            Assert.Equal($"{id}_20261122103000.png", name);
            var stored = await File.ReadAllBytesAsync(Path.Combine(TestEnvironment.Icons, name));
            Assert.Equal(PngMagic, stored.Take(4));
        }

        [Fact]
        public void IconRejectsNonImage() =>
            Assert.Equal("invalidIcon", Code(() => Sut.SaveIconAsync(NewTypeId(), Upload("<svg onload=alert(1)>"u8.ToArray(), "x.png", "image/png"), Now)));

        [Fact]
        public void IconRejectsTooLarge()
        {
            Assert.Equal("invalidIcon", Code(() => Sut.SaveIconAsync(NewTypeId(), Upload(new byte[1_048_577], "big.png", "image/png"), Now)));
            Assert.Equal("invalidIcon", Code(() => Sut.SaveIconAsync(NewTypeId(), Upload(Jpeg(1100, 10), "wide.jpg", "image/jpeg"), Now)));
        }

        [Fact]
        public async Task IconNameIsValidatedOnRead()
        {
            var name = await Sut.SaveIconAsync(NewTypeId(), Upload(Jpeg(), "coin.jpg", "image/jpeg"), Now);

            Assert.Null(Sut.OpenIcon("../x.png"));
            Assert.Null(Sut.OpenIcon("..%2Fx.png"));
            Assert.Null(Sut.OpenIcon("x.svg"));
            Assert.Null(Sut.OpenIcon("missing.png"));
            var found = Sut.OpenIcon(name);
            Assert.NotNull(found);
            found!.Value.Stream.Dispose();
            Assert.Equal("image/png", found.Value.ContentType);
        }

        [Fact]
        public async Task ModelsAreStoredUnderTypeNames()
        {
            var id = NewTypeId();

            var saved = await Sut.SaveModelsAsync(id, Upload(Model(), "best.pt", field: "detection"), Upload(Model(), "anything.pt", field: "embedding"), 60, new FakeModelValidator());

            Assert.True(File.Exists(Path.Combine(TestEnvironment.Models, $"{id}_detection.pt")));
            Assert.True(File.Exists(Path.Combine(TestEnvironment.Models, $"{id}_similarity_60.pt")));
            Assert.Equal(60, Sut.Embedding(id)!.ClassCount);
            Assert.Matches(new Regex("^[0-9a-f]{64}$"), saved.DetectionSha256!);
            Assert.Matches(new Regex("^[0-9a-f]{64}$"), saved.EmbeddingSha256!);
            Assert.Empty(Directory.GetFiles(TestEnvironment.Models, $"{id}_*.uploading"));
        }

        [Fact]
        public void ModelRejectsNonZip() =>
            Assert.Equal("invalidModel", Code(() => Sut.SaveModelsAsync(NewTypeId(), Upload(new byte[] { 1, 2, 3, 4, 5 }, "x.pt"), null, null, new FakeModelValidator())));

        [Fact]
        public async Task ReplacingEmbeddingRemovesOldFile()
        {
            var id = NewTypeId();
            await Sut.SaveModelsAsync(id, null, Upload(Model(), "a.pt"), 10, new FakeModelValidator());

            await Sut.SaveModelsAsync(id, null, Upload(Model(), "b.pt"), 12, new FakeModelValidator());

            Assert.Equal(new[] { $"{id}_similarity_12.pt" }, Directory.GetFiles(TestEnvironment.Models, $"{id}_similarity_*").Select(Path.GetFileName));
        }

        [Fact]
        public void EmbeddingNeedsClassCount()
        {
            Assert.Equal("classCountRequired", Code(() => Sut.SaveModelsAsync(NewTypeId(), null, Upload(Model(), "a.pt"), null, new FakeModelValidator())));
            Assert.Equal("classCountRequired", Code(() => Sut.SaveModelsAsync(NewTypeId(), null, Upload(Model(), "a.pt"), 1, new FakeModelValidator())));
            Assert.Equal("noModelFiles", Code(() => Sut.SaveModelsAsync(NewTypeId(), null, null, null, new FakeModelValidator())));
        }

        [Fact]
        public async Task DeleteModelsRemovesOnlyThatType()
        {
            var id = NewTypeId();
            var other = NewTypeId();
            await Sut.SaveModelsAsync(id, Upload(Model(), "d.pt"), Upload(Model(), "e.pt"), 5, new FakeModelValidator());
            await Sut.SaveModelsAsync(other, Upload(Model(), "d.pt"), null, null, new FakeModelValidator());

            Sut.DeleteModels(id);

            Assert.Null(Sut.Detection(id));
            Assert.Null(Sut.Embedding(id));
            Assert.NotNull(Sut.Detection(other));
        }
    }
}
