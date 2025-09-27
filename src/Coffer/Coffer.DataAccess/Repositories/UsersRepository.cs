using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class UsersRepository : GenericRepository<Guid, User, UserProvided, UserRequired>, IUsersRepository
    {
        public UsersRepository(CofferDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<User?> GetUserByLogin(string provider, string providerUserId)
        {
            return await _dbSet
                .FirstOrDefaultAsync(u => u.Provider == provider && u.ProviderUserId == providerUserId);
        }

        public async Task<User> InsertUserAsync(UserRequired newUser)
        {
            var user = new User(newUser.Name, newUser.Email, newUser.Provider, newUser.ProviderUserId);
            _dbSet.Add(user);
            await _dbContext.SaveChangesAsync();
            return user;
        }

        protected override User MapToEntity(UserRequired required, User? entity = null)
        {
            if(entity == null)
            {
                return new User(required.Name, required.Email, required.Provider, required.ProviderUserId);
            }

            entity.Name = required.Name;
            entity.Email = required.Email;
            entity.Provider = required.Provider;
            entity.ProviderUserId = required.ProviderUserId;

            return entity;
        }
    }
}
