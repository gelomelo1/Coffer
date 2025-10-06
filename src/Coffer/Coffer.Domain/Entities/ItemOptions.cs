using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class ItemOptions : IGenericEntity<int>
    {
        public int Id { get; set; }
        public string OptionIds { get; set; }
        public string OptionLabels { get; set; }

        [JsonIgnore]
        public ICollection<Attribute> Attributes { get; set; } = new List<Attribute>();
    }
}
