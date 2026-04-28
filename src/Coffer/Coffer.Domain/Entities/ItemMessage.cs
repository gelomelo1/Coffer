using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.Domain.Entities
{
    public class ItemMessage : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public Guid? ItemId { get; set; }
        public Guid UserId { get; set; }
        public string Message { get; set; }
        public DateTime ModifiedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public User User { get; set; }
        public ItemProvided Item { get; set; }
    }
}
