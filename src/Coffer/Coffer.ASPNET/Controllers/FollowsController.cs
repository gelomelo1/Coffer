using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static Coffer.ASPNET.Controllers.FeedController;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class FollowsController : BaseController
    {
        private readonly IFollowsRepository _followsRepository;
        private readonly ICollectionsRepository _collectionRepository;
        private readonly IPermissionService<Guid, FollowRequired> _permissionService;
        public FollowsController(IFollowsRepository followsRepository, ICollectionsRepository collectionRepository, IPermissionService<Guid, FollowRequired> permissionService)
        {
            _followsRepository = followsRepository;
            _collectionRepository = collectionRepository;
            _permissionService = permissionService;
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<CollectionProvided>> ManageFollow([FromBody] FollowRequired followRequired)
        {
            if(!UserId.HasValue)
            {
                return Unauthorized();
            }

            try
            {
                var follow = await _followsRepository.FindFollowByUserCollectionIdAsync(UserId.Value, followRequired.CollectionId);

                if (follow == null)
                {
                    bool isPermissionGranted = await _permissionService.CanCreate(UserId.Value, followRequired);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    await _followsRepository.InsertItemAsync(followRequired);
                }
                else
                {
                    bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, follow.Id);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }
                    await _followsRepository.DeleteItemAsync(follow.Id);
                }

                var updatedCollection = await _collectionRepository.GetItemByIdAsync(followRequired.CollectionId);

                return Ok(updatedCollection);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while processing the request");
            }
        }
    }
}
