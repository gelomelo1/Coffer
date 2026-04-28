using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services
{
    public class ItemPermissionService : IPermissionService<Guid, ItemRequired>
    {

        private readonly IUsersRepository _usersRepository;
        private readonly IItemsRepository _itemsRepository;
        private readonly ICollectionsRepository _collectionsRepository;

        public ItemPermissionService(IUsersRepository usersRepository, IItemsRepository itemsRepository , ICollectionsRepository collectionsRepository)
        {
            _usersRepository = usersRepository;
            _itemsRepository = itemsRepository;
            _collectionsRepository = collectionsRepository;
        }

        public async Task<bool> CanCreate(Guid userId, ItemRequired data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            CollectionProvided? collection = await _collectionsRepository.GetItemByIdAsync(data.CollectionId);

            if (user == null || collection == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId == collection.UserId)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
        {
            User? user = await _usersRepository.GetUserById(userId);
            ItemProvided? item = await _itemsRepository.GetItemByIdAsync(id);

            if (user == null || item == null)
            {
                return false;
            }

            CollectionProvided? collection = await _collectionsRepository.GetItemByIdAsync(item.CollectionId);

            if (collection == null)
            {
                return false;
            }


            if (user.Role == UserRole.Admin || user.Role == UserRole.Moderator)
            {
                return true;
            }

            if (userId == collection.UserId)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, ItemRequired? data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            ItemProvided? item = await _itemsRepository.GetItemByIdAsync(id);

            if (user == null || item == null)
            {
                return false;
            }

            CollectionProvided? collection = await _collectionsRepository.GetItemByIdAsync(item.CollectionId);

            if (collection == null)
            {
                return false;
            }


            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId == collection.UserId)
            {
                if(data != null)
                {
                    if(item.CollectionId == data.CollectionId && item.Image == data.Image)
                    {
                        return true;
                    }
                    else
                    {
                        return false;
                    }
                }
                return true;
            }

            return false;
        }
    }
}
