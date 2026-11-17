using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using Coffer.Domain.Localization;

namespace Coffer.ASPNET.Extensions
{
    /// <summary>
    /// Serializes [TranslatedBy] texts in the request's UI language (set from Accept-Language by request
    /// localization), falling back to the stored English value — wherever the entity appears in a payload.
    /// </summary>
    public static class LocalizedJson
    {
        public static JsonSerializerOptions Configure(JsonSerializerOptions options)
        {
            options.TypeInfoResolver = (options.TypeInfoResolver ?? new DefaultJsonTypeInfoResolver()).WithAddedModifier(Modifier);
            return options;
        }

        public static void Modifier(JsonTypeInfo info)
        {
            if (info.Kind != JsonTypeInfoKind.Object) return;
            foreach (var property in info.Properties)
            {
                var marker = property.AttributeProvider?.GetCustomAttributes(typeof(TranslatedByAttribute), true)
                    .OfType<TranslatedByAttribute>().FirstOrDefault();
                var original = property.Get;
                if (marker == null || original == null) continue;
                var source = info.Type.GetProperty(marker.TranslationsProperty);
                if (source == null) continue;

                property.Get = owner =>
                {
                    var language = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
                    if (source.GetValue(owner) is IReadOnlyDictionary<string, string> translations
                        && translations.TryGetValue(language, out var text)
                        && !string.IsNullOrWhiteSpace(text))
                        return text;
                    return original(owner);
                };
            }
        }
    }
}
