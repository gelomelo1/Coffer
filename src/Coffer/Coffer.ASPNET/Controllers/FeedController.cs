using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class FeedController : ControllerBase
    {
        private readonly IItemsRepository _itemsRepository;
        private readonly IUsersRepository _usersRepository;
        private readonly IItemTagsRepository _itemTagsRepository;
        private readonly ICollectionsRepository _collectionRepository;
        private readonly IFollowsRepository _followsRepository;

        public FeedController(IItemsRepository itemsRepository, IUsersRepository usersRepository, IItemTagsRepository itemTagsRepository, ICollectionsRepository collectionRepository, IFollowsRepository followsRepository)
        {
            _itemsRepository = itemsRepository;
            _usersRepository = usersRepository;
            _itemTagsRepository = itemTagsRepository;
            _collectionRepository = collectionRepository;
            _followsRepository = followsRepository;
        }

        [Authorize]
        [HttpGet("{userId}")]
        public async Task<ActionResult<IEnumerable<Feed>>> GetFeedItems(Guid userId)
        {
            try
            {
                var user = await _usersRepository.GetUserById(userId);
                if (user == null)
                    return BadRequest("User not found");
                var items = await _itemsRepository.GetFeedItemsAsync(user);
                List<Feed> feeds = new List<Feed>();
                foreach (var item in items)
                {
                    var feedUser = await _usersRepository.GetUserById(item.Collection.UserId);
                    var feedCollection = item.Collection;
                    feeds.Add(new Feed(item, feedUser, feedCollection));
                }
                return Ok(feeds);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        public record ItemTagGroup(string Value, List<FoundItem> FoundItems);

        public record FoundItem(UserProvided User, CollectionProvided Collection, ItemProvided Item);

        [Authorize]
        [HttpGet("SearchTag/{collectionTypeId}/{searchText}")]
        public async Task<ActionResult<IEnumerable<ItemTagGroup>>> TagSearch(int collectionTypeId, string searchText)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(searchText))
                    return BadRequest("Search text cannot be empty.");

                var realSearchText = searchText
                    .Replace("#", string.Empty)
                    .Trim();

                var tags = await _itemTagsRepository.SearchTagsAsync(collectionTypeId, realSearchText);

                var foundItemTags = new List<ItemTagGroup>();

                foreach (var tag in tags)
                {
                    var foundItems = new List<FoundItem>();

                    foreach (var tagValue in tag.tags)
                    {
                        var item = tagValue.Item;
                        var collection = await _collectionRepository.GetItemByIdAsync(item.CollectionId);
                        if (collection == null) continue;

                        var user = await _usersRepository.GetItemByIdAsync(collection.UserId);
                        if (user == null) continue;

                        foundItems.Add(new FoundItem(user, collection, item));
                    }

                    foundItemTags.Add(new ItemTagGroup(tag.value, foundItems));
                }

                return Ok(foundItemTags);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        public record MixedResponse(
            List<UserProvided> FoundUsers,
            List<CollectionResult> FoundCollections,
            List<ItemResult> FoundItems
        );

        public record CollectionResult(
            UserProvided User,
            CollectionProvided Collection
        );

        public record ItemResult(
            UserProvided User,
            CollectionProvided Collection,
            ItemProvided Item
        );

        [Authorize]
        [HttpGet("Search/{collectionTypeId}/{searchText}")]
        public async Task<ActionResult<MixedResponse>> MixedSearch(int collectionTypeId, string searchText)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(searchText))
                    return BadRequest("Search text cannot be empty.");

                var foundUsers = (await _usersRepository.SearchUsersAsync(searchText))
                            .Select(u => (UserProvided)u)
                            .ToList();

                var collections = await _collectionRepository.SearchCollections(collectionTypeId ,searchText);

                List<CollectionResult> foundCollections = new List<CollectionResult>();

                foreach (var collection in collections)
                {
                    var user = await _usersRepository.GetItemByIdAsync(collection.UserId);

                    if (user == null) continue;

                    foundCollections.Add(new CollectionResult(user, collection));
                }

                var items = await _itemsRepository.SearchItems(collectionTypeId, searchText);

                List<ItemResult> foundItems = new List<ItemResult>();

                foreach (var item in items)
                {
                    var collection = await _collectionRepository.GetItemByIdAsync(item.CollectionId);

                    if(collection == null) continue;

                    var user = await _usersRepository.GetItemByIdAsync(collection.UserId);

                    if(user == null) continue;  

                    foundItems.Add(new ItemResult(user, collection, item));
                }


                return Ok(new MixedResponse(foundUsers, foundCollections, foundItems));
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("UserFollows/{userId}")]
        public async Task<ActionResult<IEnumerable<CollectionResult>>> UserFollows(Guid userId)
        {
            try
            {
                 var user = await _usersRepository.GetUserById(userId);
                 if (user == null)
                     return NotFound();

                 var follows = await _followsRepository.FindFollowsOfUser(userId);

                 List<CollectionResult> followedResults = new List<CollectionResult>();

                 foreach(var follow in follows)
                 {
                     followedResults.Add(new CollectionResult(follow.Collection.User, follow.Collection));
                 }


                return Ok(followedResults);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
