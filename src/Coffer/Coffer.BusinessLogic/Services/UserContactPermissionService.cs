using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services
{
    public class UserContactPermissionService : IPermissionService<Guid, UserContactRequired>
    {

        private readonly IUsersRepository _usersRepository;
        private readonly IGenericRepository<Guid, UserContactProvided, UserContactProvided, UserContactRequired> _userContactRepository;

        public UserContactPermissionService(IUsersRepository usersRepository, IGenericRepository<Guid, UserContactProvided, UserContactProvided, UserContactRequired> userContactRepository)
        {
            _usersRepository = usersRepository;
            _userContactRepository = userContactRepository;
        }

        public async Task<bool> CanCreate(Guid userId, UserContactRequired data)
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
            UserContactProvided? userContact = await _userContactRepository.GetItemByIdAsync(id);

            if (user == null || userContact == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin || user.Role == UserRole.Moderator)
            {
                return true;
            }

            if (userId == userContact.UserId)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, UserContactRequired? data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            UserContactProvided? userContact = await _userContactRepository.GetItemByIdAsync(id);

            if (user == null || userContact == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId == userContact.UserId)
            {

                if(data != null)
                {
                    if(userId == data.UserId)
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
