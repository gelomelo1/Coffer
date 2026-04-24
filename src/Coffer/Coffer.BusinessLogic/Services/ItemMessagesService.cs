using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.DTOs.ItemMessage;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;

namespace Coffer.BusinessLogic.Services
{
    public class ItemMessagesService : IItemMessagesService
    {
        private readonly IItemMessagesRepository _itemMessagesRepository;

        public ItemMessagesService(IItemMessagesRepository itemMessagesRepository)
        {
            _itemMessagesRepository = itemMessagesRepository;
        }

        public async Task<List<ItemMessageDto>> GetMessagesWithUserByItemIdAsync(Guid itemId)
        {
            var messages = await _itemMessagesRepository.GetMessagesWithUserByItemIdAsync(itemId);

            var dtos = messages.Select(m => new ItemMessageDto
            {
                Id = m.Id,
                ItemId = m.ItemId,
                UserId = m.UserId,
                Message = m.Message,
                ModifiedAt = m.ModifiedAt,
                Username = m.User.Name,
                Avatar = m.User.Avatar
            }).ToList();

            return dtos;
        }

        public async Task<IEnumerable<ItemMessageDto>> GetMessagesWithUserByUserIdAsync(Guid userId)
        {
            var messages = await _itemMessagesRepository.GetMessagesWithUserByUserIdAsync(userId);

            var dtos = messages.Select(m => new ItemMessageDto
            {
                Id = m.Id,
                ItemId = m.ItemId,
                UserId = m.UserId,
                Message = m.Message,
                ModifiedAt = m.ModifiedAt,
                CreatedAt = m.CreatedAt,
                Username = m.User.Name,
                Avatar = m.User.Avatar
            }).ToList();

            return dtos;
        }
    }
}
