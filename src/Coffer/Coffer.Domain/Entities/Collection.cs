using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class CollectionRequired
    {
        public Guid UserId { get; set; }
        public Guid CollectionTypeId { get; set; }
        public string Name { get; set; }

        public CollectionRequired(Guid userId, Guid collectionTypeId, string name)
        {
            UserId = userId;
            CollectionTypeId = collectionTypeId;
            Name = name;
        }
    }

    public class CollectionProvided : CollectionRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public string? Image { get; set; }

        public DateTime CreatedAt { get; set; }

        public CollectionProvided(Guid userId, Guid collectionTypeId, string name, string? image = null) : base(userId, collectionTypeId, name)
        {
            UserId = userId;
            CollectionTypeId = collectionTypeId;
            Image = image;
            CreatedAt = DateTime.UtcNow;
        }
    }
}
