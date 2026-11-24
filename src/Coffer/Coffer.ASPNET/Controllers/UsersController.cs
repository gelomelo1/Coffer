using System.Linq.Dynamic.Core;
using Coffer.ASPNET.Controllers.Generic;
using Coffer.ASPNET.Extensions;
using Coffer.BusinessLogic.Extensions;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class UsersController : GenericController<Guid, User, UserProvided, UserRequired>
    {
        private readonly IUsersRepository _usersRepository;
        public UsersController(IUsersRepository genericRepository, IPermissionService<Guid, UserRequired> permissionService) : base(genericRepository, permissionService)
        {
            _usersRepository = genericRepository;
        }

        /// <summary>
        /// No generic user create: accounts are made only by signing in (api/auth/register), so an account is always
        /// bound to an identity its owner proved. A create here could bind someone else's provider identity in advance.
        /// </summary>
        [NonAction]
        public override Task<ActionResult<UserProvided>> Create(UserRequired required) => throw new NotSupportedException();

        /// <summary>
        /// No generic user delete: it would hard-delete the row and cascade away other users' data. Accounts are
        /// deleted with DELETE api/Account, which keeps everything other users rely on.
        /// </summary>
        [NonAction]
        public override Task<ActionResult> Delete(Guid id) => throw new NotSupportedException();

        [Authorize]
        [HttpPut("UserFrontend")]
        public async Task<ActionResult<UserProvided>> UpdateUserFrontend([FromBody] UserRequiredFrontend required)
        {
            if (!UserId.HasValue)
            {
                return Unauthorized(); ;
            }

            if(required.Summary != null && HtmlSafetyChecker.IsHtmlSafe(required.Summary) == false)
            {
                return Forbid();
            }

            var item = await _usersRepository.UpdateUserFrontend(UserId.Value, required);
            if (item == null) return NotFound();
            return Ok(item);
        }

        [HttpGet("UserExists/{username}")]
        public async Task<ActionResult<bool>> GetUserExists(string username)
        {
            var user = await _usersRepository.GetUserByName(username);
            bool exists = false;
            if (user != null)
            {
                exists = true;
            }
            return Ok(exists);
        }
    }
}
