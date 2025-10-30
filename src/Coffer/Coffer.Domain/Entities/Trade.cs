using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class TradeRequired
    {
        public Guid UserId { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string? WantDescription { get; set; }
        public int? MoneyRequested { get; set; }
        public ICollection<TradeItem> TradeItems { get; set; } = new List<TradeItem>();

        public TradeRequired(Guid userId, string title, string description, string? wantDescription = null, int? moneyRequested = null)
        {
            UserId = userId;
            Title = title;
            Description = description;
            WantDescription = wantDescription;
            MoneyRequested = moneyRequested;
        }
    }

    public class TradeProvided : TradeRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public User User { get; set; }
        public ICollection<OfferProvided> Offers { get; set; } = new List<OfferProvided>();
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public TradeProvided(Guid userId, string title, string description, string? wantDescription = null, int? moneyRequested = null) : base(userId, title, description, wantDescription, moneyRequested)
        {
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
