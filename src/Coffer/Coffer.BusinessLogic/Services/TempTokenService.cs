using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Services
{
    public class TempTokenService : ITempTokenService
    {
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _ttl = TimeSpan.FromMinutes(10);

        public TempTokenService(IMemoryCache cache)
        {
            _cache = cache;
        }

        public string StoreToken(string accessToken)
        {
            var tempId = Guid.NewGuid().ToString();
            _cache.Set(tempId, accessToken, _ttl);
            return tempId;
        }

        public bool TryGetToken(string tempId, out string accessToken)
        {
            return _cache.TryGetValue(tempId, out accessToken!);
        }

        public void RemoveToken(string tempId)
        {
            _cache.Remove(tempId);
        }
    }
}
