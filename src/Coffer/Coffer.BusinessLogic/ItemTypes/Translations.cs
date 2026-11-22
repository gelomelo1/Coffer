using System.Text.RegularExpressions;
using Coffer.BusinessLogic.Marketplace.Common;

namespace Coffer.BusinessLogic.ItemTypes
{
    /// <summary>
    /// Translations of a reference text, stored as JSON: language code → text (e.g. { "hu": "Kupak" }); English stays in
    /// the plain column. Option labels translate the whole ';' list at once, part for part.
    /// </summary>
    public static class Translations
    {
        private static readonly Regex LanguageCode = new("^[a-z]{2}$", RegexOptions.CultureInvariant);

        /// <summary>Checked copy (values trimmed); null or empty → empty. Throws 400 invalidTranslations with the reason.</summary>
        public static Dictionary<string, string> Validate(Dictionary<string, string>? value, int maxLength, int? partCount = null)
        {
            var result = new Dictionary<string, string>();
            if (value == null) return result;
            foreach (var (key, raw) in value)
            {
                if (key == null || !LanguageCode.IsMatch(key))
                    throw Invalid($"\"{key}\" is not a two-letter lowercase language code.");
                if (key == "en")
                    throw Invalid("English is the main text, not a translation.");
                var text = (raw ?? "").Trim();
                if (partCount is { } parts)
                {
                    var split = text.Split(';');
                    if (split.Length != parts)
                        throw Invalid($"\"{key}\" has {split.Length} labels; the list has {parts}.");
                    if (split.Any(s => s.Trim().Length == 0 || s.Trim().Length > maxLength))
                        throw Invalid($"Every \"{key}\" label must be 1–{maxLength} characters.");
                    text = string.Join(";", split.Select(s => s.Trim()));
                }
                else if (text.Length == 0 || text.Length > maxLength)
                {
                    throw Invalid($"\"{key}\" must be 1–{maxLength} characters.");
                }
                result[key] = text;
            }
            return result;
        }

        private static MarketplaceException Invalid(string reason) =>
            MarketplaceException.Validation("invalidTranslations", $"Invalid translations: {reason}", ErrorArgs.Of(reason));
    }
}
