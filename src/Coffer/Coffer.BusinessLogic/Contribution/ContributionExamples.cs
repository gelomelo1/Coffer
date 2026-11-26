using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Contribution
{
    public sealed record ExamplesDto(List<string> Detection, List<string> Classification);

    public interface IContributionExamples
    {
        ExamplesDto List();

        /// <summary>An example image, or null for an unknown form, a name outside the pattern or a missing file.</summary>
        (Stream Stream, string ContentType)? Open(string form, string fileName);
    }

    /// <summary>
    /// The example galleries the admin fills by hand (AppPaths.Contributions/examples/{detection|classification}/):
    /// images shown in file name order; the folder is read on request and cached for a minute.
    /// </summary>
    public sealed partial class ContributionExamples : IContributionExamples
    {
        public static readonly string[] Forms = { "detection", "classification" };
        private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(1);
        private readonly IMemoryCache _cache;

        public ContributionExamples(IMemoryCache cache)
        {
            _cache = cache;
        }

        [GeneratedRegex(@"^[A-Za-z0-9._-]{1,100}\.(jpg|jpeg|png|webp)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
        private static partial Regex FileName();

        public ExamplesDto List() => new(Read("detection"), Read("classification"));

        public (Stream Stream, string ContentType)? Open(string form, string fileName)
        {
            if (!Forms.Contains(form) || !FileName().IsMatch(fileName)) return null;
            var path = Path.Combine(ContributionStorage.ExamplesDir(form), fileName);
            if (!File.Exists(path)) return null;
            var contentType = Path.GetExtension(fileName).ToLowerInvariant() switch
            {
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => "image/jpeg",
            };
            return (File.OpenRead(path), contentType);
        }

        private List<string> Read(string form) =>
            _cache.GetOrCreate($"contribution-examples:{form}", entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheFor;
                var dir = ContributionStorage.ExamplesDir(form);
                if (!Directory.Exists(dir)) return new List<string>();
                return Directory.GetFiles(dir).Select(Path.GetFileName).OfType<string>()
                    .Where(n => FileName().IsMatch(n)).OrderBy(n => n, StringComparer.Ordinal).ToList();
            })!;
    }
}
