using Coffer.BusinessLogic.ItemTypes;
using Coffer.BusinessLogic.Marketplace.Common;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>Translation JSON (language code → text) as the Manager sends it: checked before it is stored.</summary>
    public class TranslationsTests
    {
        private static string CodeOf(Action act) => Assert.Throws<MarketplaceException>(act).Code;

        [Fact]
        public void EmptyOrNullIsEmpty()
        {
            Assert.Empty(Translations.Validate(null, 60));
            Assert.Empty(Translations.Validate(new Dictionary<string, string>(), 60));
        }

        [Fact]
        public void AcceptsLanguageCodes()
        {
            var result = Translations.Validate(new Dictionary<string, string> { ["hu"] = " Kupak ", ["de"] = "Kronkorken" }, 60);

            Assert.Equal("Kupak", result["hu"]);
            Assert.Equal("Kronkorken", result["de"]);
        }

        [Fact]
        public void RejectsEnglishKey() =>
            Assert.Equal("invalidTranslations", CodeOf(() => Translations.Validate(new Dictionary<string, string> { ["en"] = "Cap" }, 60)));

        [Theory]
        [InlineData("HU")]
        [InlineData("hun")]
        [InlineData("h")]
        [InlineData("")]
        public void RejectsBadKey(string key) =>
            Assert.Equal("invalidTranslations", CodeOf(() => Translations.Validate(new Dictionary<string, string> { [key] = "Kupak" }, 60)));

        [Fact]
        public void RejectsEmptyOrTooLongValue()
        {
            Assert.Equal("invalidTranslations", CodeOf(() => Translations.Validate(new Dictionary<string, string> { ["hu"] = "  " }, 60)));
            Assert.Equal("invalidTranslations", CodeOf(() => Translations.Validate(new Dictionary<string, string> { ["hu"] = new string('a', 61) }, 60)));
        }

        [Fact]
        public void OptionLabelsMustMatchPartCount()
        {
            Assert.Equal("invalidTranslations", CodeOf(() => Translations.Validate(new Dictionary<string, string> { ["hu"] = "A;B" }, 60, partCount: 3)));
            Assert.Equal("invalidTranslations", CodeOf(() => Translations.Validate(new Dictionary<string, string> { ["hu"] = "A;;C" }, 60, partCount: 3)));
            Assert.Equal("Logó;Zászló;Tájkép", Translations.Validate(new Dictionary<string, string> { ["hu"] = "Logó;Zászló;Tájkép" }, 60, partCount: 3)["hu"]);
        }
    }
}
