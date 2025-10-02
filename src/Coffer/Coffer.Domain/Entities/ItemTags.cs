using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class ItemTagsRequired : IGenericEntity<int>
    {
        public int Id { get; set; }
        public Guid ItemId { get; set; }
        public string Tag { get; set; }
    }
    public class ItemTags : ItemTagsRequired
    {
        [JsonIgnore]
        public ItemProvided Item { get; set; }
    }
}
