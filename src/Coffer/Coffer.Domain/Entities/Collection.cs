using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class CollectionRequired
    {
        public Guid UserId { get; set; }
        public int CollectionTypeId { get; set; }
        public string Name { get; set; }

        public CollectionRequired(Guid userId, int collectionTypeId, string name)
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
        public ICollection<FollowProvided> Follows { get; set; } = new List<FollowProvided>();
        [JsonIgnore]
        public User User { get; set; }
        public DateTime CreatedAt { get; set; }

        public CollectionProvided(Guid userId, int collectionTypeId, string name, string? image = null) : base(userId, collectionTypeId, name)
        {
            Image = image;
            CreatedAt = DateTime.UtcNow;
        }

        public CollectionProvided(Guid userId, int collectionTypeId, string name,  User user, string? image = null) : base(userId, collectionTypeId, name)
        {
            User = user;
            Image = image;
            CreatedAt = DateTime.UtcNow;
        }
    }
}
