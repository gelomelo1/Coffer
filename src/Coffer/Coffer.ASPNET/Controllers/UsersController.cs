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
