using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static Coffer.ASPNET.Controllers.FeedController;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class FollowsController : ControllerBase
    {
        private readonly IFollowsRepository _followsRepository;
        private readonly ICollectionsRepository _collectionRepository;
        public FollowsController(IFollowsRepository followsRepository, ICollectionsRepository collectionRepository)
        {
            _followsRepository = followsRepository;
            _collectionRepository = collectionRepository;
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<CollectionProvided>> ManageFollow([FromBody] FollowRequired followRequired)
        {
            try
            {
                var follow = await _followsRepository.FindFollowByUserCollectionIdAsync(followRequired.UserId, followRequired.CollectionId);
                if (follow == null)
                {
                    await _followsRepository.InsertItemAsync(followRequired);
                }
                else
                {
                    await _followsRepository.DeleteItemAsync(follow.Id);
                }

                var updatedCollection = await _collectionRepository.GetItemByIdAsync(followRequired.CollectionId);

                return Ok(updatedCollection);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while processing the request: {ex.Message}");
            }
        }
    }
}
