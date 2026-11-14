using System.Net;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Marketplace.Terms;
using Coffer.BusinessLogic.Services;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    public class TermsTests : DealTestBase
    {
        private TermsService Terms() => new(Db.Context, Clock);

        private static async Task AssertTermsRequired(Func<Task> act)
        {
            var ex = await Assert.ThrowsAsync<MarketplaceException>(act);
            Assert.Equal(MarketplaceError.Conflict, ex.Error);
            Assert.Equal(MarketTerms.TermsRequiredCode, ex.Code);
        }

        [Fact]
        public async Task TermsRequired_ForCreateListing()
        {
            var newbie = Db.AddUser("newbie", acceptMarketTerms: false);
            var listings = new ListingService(Db.Context, Clock, new ImageService(), new MarketplaceStorage(Folder, Folder));
            var input = new ListingInput(ListingKind.Wanted, CollectionTypeId(), "Looking for caps", null, null, null, null, Budapest.Id,
                true, false, new List<ListingLineInput> { new("Cap", 1) }, null);

            await AssertTermsRequired(() => listings.CreateAsync(newbie.Id, input, Array.Empty<Microsoft.AspNetCore.Http.IFormFile>()));
        }

        [Fact]
        public async Task TermsRequired_ForOpenConversation()
        {
            var listing = AddListing(Seller);
            var newbie = Db.AddUser("newbie", acceptMarketTerms: false);
            await AssertTermsRequired(() => Conversations().OpenAsync(newbie.Id, "listing", listing.Id));
        }

        [Fact]
        public async Task TermsRequired_ForProposeAndAccept()
        {
            var (_, conversationId) = await Chat();
            Revoke(Seller.Id);
            await AssertTermsRequired(() => Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup));

            await Terms().AcceptAsync(Seller.Id, new AcceptTermsInput(MarketTerms.CurrentVersion, true, true));
            var deal = await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);
            Revoke(Buyer.Id);
            await AssertTermsRequired(() => Sut().AcceptAsync(Buyer.Id, deal.Id));
        }

        [Fact]
        public async Task AcceptTerms_RequiresCurrentVersionAndConfirmations()
        {
            var newbie = Db.AddUser("newbie", acceptMarketTerms: false);
            Assert.False((await Terms().GetAsync(newbie.Id)).Accepted);

            Assert.Equal(MarketplaceError.Validation, (await Assert.ThrowsAsync<MarketplaceException>(() => Terms().AcceptAsync(newbie.Id, new AcceptTermsInput("2000-01-01", true, true)))).Error);
            Assert.Equal(MarketplaceError.Validation, (await Assert.ThrowsAsync<MarketplaceException>(() => Terms().AcceptAsync(newbie.Id, new AcceptTermsInput(MarketTerms.CurrentVersion, false, true)))).Error);
            Assert.Equal(MarketplaceError.Validation, (await Assert.ThrowsAsync<MarketplaceException>(() => Terms().AcceptAsync(newbie.Id, new AcceptTermsInput(MarketTerms.CurrentVersion, true, false)))).Error);

            var status = await Terms().AcceptAsync(newbie.Id, new AcceptTermsInput(MarketTerms.CurrentVersion, true, true));
            Assert.True(status.Accepted);
            Assert.Equal(MarketTerms.CurrentVersion, Db.NewContext().Users.Single(u => u.Id == newbie.Id).MarketTermsVersion);
        }

        private void Revoke(Guid userId)
        {
            var user = Db.Context.Users.Single(u => u.Id == userId);
            user.MarketTermsVersion = null;
            Db.Context.SaveChanges();
        }
    }

    [Collection("api")]
    public class TermsApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        [Fact]
        public async Task TermsRequired_Returns409WithCode_ThenAcceptWorks()
        {
            var newbie = _api.Db.AddUser("newbie", acceptMarketTerms: false);
            var client = _api.ClientFor(newbie);

            var blocked = await client.PostAsync($"api/Listings/{Guid.NewGuid()}/Conversations", null);
            Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
            Assert.Contains("\"code\":\"terms_required\"", await blocked.Content.ReadAsStringAsync());

            var accept = await client.PostAsJsonAsync("api/Market/Terms/Accept", new { version = MarketTerms.CurrentVersion, isAdult = true, isPrivatePerson = true });
            Assert.Equal(HttpStatusCode.OK, accept.StatusCode);
            Assert.Contains("\"accepted\":true", await client.GetStringAsync("api/Market/Terms"));
        }

        public void Dispose() => _api.Dispose();
    }
}
