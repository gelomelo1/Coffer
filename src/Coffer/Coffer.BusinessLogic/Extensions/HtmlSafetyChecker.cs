using System;
using System.Linq;
using System.Text.RegularExpressions;
using Ganss.Xss;

namespace Coffer.BusinessLogic.Extensions
{
    public static class HtmlSafetyChecker
    {
        public static bool IsHtmlSafe(string htmlContent)
        {
            if (string.IsNullOrWhiteSpace(htmlContent))
                return true;

            try
            {
                string[] forbiddenPatterns = { "<script", "javascript:", "data:text" };
                foreach (var pattern in forbiddenPatterns)
                {
                    if (htmlContent.IndexOf(pattern, StringComparison.OrdinalIgnoreCase) >= 0)
                        return false;
                }

                var sanitizer = new HtmlSanitizer();
                sanitizer.AllowedTags.Clear();
                sanitizer.AllowedTags.Add("p");
                sanitizer.AllowedTags.Add("b");
                sanitizer.AllowedTags.Add("i");
                sanitizer.AllowedTags.Add("u");
                sanitizer.AllowedTags.Add("a");
                sanitizer.AllowedTags.Add("ul");
                sanitizer.AllowedTags.Add("ol");
                sanitizer.AllowedTags.Add("li");
                sanitizer.AllowedTags.Add("br");

                sanitizer.AllowedAttributes.Clear();
                sanitizer.AllowedAttributes.Add("href");

                var cleanHtml = sanitizer.Sanitize(htmlContent);

                var hrefRegex = new Regex(@"<a[^>]+href\s*=\s*['""]([^'""]+)['""]", RegexOptions.IgnoreCase);
                var matches = hrefRegex.Matches(htmlContent);

                foreach (Match match in matches)
                {
                    if (match.Groups.Count < 2)
                        continue;

                    var href = match.Groups[1].Value;

                    if (string.IsNullOrWhiteSpace(href))
                        continue;

                    if (!Uri.TryCreate(href, UriKind.Absolute, out var uri))
                        return false;

                    if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                        return false;
                }

                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
