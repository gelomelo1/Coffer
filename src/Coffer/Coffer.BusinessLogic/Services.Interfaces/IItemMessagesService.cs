using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.DTOs.ItemMessage;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services.Interfaces
{
    internal interface IItemMessagesService
    {
        Task<List<ItemMessageDto>> GetMessagesWithUserByItemIdAsync(Guid itemId);
        Task<IEnumerable<ItemMessageDto>> GetMessagesWithUserByUserIdAsync(Guid userId);
    }
}
