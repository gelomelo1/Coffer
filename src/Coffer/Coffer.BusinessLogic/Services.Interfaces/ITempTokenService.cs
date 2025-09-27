using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Services.Interfaces
{
    public interface ITempTokenService
    {
        public string StoreToken(string accessToken);
        public bool TryGetToken(string tempId, out string accessToken);
        public void RemoveToken(string tempId);
    }
}
