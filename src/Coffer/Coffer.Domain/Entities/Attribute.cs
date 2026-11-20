using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities.Interfaces;
using Coffer.Domain.Localization;

namespace Coffer.Domain.Entities
{
    public class Attribute : IGenericEntity<int>
    {
        public int Id { get; set; }
        public int CollectionTypeId { get; set; }
        [TranslatedBy(nameof(NameTranslations))]
        public string Name { get; set; }

        /// <summary>Name in other languages (language code → name); English stays in <see cref="Name"/>.</summary>
        [JsonIgnore]
        public Dictionary<string, string> NameTranslations { get; set; } = new();
        public AttributeType DataType { get; set; }
        public bool Primary {  get; set; }
        /// <summary>Must have a value before an item is added (the primary attribute always must, see <see cref="AttributeRules"/>).</summary>
        public bool Required { get; set; }
        public int? ItemOptionsId { get; set; }

        [JsonIgnore]
        public CollectionTypeProvided? CollectionTypeProvided { get; set; }

        [JsonIgnore]
        public ICollection<ItemAttribute>? ItemAttributes { get; set; }

        [JsonIgnore]
        public ItemOptions? ItemOptions { get; set; }
    }

    public static class AttributeRules
    {
        /// <summary>The primary attribute names the item, so it is always required, whatever its flag says.</summary>
        public static bool IsRequired(Attribute attribute) => attribute.Primary || attribute.Required;
    }
}
