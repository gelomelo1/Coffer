using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class TradeItem : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public Guid TradeId { get; set; }
        public Guid? ItemId { get; set; }
        public ItemProvided? Item { get; set; }
    }
}
