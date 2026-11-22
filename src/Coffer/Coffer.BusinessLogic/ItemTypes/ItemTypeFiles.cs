using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Coffer.BusinessLogic.Marketplace.Common;
using DotNetEnv;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;

namespace Coffer.BusinessLogic.ItemTypes
{
    /// <summary>An AI model file of an item type, as found in MODELS_PATH.</summary>
    public sealed record ModelFileDto(string FileName, long Bytes, DateTime UploadedAt, int? ClassCount);

    /// <summary>What a model upload stored, with the SHA-256 of each file (for the audit log).</summary>
    public sealed record SavedModels(ModelFileDto? Detection, ModelFileDto? Embedding, string? DetectionSha256, string? EmbeddingSha256);

    /// <summary>
    /// The files that belong to an item type. Icons live in ICONSTORE_PATH ("{id}_{yyyyMMddHHmmss}.png", or the two
    /// legacy names "cap.png" / "stamp.png"); the two AI models in MODELS_PATH, read by the AI service on every photo
    /// check: "{id}_detection.pt" and "{id}_similarity_{classCount}.pt". File names are always built here from the type
    /// id — nothing the client sends ever becomes a path.
    /// </summary>
    public interface IItemTypeFiles
    {
        ModelFileDto? Detection(int typeId);
        ModelFileDto? Embedding(int typeId);
        /// <summary>Checks and re-encodes the picture to PNG (drops anything hidden in the file); returns the new name.</summary>
        Task<string> SaveIconAsync(int typeId, IFormFile file, DateTime now);
        void DeleteIcon(string? fileName);
        /// <summary>Null when the name is not a valid icon name or the file is missing.</summary>
        (Stream Stream, string ContentType)? OpenIcon(string fileName);
        Task<SavedModels> SaveModelsAsync(int typeId, IFormFile? detection, IFormFile? embedding, int? classCount);
        void DeleteModels(int typeId);
    }

    public sealed class ItemTypeFiles : IItemTypeFiles
    {
        public const long MaxIconBytes = 1_048_576;
        public const int MaxIconSide = 1024;
        public const long MaxModelBytes = 300L * 1024 * 1024;
        public const int MinClassCount = 2;
        public const int MaxClassCount = 100_000;

        private static readonly Regex IconName = new("^([0-9]+_[0-9]{14}|[a-z0-9_-]{1,40})\\.png$", RegexOptions.CultureInvariant);
        private static readonly byte[] ZipMagic = { 0x50, 0x4B, 0x03, 0x04 };

        /// <summary>Only these formats are even tried when reading an uploaded icon.</summary>
        private static readonly DecoderOptions IconDecoder = new()
        {
            Configuration = new Configuration(new PngConfigurationModule(), new JpegConfigurationModule(), new WebpConfigurationModule()),
            MaxFrames = 1,
        };

        private static MarketplaceException InvalidModel() => MarketplaceException.Validation("invalidModel", "A model file must be a PyTorch .pt file of at most 300 MB.");

        public static string ModelsFolder => Env.GetString("MODELS_PATH") ?? throw new InvalidOperationException("MODELS_PATH environmental variable is not set");
        public static string IconsFolder => Env.GetString("ICONSTORE_PATH") ?? throw new InvalidOperationException("ICONSTORE_PATH environmental variable is not set");

        // ------------------------------------------------------------------ models

        public ModelFileDto? Detection(int typeId) => Describe(Path.Combine(ModelsFolder, DetectionName(typeId)), null);

        public ModelFileDto? Embedding(int typeId)
        {
            foreach (var (path, classCount) in EmbeddingFiles(typeId)) return Describe(path, classCount);
            return null;
        }

        public async Task<SavedModels> SaveModelsAsync(int typeId, IFormFile? detection, IFormFile? embedding, int? classCount)
        {
            if (detection == null && embedding == null)
                throw MarketplaceException.Validation("noModelFiles", "Choose the detection model, the embedding model, or both.");
            if (embedding != null && (classCount is null || classCount < MinClassCount || classCount > MaxClassCount))
                throw MarketplaceException.Validation("classCountRequired", "The embedding model needs its class count (2–100000).");
            foreach (var file in new[] { detection, embedding }.Where(f => f != null)) await CheckModelAsync(file!);

            Directory.CreateDirectory(ModelsFolder);
            string? detectionSha = null, embeddingSha = null;
            if (detection != null)
                detectionSha = await WriteAtomicallyAsync(detection, Path.Combine(ModelsFolder, DetectionName(typeId)));
            if (embedding != null)
            {
                var name = $"{typeId}_similarity_{classCount}.pt";
                embeddingSha = await WriteAtomicallyAsync(embedding, Path.Combine(ModelsFolder, name));
                // The AI service takes the first match: older embeddings of this type must go.
                foreach (var old in EmbeddingFiles(typeId).Where(f => Path.GetFileName(f.Path) != name)) File.Delete(old.Path);
            }
            return new SavedModels(Detection(typeId), Embedding(typeId), detectionSha, embeddingSha);
        }

        public void DeleteModels(int typeId)
        {
            var detection = Path.Combine(ModelsFolder, DetectionName(typeId));
            if (File.Exists(detection)) File.Delete(detection);
            foreach (var file in EmbeddingFiles(typeId)) File.Delete(file.Path);
        }

        private static string DetectionName(int typeId) => $"{typeId}_detection.pt";

        private static IEnumerable<(string Path, int ClassCount)> EmbeddingFiles(int typeId)
        {
            if (!Directory.Exists(ModelsFolder)) yield break;
            var pattern = new Regex($"^{typeId}_similarity_([0-9]+)\\.pt$", RegexOptions.CultureInvariant);
            foreach (var path in Directory.EnumerateFiles(ModelsFolder).OrderBy(p => p, StringComparer.Ordinal))
            {
                var match = pattern.Match(Path.GetFileName(path));
                if (match.Success && int.TryParse(match.Groups[1].Value, out var count)) yield return (path, count);
            }
        }

        private static async Task CheckModelAsync(IFormFile file)
        {
            if (file.Length < ZipMagic.Length || file.Length > MaxModelBytes)
                throw InvalidModel();
            var header = new byte[ZipMagic.Length];
            await using var stream = file.OpenReadStream();
            var read = await stream.ReadAsync(header);
            if (read != ZipMagic.Length || !header.SequenceEqual(ZipMagic))
                throw InvalidModel();
        }

        /// <summary>Copies to "{target}.uploading", then moves into place: the AI service never reads half a file.</summary>
        private static async Task<string> WriteAtomicallyAsync(IFormFile file, string target)
        {
            var temp = target + ".uploading";
            try
            {
                using var sha = SHA256.Create();
                await using (var output = File.Create(temp))
                await using (var input = file.OpenReadStream())
                await using (var hashing = new CryptoStream(output, sha, CryptoStreamMode.Write))
                {
                    await input.CopyToAsync(hashing);
                }
                File.Move(temp, target, overwrite: true);
                return Convert.ToHexString(sha.Hash!).ToLowerInvariant();
            }
            finally
            {
                if (File.Exists(temp)) File.Delete(temp);
            }
        }

        private static ModelFileDto? Describe(string path, int? classCount)
        {
            if (!File.Exists(path)) return null;
            var info = new FileInfo(path);
            return new ModelFileDto(info.Name, info.Length, DateTime.SpecifyKind(info.LastWriteTimeUtc, DateTimeKind.Utc), classCount);
        }

        // ------------------------------------------------------------------ icons

        public async Task<string> SaveIconAsync(int typeId, IFormFile file, DateTime now)
        {
            if (file == null || file.Length == 0 || file.Length > MaxIconBytes)
                throw InvalidIcon();
            Image image;
            try
            {
                await using var input = file.OpenReadStream();
                image = await Image.LoadAsync(IconDecoder, input);
            }
            catch (Exception e) when (e is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                throw InvalidIcon();
            }
            using (image)
            {
                if (image.Width > MaxIconSide || image.Height > MaxIconSide)
                    throw InvalidIcon();
                image.Metadata.ExifProfile = null;
                image.Metadata.XmpProfile = null;
                image.Metadata.IccProfile = null;
                Directory.CreateDirectory(IconsFolder);
                var name = $"{typeId}_{now:yyyyMMddHHmmss}.png";
                await image.SaveAsPngAsync(Path.Combine(IconsFolder, name));
                return name;
            }
        }

        public void DeleteIcon(string? fileName)
        {
            if (string.IsNullOrEmpty(fileName) || !IconName.IsMatch(fileName)) return;
            var path = Path.Combine(IconsFolder, fileName);
            if (File.Exists(path)) File.Delete(path);
        }

        public (Stream Stream, string ContentType)? OpenIcon(string fileName)
        {
            if (string.IsNullOrEmpty(fileName) || !IconName.IsMatch(fileName)) return null;
            var path = Path.Combine(IconsFolder, fileName);
            if (!File.Exists(path)) return null;
            return (File.OpenRead(path), "image/png");
        }

        public static MarketplaceException InvalidIcon() => MarketplaceException.Validation("invalidIcon", "An icon must be a PNG, JPEG or WebP picture of at most 1 MB and 1024×1024 pixels.");
    }
}

namespace Coffer.BusinessLogic.ItemTypes
{
    /// <summary>
    /// Icons used to ship inside the API (wwwroot/icons); they now live in the icon store. At startup the shipped PNGs
    /// are copied over when missing — never overwriting what an administrator uploaded.
    /// </summary>
    public static class IconSeed
    {
        public static int CopyMissing(string sourceFolder, string targetFolder)
        {
            if (!Directory.Exists(sourceFolder)) return 0;
            Directory.CreateDirectory(targetFolder);
            var copied = 0;
            foreach (var source in Directory.EnumerateFiles(sourceFolder, "*.png"))
            {
                var target = Path.Combine(targetFolder, Path.GetFileName(source));
                if (File.Exists(target)) continue;
                File.Copy(source, target);
                copied++;
            }
            return copied;
        }
    }
}
