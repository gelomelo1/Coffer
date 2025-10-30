using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class TradeReviewRequired
    {
        public Guid TradeId { get; set; }
        public Guid? ReviewerId { get; set; }
        public Guid RevieweeId { get; set; }
        public bool Rating { get; set; }
        public string Comment { get; set; }

        public TradeReviewRequired(Guid tradeId, Guid? reviewerId, Guid revieweeId, bool rating, string comment)
        {
            TradeId = tradeId;
            ReviewerId = reviewerId;
            RevieweeId = revieweeId;
            Rating = rating;
            Comment = comment;
        }
    }

    public class TradeReviewProvided : TradeReviewRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public User? ReviewerUser { get; set; }
        public User RevieweeUser { get; set; }
        public DateTime CreatedAt { get; set; }

        public TradeReviewProvided(Guid tradeId, Guid? reviewerId, Guid revieweeId, bool rating, string comment) : base(tradeId, reviewerId, revieweeId, rating, comment)
        {
            CreatedAt = DateTime.UtcNow;
        }
    }
}
