using System.Globalization;
using System.Text.Json;
using Coffer.ASPNET.Extensions;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.Tests
{
    /// <summary>
    /// Reference names (collection types, attributes, item option labels) keep English in their own column and other
    /// languages in a JSON column; the API serializes the request language's name, falling back to English.
    /// </summary>
    public class LocalizedNameTests : IDisposable
    {
        private readonly CultureInfo _savedUi = CultureInfo.CurrentUICulture;

        private static readonly JsonSerializerOptions Options = LocalizedJson.Configure(new JsonSerializerOptions(JsonSerializerDefaults.Web));

        private static JsonElement Serialize(object value, string uiCulture)
        {
            CultureInfo.CurrentUICulture = new CultureInfo(uiCulture);
            return JsonSerializer.SerializeToElement(value, Options);
        }

        private static CollectionTypeProvided Caps() =>
            new("Cap", "desc", "#fff", "icon") { NameTranslations = new() { ["hu"] = "Kupak" } };

        [Fact]
        public void Name_IsTranslated_ForTheRequestLanguage()
        {
            Assert.Equal("Kupak", Serialize(Caps(), "hu-HU").GetProperty("name").GetString());
        }

        [Fact]
        public void Name_FallsBackToEnglish_WithoutATranslation()
        {
            Assert.Equal("Cap", Serialize(Caps(), "de-DE").GetProperty("name").GetString());
            Assert.Equal("Cap", Serialize(Caps(), "en-US").GetProperty("name").GetString());
        }

        [Fact]
        public void TranslationColumns_AreNotPartOfThePayload()
        {
            Assert.False(Serialize(Caps(), "hu").TryGetProperty("nameTranslations", out _));
        }

        [Fact]
        public void NestedNames_AndOptionLabels_AreTranslatedToo()
        {
            var attribute = new Domain.Entities.Attribute { Name = "Brewery", NameTranslations = new() { ["hu"] = "Sörfőzde" } };
            var options = new ItemOptions { OptionIds = "1;2", OptionLabels = "Red;Green", OptionLabelsTranslations = new() { ["hu"] = "Piros;Zöld" } };

            var json = Serialize(new { attributes = new[] { attribute }, options }, "hu");

            Assert.Equal("Sörfőzde", json.GetProperty("attributes")[0].GetProperty("name").GetString());
            Assert.Equal("Piros;Zöld", json.GetProperty("options").GetProperty("optionLabels").GetString());
        }

        [Fact]
        public void Translations_RoundTripThroughTheDatabase()
        {
            using var db = new TestDb();
            db.Context.CollectionTypes.Add(Caps());
            db.Context.SaveChanges();

            using var fresh = db.NewContext();
            var loaded = fresh.CollectionTypes.AsNoTracking().Single(t => t.Name == "Cap");
            Assert.Equal("Kupak", loaded.NameTranslations["hu"]);
        }

        public void Dispose() => CultureInfo.CurrentUICulture = _savedUi;
    }
}
