using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Coffer.Domain.Constants;

namespace Coffer.BusinessLogic.Services
{
    public class FollowPermissionService : IPermissionService<Guid, FollowRequired>
    {

        private readonly IUsersRepository _usersRepository;
        private readonly IFollowsRepository _followsRepository;
        private readonly ICollectionsRepository _collectionRepository;

        public FollowPermissionService(IUsersRepository usersRepository, IFollowsRepository followsRepository, ICollectionsRepository collectionRepository)
        {
            _usersRepository = usersRepository;
            _followsRepository = followsRepository;
            _collectionRepository = collectionRepository;
        }

        public async Task<bool> CanCreate(Guid userId, FollowRequired data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            CollectionProvided? collection = await _collectionRepository.GetItemByIdAsync(data.CollectionId);

            if (user == null || collection == null)
            {
                return false;
            }

            if (user.Role == UserRole.User)
            {
                return true;
            }

            if (userId == data.UserId && userId != collection.UserId)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
        {
            User? user = await _usersRepository.GetUserById(userId);
            FollowProvided? follow = await _followsRepository.GetItemByIdAsync(id);


            if (user == null || follow == null)
            {
                return false;
            }

            if (user.Role == UserRole.User || user.Role == UserRole.Moderator)
            {
                return true;
            }

            if (userId == follow.UserId)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, FollowRequired? data)
        {

            if(data == null)
            {
                return false;
            }

            User? user = await _usersRepository.GetUserById(userId);
            FollowProvided? follow = await _followsRepository.GetItemByIdAsync(id);

            if (user == null || follow == null)
            {
                return false;
            }

            CollectionProvided? collection = await _collectionRepository.GetItemByIdAsync(data.CollectionId);

            if (collection == null)
            {
                return false;
            }

            if (user.Role == UserRole.User)
            {
                return true;
            }

            if(userId == follow.UserId && userId == data.UserId && userId != collection.UserId)
            {
                return true;
            }    

            return false;
        }
    }
}
