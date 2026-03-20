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
    public class UserPermissionService : IPermissionService<Guid, UserRequired>
    {

        private readonly IUsersRepository _usersRepository;

        public UserPermissionService(IUsersRepository usersRepository)
        {
            _usersRepository = usersRepository;
        }

        public async Task<bool> CanCreate(Guid userId, UserRequired data)
        {
            User? user = await _usersRepository.GetUserById(userId);

            if (user == null)
            {
                return false;
            }

            if(user.Role == UserRole.Admin)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
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

            if(userId == id)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, UserRequired? data)
        {

            if(data == null)
            {
                return false;
            }    

            User? user = await _usersRepository.GetUserById(userId);
            User? otherUser = await _usersRepository.GetUserById(id);

            if (user == null || otherUser == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId == id)
            {

                if(data != null)
                {
                    if (otherUser.Email == data.Email && otherUser.Provider == data.Provider && otherUser.ProviderUserId == data.ProviderUserId && otherUser.Avatar == data.Avatar && otherUser.Name == data.Name && data.Role == null)
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
