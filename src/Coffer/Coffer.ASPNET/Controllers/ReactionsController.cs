using Coffer.ASPNET.Controllers.Generic;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class ReactionsController : ReadOnlyGenericController<Guid, ReactionProvided, ReactionProvided>
    {
        private readonly IReactionsRepository _reactionsRepository;
        private readonly IUsersRepository _usersRepository;
        private readonly IItemsRepository _itemsRepository;
        private readonly IPermissionService<Guid, ReactionRequired> _permissionService;
        public ReactionsController(IReactionsRepository reactionsRepository, IUsersRepository usersRepository, IItemsRepository itemsRepository, IPermissionService<Guid, ReactionRequired> permissionService) : base(reactionsRepository)
        {
            _reactionsRepository = reactionsRepository;
            _usersRepository = usersRepository;
            _itemsRepository = itemsRepository;
            _permissionService = permissionService;
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<ItemProvided>> PostReaction(ReactionRequired reactionRequired)
        {

            if (!UserId.HasValue)
            {
                return Unauthorized();
            }

            try
            {
                var user = await _usersRepository.GetUserById(reactionRequired.UserId);
                if (user == null)
                    return BadRequest("User does not exist.");

                var item = await _itemsRepository.GetItemByIdAsync(reactionRequired.ItemId);
                if (item == null)
                    return BadRequest("Item does not exist.");

                var existingReaction = await _reactionsRepository.FindReactionByUserItemIdAsync(
                    reactionRequired.UserId,
                    reactionRequired.ItemId
                );

                if (existingReaction == null)
                {
                    bool isPermissionGranted = await _permissionService.CanCreate(UserId.Value, reactionRequired);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    await _reactionsRepository.InsertItemAsync(reactionRequired);
                }
                else if (!reactionRequired.Liked && reactionRequired.Rarity == null)
                {
                    bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, existingReaction.Id);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    await _reactionsRepository.DeleteItemAsync(existingReaction.Id);
                }
                else
                {
                    bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, existingReaction.Id, reactionRequired);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    await _reactionsRepository.UpdateItemAsync(existingReaction.Id, reactionRequired);
                }

                var updatedItem = await _itemsRepository.GetItemByIdAsync(reactionRequired.ItemId);
                return Ok(updatedItem);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while processing the request: {ex.Message}");
            }
        }
    }
}
