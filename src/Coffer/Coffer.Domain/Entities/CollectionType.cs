using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class CollectionTypeRequired
    {
        public string Name { get; set; }
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

    public class CollectionTypeProvided : CollectionTypeRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public DateTime CreatedAt { get; set; }

        public CollectionTypeProvided(string name, string description, string color, string icon) : base(name, description, color, icon)
        {
            CreatedAt = DateTime.UtcNow;
        }
    }
}
