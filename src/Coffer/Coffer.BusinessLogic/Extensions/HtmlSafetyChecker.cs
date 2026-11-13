using System;
using System.Linq;
using AngleSharp.Html.Parser;

namespace Coffer.BusinessLogic.Extensions
{
    /// <summary>
    /// Validates user supplied rich-text HTML (output of the TenTap editor) before it is stored
    /// and rendered to other users. The HTML is parsed (AngleSharp, shipped with HtmlSanitizer), so
    /// quoting tricks such as unquoted attributes cannot bypass the checks.
    /// Formatting markup is accepted; anything that can execute, embed or navigate to a
    /// non-http(s) target is rejected.
    /// </summary>
    public static class HtmlSafetyChecker
    {
        private static readonly string[] ForbiddenPatterns = { "<script", "javascript:", "data:text" };

        private static readonly string[] ForbiddenElements =
        {
            "script", "iframe", "frame", "frameset", "object", "embed", "applet", "style",
            "link", "meta", "base", "form", "svg", "math", "template"
        };

        private static readonly string[] UrlAttributes =
        {
            "href", "src", "srcset", "action", "formaction", "poster", "background", "xlink:href"
        };

        private static readonly string[] ForbiddenStyleTokens = { "expression(", "url(", "javascript:" };

        public static bool IsHtmlSafe(string htmlContent)
        {
            if (string.IsNullOrWhiteSpace(htmlContent))
                return true;

            try
            {
                foreach (var pattern in ForbiddenPatterns)
                {
                    if (htmlContent.IndexOf(pattern, StringComparison.OrdinalIgnoreCase) >= 0)
                        return false;
                }

                var document = new HtmlParser().ParseDocument(htmlContent);

                foreach (var element in document.All)
                {
                    if (ForbiddenElements.Contains(element.LocalName, StringComparer.OrdinalIgnoreCase))
                        return false;

                    foreach (var attribute in element.Attributes)
                    {
                        var name = attribute.Name;

                        if (name.StartsWith("on", StringComparison.OrdinalIgnoreCase))
                            return false;

                        if (UrlAttributes.Contains(name, StringComparer.OrdinalIgnoreCase)
                            && !IsSafeUrl(attribute.Value)
                            && !(name.Equals("src", StringComparison.OrdinalIgnoreCase) && IsInlineRasterImage(attribute.Value)))
                            return false;

                        if (name.Equals("style", StringComparison.OrdinalIgnoreCase)
                            && ForbiddenStyleTokens.Any(t => attribute.Value.Contains(t, StringComparison.OrdinalIgnoreCase)))
                            return false;
                    }
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        // Pasted images from the editor (previously accepted). SVG is excluded because it can carry script.
        private static readonly string[] InlineRasterImagePrefixes =
        {
            "data:image/png;", "data:image/jpeg;", "data:image/jpg;", "data:image/gif;", "data:image/webp;"
        };

        private static bool IsInlineRasterImage(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return false;

            var trimmed = value.Trim();
            return InlineRasterImagePrefixes.Any(p => trimmed.StartsWith(p, StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsSafeUrl(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return true;

            if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri))
                return false;

            return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
        }
    }
}
