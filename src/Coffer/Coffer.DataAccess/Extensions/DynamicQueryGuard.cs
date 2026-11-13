using System.Text.RegularExpressions;

namespace Coffer.DataAccess.Extensions
{
    /// <summary>
    /// The generic GET endpoints pass the client's "filter" / "orderBy" strings to System.Linq.Dynamic.Core.
    /// Fields that are hidden from other users in API responses (private notes, e-mail, OAuth subject id)
    /// must not be usable there either, otherwise they can be extracted one character at a time with
    /// filters such as PrivateNote.StartsWith("a").
    /// String literals are ignored, so user search text (e.g. "email me") is still allowed.
    /// </summary>
    public static class DynamicQueryGuard
    {
        private static readonly Regex StringLiterals = new("\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'", RegexOptions.Compiled);
        private static readonly Regex HiddenFields = new(@"\b(PrivateNote|Email|ProviderUserId)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public static bool IsAllowed(string? expression)
        {
            if (string.IsNullOrWhiteSpace(expression))
                return true;

            var withoutLiterals = StringLiterals.Replace(expression, "\"\"");
            return !HiddenFields.IsMatch(withoutLiterals);
        }
    }
}
