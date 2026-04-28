using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore.Storage;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IUserContactsRepository : IGenericRepository<Guid, UserContactProvided, UserContactProvided, UserContactRequired>
    {
        public Task<IDbContextTransaction> BeginTransactionAsync();
    }
}
