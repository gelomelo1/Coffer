using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class FollowsController : ControllerBase
    {
        private readonly IFollowsRepository _followsRepository;
        private readonly IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired> _collectionRepository;
        public FollowsController(IFollowsRepository followsRepository, IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired> collectionRepository)
        {
            _followsRepository = followsRepository;
            _collectionRepository = collectionRepository;
        }

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
                // Better to log exception here before returning
                return StatusCode(500, $"An error occurred while processing the request: {ex.Message}");
            }
        }
    }
}
