using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class UserContactRequired
    {
        public Guid UserId { get; set; }
        public string Platform { get; set; }
        public string Value { get; set; }
        public string? Link { get; set; }

        public UserContactRequired(Guid userId, string platform, string value, string? link = null)
        {
            UserId = userId;
            Platform = platform;
            Value = value;
            Link = link;
        }
    }

    public class UserContactProvided : UserContactRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        [JsonIgnore]
        public User User { get; set; }
        public DateTime CreatedAt { get; set; }

        public UserContactProvided(Guid userId, string platform, string value, string? link = null) : base(userId, platform, value, link)
        {
            CreatedAt = DateTime.UtcNow;
        }
    }
}
