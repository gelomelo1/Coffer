using System.Text.RegularExpressions;
using DotNetEnv;

namespace Coffer.BusinessLogic.ItemTypes
{
    /// <summary>An AI model file of an item type, as found in MODELS_PATH.</summary>
    public sealed record ModelFileDto(string FileName, long Bytes, DateTime UploadedAt, int? ClassCount);

    /// <summary>
    /// The files that belong to an item type: its two AI models in MODELS_PATH (read by the AI service on every photo
    /// check) — "{id}_detection.pt" and "{id}_similarity_{classCount}.pt".
    /// </summary>
    public interface IItemTypeFiles
    {
        ModelFileDto? Detection(int typeId);
        ModelFileDto? Embedding(int typeId);
    }

    public sealed class ItemTypeFiles : IItemTypeFiles
    {
        public static string ModelsFolder => Env.GetString("MODELS_PATH") ?? throw new InvalidOperationException("MODELS_PATH environmental variable is not set");

        public ModelFileDto? Detection(int typeId) => Describe(Path.Combine(ModelsFolder, $"{typeId}_detection.pt"), null);

        public ModelFileDto? Embedding(int typeId)
        {
            if (!Directory.Exists(ModelsFolder)) return null;
            var pattern = new Regex($"^{typeId}_similarity_([0-9]+)\\.pt$", RegexOptions.CultureInvariant);
            foreach (var path in Directory.EnumerateFiles(ModelsFolder).OrderBy(p => p, StringComparer.Ordinal))
            {
                var match = pattern.Match(Path.GetFileName(path));
                if (match.Success) return Describe(path, int.Parse(match.Groups[1].Value));
            }
            return null;
        }

        private static ModelFileDto? Describe(string path, int? classCount)
        {
            if (!File.Exists(path)) return null;
            var info = new FileInfo(path);
            return new ModelFileDto(info.Name, info.Length, DateTime.SpecifyKind(info.LastWriteTimeUtc, DateTimeKind.Utc), classCount);
        }
    }
}
