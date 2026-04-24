using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IItemMessagesRepository
    {
        Task<int> GetMessageCountByItemIdAsync(Guid itemId);
        Task<IEnumerable<ItemMessage>> GetMessagesWithUserByItemIdAsync(Guid itemId);
        Task<IEnumerable<ItemMessage>> GetMessagesWithUserByUserIdAsync(Guid userId);
    }
}
