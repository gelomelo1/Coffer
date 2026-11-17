using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests
{
    public class ReactionPermissionTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly IPermissionService<Guid, ReactionRequired> _sut;

        public ReactionPermissionTests()
        {
            _sut = TestServices.Create(_db).GetRequiredService<IPermissionService<Guid, ReactionRequired>>();
        }

        private ReactionProvided AddReaction(User user, ItemProvided item, bool liked = true, int? rarity = null)
        {
            var reaction = new ReactionProvided(user.Id, item.Id, liked, rarity);
            _db.Context.Reactions.Add(reaction);
            _db.Context.SaveChanges();
            return reaction;
        }

        [Fact]
        public async Task User_CanUpdate_OwnReaction_ToAddRarity_AfterLiking()
        {
            var user = _db.AddUser("liker");
            var item = _db.AddItem(_db.AddCollection(_db.AddUser("owner")));
            var reaction = AddReaction(user, item);

            Assert.True(await _sut.CanUpdate(user.Id, reaction.Id, new ReactionRequired(user.Id, item.Id, true, 3)));
        }

        [Fact]
        public async Task User_CannotUpdate_OwnReaction_OntoAnItemInTheirOwnCollection()
        {
            var user = _db.AddUser("liker");
            var item = _db.AddItem(_db.AddCollection(_db.AddUser("owner")));
            var ownItem = _db.AddItem(_db.AddCollection(user));
            var reaction = AddReaction(user, item);

            Assert.False(await _sut.CanUpdate(user.Id, reaction.Id, new ReactionRequired(user.Id, ownItem.Id, true, 3)));
        }

        [Fact]
        public async Task User_CannotUpdate_OwnReaction_OnBehalfOfAnotherUser()
        {
            var user = _db.AddUser("liker");
            var other = _db.AddUser("other");
            var item = _db.AddItem(_db.AddCollection(_db.AddUser("owner")));
            var reaction = AddReaction(user, item);

            Assert.False(await _sut.CanUpdate(user.Id, reaction.Id, new ReactionRequired(other.Id, item.Id, true, 3)));
        }

        [Fact]
        public async Task User_CannotUpdate_AnotherUsersReaction()
        {
            var attacker = _db.AddUser("attacker");
            var victim = _db.AddUser("victim");
            var item = _db.AddItem(_db.AddCollection(_db.AddUser("owner")));
            var reaction = AddReaction(victim, item);

            Assert.False(await _sut.CanUpdate(attacker.Id, reaction.Id, new ReactionRequired(victim.Id, item.Id, true, 3)));
        }

        public void Dispose() => _db.Dispose();
    }
}
