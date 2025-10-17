using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class FeedController : ControllerBase
    {
        private readonly IItemsRepository _itemsRepository;
        private readonly IUsersRepository _usersRepository;

        public FeedController(IItemsRepository itemsRepository, IUsersRepository usersRepository)
        {
            _itemsRepository = itemsRepository;
            _usersRepository = usersRepository;
        }

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
    }
}
