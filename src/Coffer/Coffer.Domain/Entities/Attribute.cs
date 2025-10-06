using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class Attribute : IGenericEntity<int>
    {
        public int Id { get; set; }
        public int CollectionTypeId { get; set; }
        public string Name { get; set; }
        public string DataType { get; set; }
        public bool Primary {  get; set; }
        public int? ItemOptionsId { get; set; }

        [JsonIgnore]
        public CollectionTypeProvided CollectionTypeProvided { get; set; }

        [JsonIgnore]
        public ICollection<ItemAttribute> ItemAttributes { get; set; }

        [JsonIgnore]
        public ItemOptions? ItemOptions { get; set; }
    }
}
