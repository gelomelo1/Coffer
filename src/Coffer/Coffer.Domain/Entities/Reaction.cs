using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class ReactionRequired
    {
        public Guid UserId { get; set; }
        public Guid ItemId { get; set; }
        public bool Liked { get; set; }
        public int Rarity { get; set; }

        public ReactionRequired(Guid userId, Guid itemId, bool liked, int rarity)
        {
            UserId = userId;
            ItemId = itemId;
            Liked = liked;
            Rarity = rarity;
        }
    }

    public class ReactionProvided(Guid userId, Guid itemId, bool liked, int rarity) : ReactionRequired(userId, itemId, liked, rarity), IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        [JsonIgnore]
        public User User { get; set; }
        [JsonIgnore]
        public ItemProvided Item { get; set; }

        public ReactionProvided(Guid userId, Guid itemId, bool liked, int rarity, User user, ItemProvided itemProvided) : this(userId, itemId, liked, rarity)
        {
            User = user;
            Item = itemProvided;
        }
    }
}
