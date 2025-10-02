using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class ItemAttributeRequired : IGenericEntity<int>
    {
        public int Id { get; set; }
        public Guid ItemId { get; set; }
        public int AttributeId { get; set; }
        public string? ValueString { get; set; }
        public int? ValueNumber { get; set; }
        public DateTime? ValueDate { get; set; }
        public bool? ValueBoolean { get; set; }
    }
    public class ItemAttribute : ItemAttributeRequired
    {
        public Attribute Attribute { get; set; }
        [JsonIgnore]
        public ItemProvided ItemProvided { get; set; }
    }
}
