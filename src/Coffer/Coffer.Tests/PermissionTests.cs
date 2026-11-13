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

    public class TradePermissionTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly IPermissionService<Guid, TradeRequired> _sut;

        public TradePermissionTests()
        {
            _sut = TestServices.Create(_db).GetRequiredService<IPermissionService<Guid, TradeRequired>>();
        }

        [Fact]
        public async Task User_CannotCreateTrade_AsAnotherUser()
        {
            var attacker = _db.AddUser("attacker");
            var victim = _db.AddUser("victim");

            Assert.False(await _sut.CanCreate(attacker.Id, new TradeRequired(victim.Id, "t", "d")));
        }

        [Fact]
        public async Task User_CannotCreateTrade_WithSomeoneElsesItems()
        {
            var attacker = _db.AddUser("attacker");
            var victimItem = _db.AddItem(_db.AddCollection(_db.AddUser("victim")));
            var required = new TradeRequired(attacker.Id, "t", "d");
            required.TradeItems.Add(new TradeItem { ItemId = victimItem.Id });

            Assert.False(await _sut.CanCreate(attacker.Id, required));
        }

        [Fact]
        public async Task User_CanCreateTrade_WithOwnItems()
        {
            var user = _db.AddUser("user");
            var item = _db.AddItem(_db.AddCollection(user));
            var required = new TradeRequired(user.Id, "t", "d");
            required.TradeItems.Add(new TradeItem { ItemId = item.Id });

            Assert.True(await _sut.CanCreate(user.Id, required));
        }

        [Fact]
        public async Task User_CannotUpdateOrDelete_AnotherUsersTrade()
        {
            var attacker = _db.AddUser("attacker");
            var victim = _db.AddUser("victim");
            var trade = _db.AddTrade(victim);

            Assert.False(await _sut.CanUpdate(attacker.Id, trade.Id, new TradeRequired(attacker.Id, "t", "d")));
            Assert.False(await _sut.CanDelete(attacker.Id, trade.Id));
        }

        [Fact]
        public async Task Owner_CanUpdateAndDelete_OwnTrade()
        {
            var owner = _db.AddUser("owner");
            var trade = _db.AddTrade(owner);

            Assert.True(await _sut.CanUpdate(owner.Id, trade.Id, new TradeRequired(owner.Id, "t2", "d2")));
            Assert.True(await _sut.CanDelete(owner.Id, trade.Id));
        }

        [Fact]
        public async Task Owner_CannotReassignTrade_ToAnotherUser()
        {
            var owner = _db.AddUser("owner");
            var other = _db.AddUser("other");
            var trade = _db.AddTrade(owner);

            Assert.False(await _sut.CanUpdate(owner.Id, trade.Id, new TradeRequired(other.Id, "t", "d")));
        }

        [Fact]
        public async Task Moderator_CanDelete_AnyTrade()
        {
            var moderator = _db.AddUser("mod", UserRole.Moderator);
            var trade = _db.AddTrade(_db.AddUser("owner"));

            Assert.True(await _sut.CanDelete(moderator.Id, trade.Id));
        }

        public void Dispose() => _db.Dispose();
    }

    public class OfferPermissionTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly IServiceProvider _services;

        public OfferPermissionTests()
        {
            _services = TestServices.Create(_db);
        }

        private IPermissionService<Guid, OfferRequired> Sut => _services.GetRequiredService<IPermissionService<Guid, OfferRequired>>();
        private IOfferPermissionService StatusSut => _services.GetRequiredService<IOfferPermissionService>();

        [Fact]
        public void OfferPermissionService_IsResolvable_ForOffersController()
        {
            // OffersController depends on IPermissionService<Guid, OfferRequired>.
            Assert.NotNull(_services.GetService<IPermissionService<Guid, OfferRequired>>());
        }

        [Fact]
        public async Task User_CannotCreateOffer_AsAnotherUser()
        {
            var attacker = _db.AddUser("attacker");
            var victim = _db.AddUser("victim");
            var trade = _db.AddTrade(_db.AddUser("trader"));

            Assert.False(await Sut.CanCreate(attacker.Id, new OfferRequired(trade.Id, victim.Id)));
        }

        [Fact]
        public async Task User_CannotOffer_SomeoneElsesItems()
        {
            var attacker = _db.AddUser("attacker");
            var victimItem = _db.AddItem(_db.AddCollection(_db.AddUser("victim")));
            var trade = _db.AddTrade(_db.AddUser("trader"));
            var required = new OfferRequired(trade.Id, attacker.Id);
            required.OfferItems.Add(new OfferItem { ItemId = victimItem.Id });

            Assert.False(await Sut.CanCreate(attacker.Id, required));
        }

        [Fact]
        public async Task User_CanCreateOffer_WithOwnItems()
        {
            var user = _db.AddUser("user");
            var item = _db.AddItem(_db.AddCollection(user));
            var trade = _db.AddTrade(_db.AddUser("trader"));
            var required = new OfferRequired(trade.Id, user.Id);
            required.OfferItems.Add(new OfferItem { ItemId = item.Id });

            Assert.True(await Sut.CanCreate(user.Id, required));
        }

        [Fact]
        public async Task User_CannotUpdateOrDelete_AnotherUsersOffer()
        {
            var attacker = _db.AddUser("attacker");
            var victim = _db.AddUser("victim");
            var trade = _db.AddTrade(_db.AddUser("trader"));
            var offer = _db.AddOffer(trade, victim);

            Assert.False(await Sut.CanUpdate(attacker.Id, offer.Id, new OfferRequired(trade.Id, attacker.Id)));
            Assert.False(await Sut.CanDelete(attacker.Id, offer.Id));
        }

        [Fact]
        public async Task Offerer_CanUpdateAndDelete_OwnOffer()
        {
            var offerer = _db.AddUser("offerer");
            var trade = _db.AddTrade(_db.AddUser("trader"));
            var offer = _db.AddOffer(trade, offerer);

            Assert.True(await Sut.CanUpdate(offerer.Id, offer.Id, new OfferRequired(trade.Id, offerer.Id)));
            Assert.True(await Sut.CanDelete(offerer.Id, offer.Id));
        }

        [Fact]
        public async Task Offerer_CannotMoveOffer_ToAnotherTrade()
        {
            var offerer = _db.AddUser("offerer");
            var trader = _db.AddUser("trader");
            var trade = _db.AddTrade(trader);
            var otherTrade = _db.AddTrade(trader);
            var offer = _db.AddOffer(trade, offerer);

            Assert.False(await Sut.CanUpdate(offerer.Id, offer.Id, new OfferRequired(otherTrade.Id, offerer.Id)));
        }

        [Fact]
        public async Task OnlyTradeParties_CanChangeOfferStatus()
        {
            var trader = _db.AddUser("trader");
            var offerer = _db.AddUser("offerer");
            var stranger = _db.AddUser("stranger");
            var trade = _db.AddTrade(trader);
            var offer = _db.AddOffer(trade, offerer);

            Assert.True(await StatusSut.CanChangeStatus(trader.Id, offer.Id, "accepted"));
            Assert.True(await StatusSut.CanChangeStatus(offerer.Id, offer.Id, "revertByOfferer"));
            Assert.False(await StatusSut.CanChangeStatus(stranger.Id, offer.Id, "accepted"));
        }

        [Fact]
        public async Task ChangeStatus_RejectsUnknownStatusValues()
        {
            var trader = _db.AddUser("trader");
            var trade = _db.AddTrade(trader);
            var offer = _db.AddOffer(trade, _db.AddUser("offerer"));

            Assert.False(await StatusSut.CanChangeStatus(trader.Id, offer.Id, "<b>hacked</b>"));
        }

        public void Dispose() => _db.Dispose();
    }

    public class TradeReviewPermissionTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly IPermissionService<Guid, TradeReviewRequired> _sut;

        public TradeReviewPermissionTests()
        {
            _sut = TestServices.Create(_db).GetRequiredService<IPermissionService<Guid, TradeReviewRequired>>();
        }

        private (User trader, User offerer, TradeProvided trade) TradedTrade()
        {
            var trader = _db.AddUser("trader");
            var offerer = _db.AddUser("offerer");
            var trade = _db.AddTrade(trader);
            _db.AddOffer(trade, offerer, "traded");
            return (trader, offerer, trade);
        }

        [Fact]
        public async Task TradeParties_CanReviewEachOther_AfterTraded()
        {
            var (trader, offerer, trade) = TradedTrade();

            Assert.True(await _sut.CanCreate(trader.Id, new TradeReviewRequired(trade.Id, trader.Id, offerer.Id, true, "great")));
            Assert.True(await _sut.CanCreate(offerer.Id, new TradeReviewRequired(trade.Id, offerer.Id, trader.Id, true, "great")));
        }

        [Fact]
        public async Task Stranger_CannotReview_ATrade()
        {
            var (trader, _, trade) = TradedTrade();
            var stranger = _db.AddUser("stranger");

            Assert.False(await _sut.CanCreate(stranger.Id, new TradeReviewRequired(trade.Id, stranger.Id, trader.Id, false, "bad")));
        }

        [Fact]
        public async Task User_CannotReview_InSomeoneElsesName()
        {
            var (trader, offerer, trade) = TradedTrade();
            var stranger = _db.AddUser("stranger");

            Assert.False(await _sut.CanCreate(stranger.Id, new TradeReviewRequired(trade.Id, offerer.Id, trader.Id, false, "bad")));
        }

        [Fact]
        public async Task CannotReview_BeforeTradeIsTraded()
        {
            var trader = _db.AddUser("trader");
            var offerer = _db.AddUser("offerer");
            var trade = _db.AddTrade(trader);
            _db.AddOffer(trade, offerer, "pending");

            Assert.False(await _sut.CanCreate(offerer.Id, new TradeReviewRequired(trade.Id, offerer.Id, trader.Id, true, "x")));
        }

        [Fact]
        public async Task OnlyReviewer_CanUpdateOrDelete_Review()
        {
            var (trader, offerer, trade) = TradedTrade();
            var stranger = _db.AddUser("stranger");
            var review = _db.AddReview(trade, offerer, trader);

            Assert.False(await _sut.CanDelete(stranger.Id, review.Id));
            Assert.False(await _sut.CanUpdate(stranger.Id, review.Id, new TradeReviewRequired(trade.Id, offerer.Id, trader.Id, false, "x")));
            Assert.True(await _sut.CanDelete(offerer.Id, review.Id));
            Assert.True(await _sut.CanUpdate(offerer.Id, review.Id, new TradeReviewRequired(trade.Id, offerer.Id, trader.Id, false, "edited")));
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
