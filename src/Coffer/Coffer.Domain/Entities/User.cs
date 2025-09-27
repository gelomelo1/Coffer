using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{

    public class UserRequired
    {
        public string Provider { get; set; }
        public string ProviderUserId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }

        public UserRequired(string provider, string providerUserId, string name, string email)
        {
            Provider = provider;
            ProviderUserId = providerUserId;
            Name = name;
            Email = email;
        }
    }

    public class UserProvided : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public DateTime CreatedAt { get; set; }

        public UserProvided(string name, string email)
        {
            Name = name;
            Email = email;
            CreatedAt = DateTime.UtcNow;
        }
    }

    public class User: UserProvided
    {
        public string Provider { get; set; }
        public string ProviderUserId { get; set; }

        public User(string name, string email, string provider, string providerUserId) : base(name, email)
        {
            Provider = provider;
            ProviderUserId = providerUserId;
        }
    }
}
