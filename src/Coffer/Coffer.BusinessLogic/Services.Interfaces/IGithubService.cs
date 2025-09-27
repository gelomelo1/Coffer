using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Coffer.BusinessLogic.Services.Interfaces
{
    public interface IGithubService
    {
        public Task<string> ExchangeCodeForToken(string code, string codeVerifier);
        public Task<(string Id, string Email, string Name)> GetGithubUser(string accessToken);
    }
}
