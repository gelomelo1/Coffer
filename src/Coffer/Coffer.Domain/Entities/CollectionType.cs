using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json.Serialization;
using Coffer.Domain.Entities.Interfaces;
using Coffer.Domain.Localization;

namespace Coffer.Domain.Entities
{
    public class CollectionTypeRequired
    {
        [TranslatedBy(nameof(NameTranslations))]
        public string Name { get; set; }

        /// <summary>Name in other languages (language code → name); English stays in <see cref="Name"/>.</summary>
        [JsonIgnore]
        public Dictionary<string, string> NameTranslations { get; set; } = new();
        public string Description { get; set; }
        public string Color { get; set; }
        public string Icon { get; set; }

        public CollectionTypeRequired(string name, string description, string color, string icon)
        {
            Name = name;
            Description = description;
            Color = color;
            Icon = icon;
        }
    }

    public class CollectionTypeProvided : CollectionTypeRequired, IGenericEntity<int>
    {
        public int Id { get; set; }
        public DateTime CreatedAt { get; set; }

        public ICollection<Attribute> Attributes { get; set; } = new List<Attribute>();

        public CollectionTypeProvided(string name, string description, string color, string icon, ICollection<Attribute> attributes) : base(name, description, color, icon)
        {
            CreatedAt = DateTime.UtcNow;
            Attributes = attributes;
        }

        public CollectionTypeProvided(string name, string description, string color, string icon) : base(name, description, color, icon)
        {
            CreatedAt = DateTime.UtcNow;
        }
    }
}
