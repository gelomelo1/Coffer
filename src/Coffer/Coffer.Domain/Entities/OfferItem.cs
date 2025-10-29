using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class OfferItem : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public Guid OfferId { get; set; }
        public Guid? ItemId { get; set; }
        public ItemProvided? Item { get; set; }
    }
}
