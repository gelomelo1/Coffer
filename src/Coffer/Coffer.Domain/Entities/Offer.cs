using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class OfferRequired
    {
        public Guid TradeId { get; set; }
        public Guid UserId { get; set; }
        public int? MoneyOffer { get; set; }
        public string? Status { get; set; }

        public OfferRequired(Guid tradeId, Guid userId, int? moneyOffer = null, string? status = null)
        {
            TradeId = tradeId;
            UserId = userId;
            MoneyOffer = moneyOffer;
            Status = status;
        }
    }

    public class OfferProvided : OfferRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public TradeProvided Trade { get; set; }
        public UserProvided User { get; set; }
        public ICollection<OfferItem> OfferItems { get; set; } = new List<OfferItem>();
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public OfferProvided(Guid tradeId, Guid userId, int? moneyOffer = null, string? status = null) : base(tradeId, userId, moneyOffer, status)
        {
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
