using Coffer.ASPNET.Extensions;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Extensions;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Coffer.Domain.Paging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class FeedController : BaseController
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
        [HttpGet]
        public async Task<ActionResult<Coffer.Domain.Paging.PagedList<Feed>>> GetFeedItems([FromQuery] string? filter = null,
                                                                            [FromQuery] string? orderBy = null,
                                                                            [FromQuery] int? page = null,
                                                                            [FromQuery] int? pageSize = null)
        {
            if (!DynamicQueryGuard.IsAllowed(filter) || !DynamicQueryGuard.IsAllowed(orderBy))
                return this.ApiError(StatusCodes.Status400BadRequest, "filteringOrOrderingOnThisFieldIs", "Filtering or ordering on this field is not allowed");


            if(!UserId.HasValue)
            {
                return Unauthorized();
            }

            try
            {
                var user = await _usersRepository.GetUserById(UserId.Value);
                if (user == null)
                    return this.ApiError(StatusCodes.Status400BadRequest, "userNotFound", "User not found");
                var items = await _itemsRepository.GetFeedPageAsync(user, filter, page, pageSize);
                List<Feed> feeds = new List<Feed>();
                foreach (var item in items.Items)
                {
                    var feedUser = await _usersRepository.GetUserById(item.Collection.UserId);
                    var feedCollection = item.Collection;
                    feeds.Add(new Feed(item, feedUser, feedCollection));
                }
                return Ok(new Coffer.Domain.Paging.PagedList<Feed>(feeds, items.Page, items.PageSize, items.Total));
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Tag popularity while tagging an item: `?tags=a,b` gives the counts of exactly those tags; `?search=aus` the
        /// most used tags containing the text. Counts are distinct items across the whole app.
        /// </summary>
        [Authorize]
        [HttpGet("TagStats")]
        public async Task<ActionResult<IEnumerable<TagStat>>> TagStats(string? search, string? tags)
        {
            var list = string.IsNullOrWhiteSpace(tags)
                ? null
                : tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(30).ToList();
            return Ok(await _itemTagsRepository.GetTagStatsAsync(search, list));
        }

        public record ItemTagGroup(string Value, List<FoundItem> FoundItems);
        public record FoundItem(UserProvided User, CollectionProvided Collection, ItemProvided Item);
        public record CollectionResult(UserProvided User, CollectionProvided Collection);
        public record ItemResult(UserProvided User, CollectionProvided Collection, ItemProvided Item);

        /// <summary>The search's "All" tab: the first page of each kind plus each kind's total.</summary>
        public record MixedResponse(
            List<UserProvided> FoundUsers,
            List<CollectionResult> FoundCollections,
            List<ItemResult> FoundItems,
            int FoundUsersTotal,
            int FoundCollectionsTotal,
            int FoundItemsTotal
        );

        /// <summary>Tags matching the text (most similar first), a page of tag groups at a time.</summary>
        [Authorize]
        [HttpGet("SearchTag")]
        public async Task<ActionResult<PagedList<ItemTagGroup>>> TagSearch(string searchText, string? collectionTypeIds, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return this.ApiError(StatusCodes.Status400BadRequest, "searchTextCannotBeEmpty", "Search text cannot be empty.");

            var tags = await _itemTagsRepository.SearchTagsSmartAsync(collectionTypeIds, searchText.Replace("#", string.Empty).Trim(), page, pageSize);
            var groups = new List<ItemTagGroup>();
            foreach (var tag in tags.Items)
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
                groups.Add(new ItemTagGroup(tag.value, foundItems));
            }
            return Ok(new PagedList<ItemTagGroup>(groups, tags.Page, tags.PageSize, tags.Total));
        }

        [Authorize]
        [HttpGet("Search")]
        public async Task<ActionResult<MixedResponse>> MixedSearch(string searchText, string? collectionTypeIds)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return this.ApiError(StatusCodes.Status400BadRequest, "searchTextCannotBeEmpty", "Search text cannot be empty.");

            var users = await UsersPage(searchText, 1, null);
            var collections = await CollectionsPage(searchText, collectionTypeIds, 1, null);
            var items = await ItemsPage(searchText, collectionTypeIds, 1, null);
            return Ok(new MixedResponse(users.Items, collections.Items, items.Items, users.Total, collections.Total, items.Total));
        }

        [Authorize]
        [HttpGet("Search/Users")]
        public async Task<ActionResult<PagedList<UserProvided>>> SearchUsers(string searchText, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return this.ApiError(StatusCodes.Status400BadRequest, "searchTextCannotBeEmpty", "Search text cannot be empty.");
            return Ok(await UsersPage(searchText, page, pageSize));
        }

        [Authorize]
        [HttpGet("Search/Collections")]
        public async Task<ActionResult<PagedList<CollectionResult>>> SearchCollections(string searchText, string? collectionTypeIds, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return this.ApiError(StatusCodes.Status400BadRequest, "searchTextCannotBeEmpty", "Search text cannot be empty.");
            return Ok(await CollectionsPage(searchText, collectionTypeIds, page, pageSize));
        }

        [Authorize]
        [HttpGet("Search/Items")]
        public async Task<ActionResult<PagedList<ItemResult>>> SearchItems(string searchText, string? collectionTypeIds, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return this.ApiError(StatusCodes.Status400BadRequest, "searchTextCannotBeEmpty", "Search text cannot be empty.");
            return Ok(await ItemsPage(searchText, collectionTypeIds, page, pageSize));
        }

        private async Task<PagedList<UserProvided>> UsersPage(string searchText, int? page, int? pageSize)
        {
            var users = await _usersRepository.SearchUsersSmartAsync(searchText, page, pageSize);
            return new PagedList<UserProvided>(users.Items.Select(u => (UserProvided)u).ToList(), users.Page, users.PageSize, users.Total);
        }

        private async Task<PagedList<CollectionResult>> CollectionsPage(string searchText, string? collectionTypeIds, int? page, int? pageSize)
        {
            var collections = await _collectionRepository.SearchCollectionsSmart(collectionTypeIds, searchText, page, pageSize);
            var results = new List<CollectionResult>();
            foreach (var collection in collections.Items)
            {
                var user = await _usersRepository.GetItemByIdAsync(collection.UserId);
                if (user != null) results.Add(new CollectionResult(user, collection));
            }
            return new PagedList<CollectionResult>(results, collections.Page, collections.PageSize, collections.Total);
        }

        private async Task<PagedList<ItemResult>> ItemsPage(string searchText, string? collectionTypeIds, int? page, int? pageSize)
        {
            var items = await _itemsRepository.SearchItemsSmart(collectionTypeIds, searchText, page, pageSize);
            var results = new List<ItemResult>();
            foreach (var item in items.Items)
            {
                var collection = await _collectionRepository.GetItemByIdAsync(item.CollectionId);
                if (collection == null) continue;
                var user = await _usersRepository.GetItemByIdAsync(collection.UserId);
                if (user != null) results.Add(new ItemResult(user, collection, item));
            }
            return new PagedList<ItemResult>(results, items.Page, items.PageSize, items.Total);
        }

        [Authorize]
        [HttpGet("UserFollows")]
        public async Task<ActionResult<Coffer.Domain.Paging.GroupedPagedList<CollectionResult>>> UserFollows([FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {

            if(!UserId.HasValue)
            {
                return Unauthorized();
            }

            try
            {
                 var user = await _usersRepository.GetUserById(UserId.Value);
                 if (user == null)
                     return NotFound();

                 var follows = await _followsRepository.FindFollowsPageOfUser(UserId.Value, page, pageSize);

                 List<CollectionResult> followedResults = new List<CollectionResult>();

                 foreach(var follow in follows.Items)
                 {
                     followedResults.Add(new CollectionResult(follow.Collection.User, follow.Collection));
                 }


                return Ok(new Coffer.Domain.Paging.GroupedPagedList<CollectionResult>(followedResults, follows.Page, follows.PageSize, follows.Total, follows.GroupCounts));
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
