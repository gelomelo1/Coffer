using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests
{
    public class FollowPermissionTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly IPermissionService<Guid, FollowRequired> _sut;

        public FollowPermissionTests()
        {
            _sut = TestServices.Create(_db).GetRequiredService<IPermissionService<Guid, FollowRequired>>();
        }

        [Fact]
        public async Task RegularUser_CannotCreateFollow_OnBehalfOfAnotherUser()
        {
            var attacker = _db.AddUser("attacker");
            var victim = _db.AddUser("victim");
            var owner = _db.AddUser("owner");
            var collection = _db.AddCollection(owner);

            Assert.False(await _sut.CanCreate(attacker.Id, new FollowRequired(victim.Id, collection.Id)));
        }

        [Fact]
        public async Task RegularUser_CannotFollow_OwnCollection()
        {
            var user = _db.AddUser("user");
            var collection = _db.AddCollection(user);

            Assert.False(await _sut.CanCreate(user.Id, new FollowRequired(user.Id, collection.Id)));
        }

        [Fact]
        public async Task RegularUser_CanFollow_OthersCollection_ForThemselves()
        {
            var user = _db.AddUser("user");
            var collection = _db.AddCollection(_db.AddUser("owner"));

            Assert.True(await _sut.CanCreate(user.Id, new FollowRequired(user.Id, collection.Id)));
        }

        [Fact]
        public async Task RegularUser_CannotDelete_AnotherUsersFollow()
        {
            var attacker = _db.AddUser("attacker");
            var victim = _db.AddUser("victim");
            var collection = _db.AddCollection(_db.AddUser("owner"));
            var follow = new FollowProvided(victim.Id, collection.Id);
            _db.Context.Follows.Add(follow);
            _db.Context.SaveChanges();

            Assert.False(await _sut.CanDelete(attacker.Id, follow.Id));
            Assert.True(await _sut.CanDelete(victim.Id, follow.Id));
        }

        public void Dispose() => _db.Dispose();
    }

    public class CollectionPermissionHtmlTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly IPermissionService<Guid, CollectionRequired> _sut;

        public CollectionPermissionHtmlTests()
        {
            _sut = TestServices.Create(_db).GetRequiredService<IPermissionService<Guid, CollectionRequired>>();
        }

        [Fact]
        public async Task CollectionDescription_WithDangerousHtml_IsRejected()
        {
            var user = _db.AddUser("user");
            var typeId = _db.AddCollection(user).CollectionTypeId;

            Assert.False(await _sut.CanCreate(user.Id, new CollectionRequired(user.Id, typeId, "c", "<img src=x onerror=alert(1)>")));
        }

        [Fact]
        public async Task CollectionDescription_WithFormattedHtml_IsAccepted()
        {
            var user = _db.AddUser("user");
            var collection = _db.AddCollection(user);

            Assert.True(await _sut.CanUpdate(user.Id, collection.Id,
                new CollectionRequired(user.Id, collection.CollectionTypeId, "c", "<p><strong>Rare</strong> coins</p>")));
        }

        public void Dispose() => _db.Dispose();
    }
}
