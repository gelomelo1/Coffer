namespace Coffer.Domain.Localization
{
    /// <summary>
    /// Marks an English reference-data text whose other languages live in a dictionary property
    /// (language code → text, e.g. { "hu": "Kupak" }). The API serializes the request language's text, falling back
    /// to the English value of the marked property.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class TranslatedByAttribute : System.Attribute
    {
        public string TranslationsProperty { get; }

        public TranslatedByAttribute(string translationsProperty) => TranslationsProperty = translationsProperty;
    }
}
