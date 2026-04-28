using System.Security.Cryptography.X509Certificates;
using System.Transactions;
using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class UserContactController : GenericController<Guid, UserContactProvided, UserContactProvided, UserContactRequired>
    {
        private readonly IUserContactsRepository _userContactsRepository;
        public UserContactController(IUserContactsRepository repository, IPermissionService<Guid, UserContactRequired> permissionService) : base(repository, permissionService)
        {
            _userContactsRepository = repository;
        }

        public record UserContactUpdate (
            Guid id,
            UserContactRequired value
            );

        public record UserContactBulkPayload(
            UserContactRequired[] Created,
            UserContactUpdate[] Updated,
            Guid[] Deleted
            );


        [Authorize]
        [HttpPost("Bulk")]
        public async Task<ActionResult<UserContactProvided[]>> BulkUpdate([FromBody] UserContactBulkPayload payload)
        {

            if(!UserId.HasValue)
            {
                return Unauthorized();
            }


            List<UserContactProvided> response = new List<UserContactProvided>();

            var created = payload.Created ?? [];
            var updated = payload.Updated ?? [];
            var deleted = payload.Deleted ?? [];

            using var transaction = await _userContactsRepository.BeginTransactionAsync();

            try
            { 

                foreach (var item in created)
                {
                    bool isPermissionGranted = await _permissionService.CanCreate(UserId.Value, item);

                    if (!isPermissionGranted)
                    {
                        await transaction.RollbackAsync();
                        return Forbid();
                    }

                    var newItem = await _repository.InsertItemAsync(item);

                    response.Add(newItem);
                }

                foreach (var item in updated)
                {
                    bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, item.id, item.value);

                    if (!isPermissionGranted)
                    {
                        await transaction.RollbackAsync();
                        return Forbid();
                    }

                    var updatedItem = await _repository.UpdateItemAsync(item.id, item.value);

                    if (updatedItem == null)
                    {
                        await transaction.RollbackAsync();
                        return NotFound();
                    }

                    response.Add(updatedItem);
                }

                foreach (var item in deleted)
                {
                    bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, item);

                    if (!isPermissionGranted)
                    {
                        await transaction.RollbackAsync();
                        return Forbid();
                    }

                    var isSuccefull = await _repository.DeleteItemAsync(item);

                    if (!isSuccefull)
                    {
                        await transaction.RollbackAsync();
                        return NotFound();
                    }

                }

                await transaction.CommitAsync();
                return Ok(response);
            }
            catch(Exception ex)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }
}
