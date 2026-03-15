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
    public class ReactionPermissionService : IPermissionService<Guid, ReactionRequired>
    {

        private readonly IUsersRepository _usersRepository;
        private readonly IReactionsRepository _reactionsRepository;
        private readonly IItemsRepository _itemsRepository;
        private readonly ICollectionsRepository _collectionsRepository;

        public ReactionPermissionService(IUsersRepository usersRepository, IReactionsRepository reactionsRepository , IItemsRepository itemsRepository, ICollectionsRepository collectionsRepository)
        {
            _usersRepository = usersRepository;
            _reactionsRepository = reactionsRepository;
            _itemsRepository = itemsRepository;
            _collectionsRepository = collectionsRepository;
        }

        public async Task<bool> CanCreate(Guid userId, ReactionRequired data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            ItemProvided? item = await _itemsRepository.GetItemByIdAsync(data.ItemId);

            if (user == null || item == null)
            {
                return false;
            }

            CollectionProvided? collection = await _collectionsRepository.GetItemByIdAsync(item.CollectionId);

            if(collection == null)
            {
                return false;
            }

            if(userId != collection.UserId)
            {
                if (user.Role == UserRole.Admin)
                {
                    return true;
                }

                if (userId == data.UserId)
                {
                    return true;
                }

            }
            return false;
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
        {
            User? user = await _usersRepository.GetUserById(userId);
            ReactionProvided? reaction = await _reactionsRepository.GetItemByIdAsync(id);

            if (user == null || reaction == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin || user.Role == UserRole.Moderator)
            {
                return true;
            }

            if (userId == reaction.UserId)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, ReactionRequired? data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            ReactionProvided? reaction = await _reactionsRepository.GetItemByIdAsync(id);


            if (user == null || reaction == null)
            {
                return false;
            }

            ItemProvided? item = await _itemsRepository.GetItemByIdAsync(reaction.ItemId);


            if (item == null)
            {
                return false;
            }

            CollectionProvided? collection = await _collectionsRepository.GetItemByIdAsync(item.CollectionId);


            if (collection == null)
            {
                return false;
            }

            if (userId != collection.UserId)
            {
                if (user.Role == UserRole.Admin)
                {
                    return true;
                }

                if (userId == reaction.UserId)
                {
                    if(data != null)
                    {
                        ReactionProvided? dataReaction = await _reactionsRepository.GetItemByIdAsync(data.ItemId);

                        if(dataReaction == null)
                        {
                            return false;
                        }

                        ItemProvided? dataItem = await _itemsRepository.GetItemByIdAsync(dataReaction.ItemId);

                        if(dataItem == null)
                        {
                            return false;
                        }

                        CollectionProvided? dataCollection = await _collectionsRepository.GetItemByIdAsync(dataItem.CollectionId);

                        if (dataCollection == null)
                        {
                            return false;
                        }

                        if (userId == data.UserId && userId != dataCollection.UserId)
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

            }
            return false;
        }
    }
}
