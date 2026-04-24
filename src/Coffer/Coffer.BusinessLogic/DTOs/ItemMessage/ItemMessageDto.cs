using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Coffer.Domain.Entities.Interfaces;

namespace Coffer.BusinessLogic.DTOs.ItemMessage
{
    public class ItemMessageDto : IGenericEntity<Guid>
    {
        public Guid Id { get; set; }
        public Guid? ItemId { get; set; }
        public Guid UserId { get; set; }
        public string Message { get; set; }
        public DateTime ModifiedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string Username { get; set; }
        public string? Avatar { get; set; }
    }
}
