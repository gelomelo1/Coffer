using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace Coffer.BusinessLogic.Services
{
    public class CollectionPermissionService : IPermissionService<Guid, CollectionRequired>
    {
        private readonly IUsersRepository _usersRepository;
        private readonly ICollectionsRepository _collectionsRepository;

        public CollectionPermissionService(IUsersRepository usersRepository, ICollectionsRepository collectionsRepository)
        {
            _usersRepository = usersRepository;
            _collectionsRepository = collectionsRepository;
        }

        public async Task<bool> CanCreate(Guid userId, CollectionRequired data)
        {
            User? user = await _usersRepository.GetUserById(userId);

            if (user == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId == data.UserId)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
        {
            User? user = await _usersRepository.GetUserById(userId);
            CollectionProvided? collection = await _collectionsRepository.GetItemByIdAsync(id);

            if (user == null || collection == null)
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

        public async Task<bool> CanUpdate(Guid userId, Guid id, CollectionRequired? data)
        {

            User? user = await _usersRepository.GetUserById(userId);
            CollectionProvided? collection = await _collectionsRepository.GetItemByIdAsync(id);

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
                if(data != null)
                {
                    if (userId == data.UserId && collection.CollectionTypeId == data.CollectionTypeId)
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
