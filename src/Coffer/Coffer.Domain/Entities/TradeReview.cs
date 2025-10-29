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
    }

    public class TradeReviewProvided : TradeReviewRequired, IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public UserProvided? ReviewerUser { get; set; }
        public UserProvided RevieweeUser { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
