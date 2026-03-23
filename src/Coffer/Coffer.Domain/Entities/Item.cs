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
        public string? Description  { get; set; }
        public string? PrivateNote { get; set; }
        public int Quantity { get; set; }
        public string Image {  get; set; }
        public ICollection<ItemAttributeRequired> ItemAttributes { get; set; } = new List<ItemAttributeRequired>();
        public ICollection<ItemTagsRequired> ItemTags { get; set; } = new List<ItemTagsRequired>();

        public ItemRequired(Guid collectionId, int quantity, string image, string? description = null, string? privateNote = null)
        {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            PrivateNote = privateNote;
        }

        [JsonConstructor]
        public ItemRequired(Guid collectionId, int quantity, string image, ICollection<ItemAttributeRequired> itemAttributes, ICollection<ItemTagsRequired> itemTags, string? description = null, string? privateNote = null) {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            ItemAttributes = itemAttributes;
            ItemTags = itemTags;
            PrivateNote = privateNote;
        }
    }

    public class ItemProvided : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public Guid CollectionId { get; set; }
        public string? Description { get; set; }
        public string? PrivateNote { get; set; }
        public int Quantity { get; set; }
        public string Image { get; set; }
        public ICollection<ItemAttribute> ItemAttributes { get; set; } = new List<ItemAttribute>();
        public ICollection<ItemTags> ItemTags { get; set; } = new List<ItemTags>();
        public ICollection<ReactionProvided> Reactions { get; set; } = new List<ReactionProvided>();
        [JsonIgnore]
        public CollectionProvided Collection;
        public DateTime AcquiredAt { get; set; }

        public ItemProvided(Guid collectionId, int quantity, string image, string? description = null, string? privateNote = null)
        {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            AcquiredAt = DateTime.UtcNow;
            PrivateNote = privateNote;
        }

        public ItemProvided(Guid collectionId, int quantity, string image, DateTime acquiredAt, ICollection<ItemAttribute> itemAttributes, ICollection<ItemTags> itemTags, string? description = null, string? privateNote = null)
        {
            CollectionId = collectionId;
            Description = description;
            Quantity = quantity;
            Image = image;
            ItemAttributes = itemAttributes;
            ItemTags = itemTags;
            AcquiredAt = acquiredAt;
            PrivateNote = privateNote;
        }

        public ItemProvided(Guid collectionId, int quantity, string image, DateTime acquiredAt, ICollection<ItemAttribute> itemAttributes, ICollection<ItemTags> itemTags, ICollection<ReactionProvided> reactions, CollectionProvided collection, string? description = null, string? privateNote = null)
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
            PrivateNote = privateNote;
        }

        public ItemProvided() { }
    }
}
