using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services.Interfaces
{
    public interface IJwtService
    {
        public string GenerateToken(User user);
    }
}
