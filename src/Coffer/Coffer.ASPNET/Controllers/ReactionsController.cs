using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.ASPNET.Extensions;
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
        private readonly Coffer.BusinessLogic.Activity.IActivityLog _activity;
        public ReactionsController(IReactionsRepository reactionsRepository, IUsersRepository usersRepository, IItemsRepository itemsRepository, IPermissionService<Guid, ReactionRequired> permissionService, Coffer.BusinessLogic.Activity.IActivityLog activity) : base(reactionsRepository)
        {
            _activity = activity;
            _reactionsRepository = reactionsRepository;
            _usersRepository = usersRepository;
            _itemsRepository = itemsRepository;
            _permissionService = permissionService;
        }

        /// <summary>Adds what the user did to their activity log; the repository save that follows persists it.</summary>
        private void RecordReaction(bool oldLiked, int? oldRarity, bool newLiked, int? newRarity, Guid itemId)
        {
            foreach (var (kind, details) in Coffer.BusinessLogic.Activity.ReactionActivity.Changes(oldLiked, oldRarity, newLiked, newRarity))
                _activity.Record(UserId!.Value, kind, new Coffer.BusinessLogic.Activity.ActivityTargets(ItemId: itemId), details);
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
                    return this.ApiError(StatusCodes.Status400BadRequest, "userDoesNotExist", "User does not exist.");

                var item = await _itemsRepository.GetItemByIdAsync(reactionRequired.ItemId);
                if (item == null)
                    return this.ApiError(StatusCodes.Status400BadRequest, "itemDoesNotExist", "Item does not exist.");

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

                    RecordReaction(false, null, reactionRequired.Liked, reactionRequired.Rarity, reactionRequired.ItemId);
                    await _reactionsRepository.InsertItemAsync(reactionRequired);
                }
                else if (!reactionRequired.Liked && reactionRequired.Rarity == null)
                {
                    bool isPermissionGranted = await _permissionService.CanDelete(UserId.Value, existingReaction.Id);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    RecordReaction(existingReaction.Liked, existingReaction.Rarity, false, null, reactionRequired.ItemId);
                    await _reactionsRepository.DeleteItemAsync(existingReaction.Id);
                }
                else
                {
                    bool isPermissionGranted = await _permissionService.CanUpdate(UserId.Value, existingReaction.Id, reactionRequired);
                    if (!isPermissionGranted)
                    {
                        return Forbid();
                    }

                    RecordReaction(existingReaction.Liked, existingReaction.Rarity, reactionRequired.Liked, reactionRequired.Rarity, reactionRequired.ItemId);
                    await _reactionsRepository.UpdateItemAsync(existingReaction.Id, reactionRequired);
                }

                var updatedItem = await _itemsRepository.GetItemByIdAsync(reactionRequired.ItemId);
                return Ok(updatedItem);
            }
            catch (Exception ex)
            {
                return this.ApiError(500, "anErrorOccurredWhileProcessingTheRequest2", $"An error occurred while processing the request: {ex.Message}", ErrorArgs.Of($"{ex.Message}"));
            }
        }
    }
}
