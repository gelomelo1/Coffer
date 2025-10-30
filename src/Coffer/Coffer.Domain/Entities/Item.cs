using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class ItemRequired
    {
        public Guid CollectionId { get; set; }
        public string Description  { get; set; }
        public int Quantity { get; set; }
        public string Image {  get; set; }
        public ICollection<ItemAttributeRequired> ItemAttributes { get; set; } = new List<ItemAttributeRequired>();
        public ICollection<ItemTagsRequired> ItemTags { get; set; } = new List<ItemTagsRequired>();

        public ItemRequired(Guid collectionId, string description, int quantity, string image)
        {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
        }

        [JsonConstructor]
        public ItemRequired(Guid collectionId, string description, int quantity, string image, ICollection<ItemAttributeRequired> itemAttributes, ICollection<ItemTagsRequired> itemTags) {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            ItemAttributes = itemAttributes;
            ItemTags = itemTags;
        }
    }

    public class ItemProvided : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public Guid CollectionId { get; set; }
        public string Description { get; set; }
        public int Quantity { get; set; }
        public string Image { get; set; }
        public ICollection<ItemAttribute> ItemAttributes { get; set; } = new List<ItemAttribute>();
        public ICollection<ItemTags> ItemTags { get; set; } = new List<ItemTags>();
        public ICollection<ReactionProvided> Reactions { get; set; } = new List<ReactionProvided>();
        [JsonIgnore]
        public CollectionProvided Collection;
        public DateTime AcquiredAt { get; set; }

        public ItemProvided(Guid collectionId, string description, int quantity, string image)
        {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            AcquiredAt = DateTime.UtcNow;
        }

        public ItemProvided(Guid collectionId, string description, int quantity, string image, DateTime acquiredAt, ICollection<ItemAttribute> itemAttributes, ICollection<ItemTags> itemTags)
        {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            ItemAttributes = itemAttributes;
            ItemTags = itemTags;
            AcquiredAt = acquiredAt;
        }

        public ItemProvided(Guid collectionId, string description, int quantity, string image, DateTime acquiredAt, ICollection<ItemAttribute> itemAttributes, ICollection<ItemTags> itemTags, ICollection<ReactionProvided> reactions, CollectionProvided collection)
        {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            ItemAttributes = itemAttributes;
            ItemTags = itemTags;
            AcquiredAt = acquiredAt;
            Reactions = reactions;
            Collection = collection;
        }

        public ItemProvided() { }
    }
}
