using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{

    public class UserRequired
    {
        public string Provider { get; set; }
        public string ProviderUserId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Country { get; set; }
        public string? Avatar { get; set; }
        public UserRole? Role { get; set; }

        public UserRequired(string provider, string providerUserId, string name, string email, string country, string? avatar = null, UserRole? role = null)
        {
            Provider = provider;
            ProviderUserId = providerUserId;
            Name = name;
            Email = email;
            Country = country;
            Avatar = avatar;
            Role = role ?? null;
        }
    }

    public class UserProvided : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public DateTime CreatedAt { get; set; }
        public string Provider { get; set; }
        public string Country { get; set; }
        public UserRole Role { get; set; }
        public string? Avatar { get; set; }

        public ICollection<UserContactProvided> Contacts { get; set; } = new List<UserContactProvided>();

        protected UserProvided() { }

        public UserProvided(string name, string email, string provider, string country, UserRole role, string? avatar)
        {
            Name = name;
            Email = email;
            CreatedAt = DateTime.UtcNow;
            Provider = provider;
            Country = country;
            Avatar = avatar;
            Role = role;
        }
    }

    public class User: UserProvided
    {
        public string ProviderUserId { get; set; }

        public User() { }

        public User(string name, string email, string provider, string country, string providerUserId, string? avatar = null, UserRole? role = UserRole.User) : base(name, email, provider, country, role.GetValueOrDefault(), avatar)
        {
            Provider = provider;
            ProviderUserId = providerUserId;
        }
    }
}
