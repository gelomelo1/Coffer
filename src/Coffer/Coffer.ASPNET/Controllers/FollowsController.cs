using Coffer.ASPNET.Extensions;
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
        private readonly Coffer.BusinessLogic.Activity.IActivityLog _activity;
        public FollowsController(IFollowsRepository followsRepository, ICollectionsRepository collectionRepository, IPermissionService<Guid, FollowRequired> permissionService, Coffer.BusinessLogic.Activity.IActivityLog activity)
        {
            _activity = activity;
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

                    _activity.Record(UserId.Value, "follow.followed", new Coffer.BusinessLogic.Activity.ActivityTargets(CollectionId: followRequired.CollectionId));
                    await _followsRepository.InsertItemAsync(followRequired);
                }
                else
                {
                    bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, follow.Id);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }
                    _activity.Record(UserId.Value, "follow.unfollowed", new Coffer.BusinessLogic.Activity.ActivityTargets(CollectionId: followRequired.CollectionId));
                    await _followsRepository.DeleteItemAsync(follow.Id);
                }

                var updatedCollection = await _collectionRepository.GetItemByIdAsync(followRequired.CollectionId);

                return Ok(updatedCollection);
            }
            catch (Exception ex)
            {
                return this.ApiError(500, "anErrorOccurredWhileProcessingTheRequest", $"An error occurred while processing the request");
            }
        }
    }
}
