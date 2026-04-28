using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class UserContactRequired
    {
        public Guid UserId { get; set; }
        public UserContactPlatform Platform { get; set; }
        public string Value { get; set; }
        public string? Link { get; set; }

        public UserContactRequired(Guid userId, UserContactPlatform platform, string value, string? link = null)
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
        [NotMapped]
        public string? FullUrl => !string.IsNullOrEmpty(Link) ? $"https://www.facebook.com/{Link}" : null;

        public UserContactProvided(Guid userId, UserContactPlatform platform, string value, string? link = null) : base(userId, platform, value, link)
        {
            CreatedAt = DateTime.UtcNow;
        }
    }
}
