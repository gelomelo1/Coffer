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

        [JsonIgnore]
        public ICollection<Attribute> Attributes { get; set; } = new List<Attribute>();
    }
}
