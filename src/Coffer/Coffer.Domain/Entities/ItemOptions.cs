using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;
using Coffer.Domain.Localization;

namespace Coffer.Domain.Entities
{
    public class ItemOptions : IGenericEntity<int>
    {
        public int Id { get; set; }
        public string OptionIds { get; set; }
        [TranslatedBy(nameof(OptionLabelsTranslations))]
        public string OptionLabels { get; set; }

        /// <summary>Labels in other languages (language code → labels, same ';' order as <see cref="OptionLabels"/>).</summary>
        [JsonIgnore]
        public Dictionary<string, string> OptionLabelsTranslations { get; set; } = new();

        /// <summary>Highest option id ever given out: a removed option's id is never reused (old values keep their meaning).</summary>
        [JsonIgnore]
        public int LastOptionId { get; set; }

        [JsonIgnore]
        public ICollection<Attribute> Attributes { get; set; } = new List<Attribute>();
    }
}
