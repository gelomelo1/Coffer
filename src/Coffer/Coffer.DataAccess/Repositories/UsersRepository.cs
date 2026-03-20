using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Coffer.Domain.Constants;

namespace Coffer.DataAccess.Repositories
{
    public class UsersRepository : GenericRepository<Guid, User, UserProvided, UserRequired>, IUsersRepository
    {
        public UsersRepository(CofferDbContext dbContext, IIncludeProvider<User> includeProvider) : base(dbContext, includeProvider)
        {
        }

        public async Task<User?> GetUserById(Guid userId)
        {
            return await _dbSet
                .Include(u => u.Contacts)
                .FirstOrDefaultAsync(user => user.Id == userId);
        }

        public async Task<User?> GetUserByLogin(string provider, string providerUserId)
        {
            return await _dbSet
                .Include(u => u.Contacts)
                .FirstOrDefaultAsync(u => u.Provider == provider && u.ProviderUserId == providerUserId);
        }

        public async Task<User> InsertUserAsync(UserRequired newUser)
        {
            var user = new User(newUser.Name, newUser.Email, newUser.Provider, newUser.Country, newUser.ProviderUserId, newUser.Avatar, newUser.Role);
            _dbSet.Add(user);
            await _dbContext.SaveChangesAsync();
            return user;
        }

        public async Task<IEnumerable<User>> SearchUsersAsync(string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return new List<User>();

            searchText = searchText.Trim().ToLower();

            var users = await _dbSet
                .Include(u => u.Contacts)
                .Where(u => u.Name.ToLower().Contains(searchText))
                .OrderBy(u => u.Name)
                .Take(10)
                .ToListAsync();

            return users;
        }

        public async Task<User?> UpdateUserFrontend(Guid id, UserRequiredFrontend newUser)
        {
            IQueryable<User> query = _dbSet;

            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }
            var user = await query.FirstOrDefaultAsync(u => u.Id ==id);

            if(user == null)
                return null;

            user.Country = newUser.Country;
            user.Summary = newUser.Summary;

            await _dbContext.SaveChangesAsync();
            return user;
        }

        protected override User MapToEntity(UserRequired required, User? entity = null)
        {
            if(entity == null)
            {
                return new User(required.Name, required.Email, required.Provider, required.Country, required.ProviderUserId, required.Avatar, required.Role ?? UserRole.User, required.Summary);
            }

            entity.Name = required.Name;
            entity.Email = required.Email;
            entity.Provider = required.Provider;
            entity.ProviderUserId = required.ProviderUserId;
            entity.Country = required.Country;
            entity.Avatar = required.Avatar;
            entity.Summary = required.Summary;
            if(required.Role != null)
            {
                entity.Role = required.Role.Value;
            }

            return entity;
        }

        protected override User MapToEntity(UserProvided provided, User? entity = null)
        {
            throw new InvalidOperationException("This function should not be called.");
        }
    }
}
