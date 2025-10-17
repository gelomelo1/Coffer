using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IUsersRepository : IGenericRepository<Guid, User, UserProvided, UserRequired>
    {
        Task<User?> GetUserByLogin(string provider, string providerUserId);
        Task<User> InsertUserAsync(UserRequired newUser);
        Task<User?> GetUserById(Guid userId);
    }
}
