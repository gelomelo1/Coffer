using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    /// <summary>
    /// Texts the backend generates are sent language-neutrally so the app can show them in the user's language:
    /// system chat messages as a code + params, field names and deal states in error params as "@t:" translation keys,
    /// amounts as "@eur:" cents.
    /// </summary>
    public class TranslatableTextTests : DealTestBase
    {
        private static async Task<MarketplaceException> Thrown(Func<Task> act) => await Assert.ThrowsAsync<MarketplaceException>(act);

        [Fact]
        public void TextHelpers_SendTheFieldNameAsATranslationKey()
        {
            var tooLong = Assert.Throws<MarketplaceException>(() => Text.Optional(new string('x', 11), 10, "Tracking number"));
            Assert.Equal("@t:errors:fields.trackingNumber", tooLong.Args!["p0"]);
            Assert.Equal("Tracking number must be at most 10 characters.", tooLong.Message); // English message unchanged

            var missing = Assert.Throws<MarketplaceException>(() => Text.Required("", 1, 80, "What you want in exchange"));
            Assert.Equal("@t:errors:fields.whatYouWantInExchange", missing.Args!["p0"]);
        }

        [Fact]
        public async Task WrongDealState_SendsTheStateAsATranslationKey()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            var error = await Thrown(() => Sut().AcceptAsync(Buyer.Id, deal.Id));
            Assert.Equal("notPossibleWhileTheDealIs", error.Code);
            Assert.Equal("@t:market:dealState.awaiting_shipment", error.Args!["p0"]);
        }

        [Fact]
        public async Task ProposedDeal_PostsASystemMessageWithCodeAndParams()
        {
            var (listing, conversationId) = await Chat();
            await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.Shipping);

            var system = (await Conversations().GetTranscriptAsync(conversationId)).Single(m => m.Kind == MessageKind.System);
            Assert.Equal("dealProposedPrice", system.SystemCode);
            Assert.Equal("@t:market:system.method.shipping", system.SystemParams!["method"]);
            Assert.Equal($"@eur:{listing.PriceCents}", system.SystemParams!["price"]);
            Assert.StartsWith("🤝 Deal proposed: shipping", system.Body); // English body kept as a fallback
        }

        [Fact]
        public async Task Inbox_CarriesTheLastMessageForTranslation()
        {
            var (_, conversationId) = await Chat();
            await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);

            var row = (await Conversations().ListMineAsync(Buyer.Id)).Single();
            Assert.Equal(MessageKind.System, row.LastMessage!.Kind);
            Assert.Equal("dealProposedPrice", row.LastMessage.SystemCode);
        }

        [Fact]
        public async Task Dispute_PutsTheUsersTextInAParam()
        {
            var deal = await ActiveDeal(DeliveryMethod.Shipping);
            await Sut().ShipAsync(Seller.Id, deal.Id, "other", "TRACK1234", null);
            await Sut().DisputeAsync(Buyer.Id, deal.Id, "The parcel never arrived, tracking stuck for 10 days.");

            var transcript = await Conversations().GetTranscriptAsync(deal.ConversationId);
            var shipped = transcript.Single(m => m.SystemCode == "shipped");
            Assert.Equal("@t:market:system.otherCarrier", shipped.SystemParams!["carrier"]);
            Assert.Equal("TRACK1234", shipped.SystemParams!["tracking"]);
            var disputed = transcript.Single(m => m.SystemCode == "disputed");
            Assert.Equal("The parcel never arrived, tracking stuck for 10 days.", disputed.SystemParams!["reason"]);
        }

        [Fact]
        public async Task Decline_StoresAGeneratedReasonAsATranslationKey()
        {
            var (_, conversationId) = await Chat();
            var proposed = await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);
            var declined = await Sut().DeclineAsync(Buyer.Id, proposed.Id);

            Assert.Equal("@t:market:system.cancelReason.declined", declined.CancelReason);
            var cancelled = (await Conversations().GetTranscriptAsync(conversationId)).Single(m => m.SystemCode == "dealCancelledReason");
            Assert.Equal("@t:market:system.cancelReason.declined", cancelled.SystemParams!["reason"]);
        }

        [Fact]
        public async Task CompletedDeal_NotifiesOtherChatsWithACode()
        {
            var (listing, conversationId) = await Chat();
            var other = await Conversations().OpenAsync(Db.AddUser("other").Id, "listing", listing.Id);
            var proposed = await Sut().ProposeAsync(Seller.Id, conversationId, DeliveryMethod.LocalPickup);
            var accepted = await Sut().AcceptAsync(Buyer.Id, proposed.Id);
            await Sut().ConfirmHandoffAsync(Seller.Id, accepted.Id, accepted.HandoffPin!);

            var codes = (await Conversations().GetTranscriptAsync(other.Id)).Select(m => m.SystemCode).ToList();
            Assert.Equal(new[] { "listingReserved", "listingSold" }, codes);
            var mine = (await Conversations().GetTranscriptAsync(conversationId)).Select(m => m.SystemCode).ToList();
            Assert.Equal(new[] { "dealProposedPrice", "dealAcceptedPickup", "completedHandoff" }, mine);
        }
    }
}
