using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class FollowRequired
    {
        public Guid UserId { get; set; }
        public Guid CollectionId { get; set; }

        public FollowRequired(Guid userId, Guid collectionId) 
        {
            UserId = userId;
            CollectionId = collectionId;
        }
    }

    public class FollowProvided : FollowRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        [JsonIgnore]
        public User User { get; set; }
        [JsonIgnore]
        public CollectionProvided Collection {  get; set; }
        public DateTime FollowedAt { get; set; }

        public FollowProvided(Guid userId, Guid collectionId) : base(userId, collectionId) { }

        public FollowProvided(Guid userId, Guid collectionId, User user, CollectionProvided collectionProvided) : base(userId, collectionId)
        {
            User = user;
            Collection = collectionProvided;
            FollowedAt = DateTime.UtcNow;
        }
    }
}
