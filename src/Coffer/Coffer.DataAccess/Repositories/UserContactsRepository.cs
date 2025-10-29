using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class UserContactsRepository : GenericRepository<Guid, UserContactProvided, UserContactProvided, UserContactRequired>
    {
        public UserContactsRepository(CofferDbContext dbContext, IIncludeProvider<UserContactProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }

        protected override UserContactProvided MapToEntity(UserContactRequired required, UserContactProvided? entity = null)
        {
            if(entity == null)
            {
                return new UserContactProvided(required.UserId, required.Platform, required.Value, required.Link);
            }

            entity.UserId = required.UserId;
            entity.Platform = required.Platform;
            entity.Value = required.Value;
            entity.Link = required.Link;

            return entity;
        }

        protected override UserContactProvided MapToEntity(UserContactProvided provided, UserContactProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
