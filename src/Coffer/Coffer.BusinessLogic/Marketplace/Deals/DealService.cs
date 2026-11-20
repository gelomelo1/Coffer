using System.Security.Cryptography;
using System.Text;
using Coffer.BusinessLogic.Activity;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Marketplace.Terms;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Coffer.Domain.Constants;
using Coffer.Domain.Marketplace;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Deals
{
    public interface IDealService
    {
        Task<DealDto> ProposeAsync(Guid userId, Guid conversationId, DeliveryMethod method);
        Task<DealDto> AcceptAsync(Guid userId, Guid dealId);
        Task<DealDto> DeclineAsync(Guid userId, Guid dealId);
        Task<DealDto> CancelAsync(Guid userId, Guid dealId, string? reason);
        Task<DealDto> ConfirmHandoffAsync(Guid userId, Guid dealId, string pin);
        Task<DealDto> ShipAsync(Guid userId, Guid dealId, string carrier, string trackingNumber, IFormFile? photo);
        Task<DealDto> ConfirmReceiptAsync(Guid userId, Guid dealId, IFormFile? photo);
        Task<DealDto> DisputeAsync(Guid userId, Guid dealId, string reason);
        Task<DealDto> GetAsync(Guid userId, Guid dealId);
        Task<List<DealDto>> GetMineAsync(Guid userId);
        Task<Coffer.Domain.Paging.PagedList<DealDto>> GetMinePageAsync(Guid userId, int? page, int? pageSize);
        Task<bool> CanViewPhotoAsync(Guid userId, string fileName);
        /// <summary>Persists time-based transitions (shipping auto-complete). Used by the hourly sweeper.</summary>
        Task ApplyDueTimeRulesAsync();
    }

    /// <summary>
    /// The deal state machine. Every command checks (1) the caller is the right party, (2) the deal is in the
    /// right state, then mutates, saves and leaves an audit line in the chat.
    ///
    ///   proposed --accept(buyer)--> awaiting_handoff --confirm-handoff(seller, buyer's PIN)--> completed
    ///                          \--> awaiting_shipment --ship(seller)--> shipped --confirm-receipt(buyer)--> completed
    ///                                                                         \--dispute(buyer)--> disputed (terminal, reviews open)
    ///                                                                         \--14 days, no dispute--> completed
    ///   proposed|awaiting_* --decline(buyer)/cancel(either)--> cancelled
    ///
    /// Coffer never decides who was right: a dispute just ends the deal and lets both sides review each other.
    /// </summary>
    public class DealService : IDealService
    {
        public static readonly TimeSpan ReviewWindow = TimeSpan.FromDays(14);
        public static readonly TimeSpan AutoCompleteAfter = TimeSpan.FromDays(14);
        public static readonly TimeSpan PinLock = TimeSpan.FromMinutes(15);
        public const int MaxPinAttempts = 5;
        private const string QrPrefix = "coffer-handoff:";

        private readonly CofferDbContext _db;
        private readonly IActivityLog? _activity;
        private readonly IClock _clock;
        private readonly IConversationService _conversations;
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;

        public DealService(CofferDbContext db, IClock clock, IConversationService conversations,
            IImageService images, MarketplaceStorage storage, IActivityLog? activity = null)
        {
            _db = db;
            _clock = clock;
            _conversations = conversations;
            _images = images;
            _storage = storage;
            _activity = activity;
        }

        // ------------------------------------------------------------------ lifecycle

        public async Task<DealDto> ProposeAsync(Guid userId, Guid conversationId, DeliveryMethod method)
        {
            var conversation = await _db.Conversations.Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.Participants.Any(p => p.UserId == userId))
                ?? throw MarketplaceException.NotFound("conversationNotFound", "Conversation not found.");
            if (conversation.SubjectType != ListingConversationPolicy.Type)
                throw MarketplaceException.Validation("dealsCanOnlyBeMadeAboutListings", "Deals can only be made about listings.");
            var listing = await _db.Listings.FirstOrDefaultAsync(l => l.Id == conversation.SubjectId)
                ?? throw MarketplaceException.NotFound("listingNotFound", "Listing not found.");

            var owner = conversation.Participants.Single(p => p.Role == ParticipantRole.Owner).UserId;
            var inquirer = conversation.Participants.Single(p => p.Role == ParticipantRole.Inquirer).UserId;
            var (sellerId, buyerId) = listing.Kind == ListingKind.Wanted ? (inquirer, owner) : (owner, inquirer);

            if (userId != sellerId) throw MarketplaceException.Forbidden("onlyTheSellerCanProposeTheDeal", "Only the seller can propose the deal.");
            await MarketTerms.EnsureAcceptedAsync(_db, userId);
            if (listing.Status != ListingStatus.Active) throw MarketplaceException.Conflict("thisListingIsNotAvailableForA", "This listing is not available for a new deal.");
            if (!Enum.IsDefined(method)) throw MarketplaceException.Validation("unknownDeliveryMethod", "Unknown delivery method.");
            if (method == DeliveryMethod.LocalPickup && !listing.AllowsLocalPickup)
                throw MarketplaceException.Validation("thisListingDoesNotOfferPersonalPickup", "This listing does not offer personal pickup.");
            if (method == DeliveryMethod.Shipping && !listing.AllowsShipping)
                throw MarketplaceException.Validation("thisListingDoesNotOfferShipping", "This listing does not offer shipping.");
            if (await _db.Deals.AnyAsync(d => d.ListingId == listing.Id && d.Status != DealStatus.Completed && d.Status != DealStatus.Cancelled && d.Status != DealStatus.Disputed))
                throw MarketplaceException.Conflict("thereIsAlreadyADealInProgress", "There is already a deal in progress for this listing.");

            var now = _clock.UtcNow;
            var deal = new Deal
            {
                ListingId = listing.Id,
                ConversationId = conversation.Id,
                SellerId = sellerId,
                BuyerId = buyerId,
                Method = method,
                Status = DealStatus.Proposed,
                AgreedPriceCents = listing.Kind == ListingKind.Exchange ? null : conversation.AgreedPriceCents ?? listing.PriceCents,
                CreatedAt = now,
                UpdatedAt = now,
            };
            _db.Deals.Add(deal);
            RecordDeal(userId, "deal.proposed", deal, new { method = EnumText.ToSnake(method) });
            await SaveOrConflictAsync("dealAlreadyInProgress", "There is already a deal in progress for this listing.");

            var proposedArgs = new Dictionary<string, string> { ["method"] = ErrorArgs.Key($"market:system.method.{EnumText.ToSnake(method)}") };
            if (deal.AgreedPriceCents.HasValue) proposedArgs["price"] = ErrorArgs.Money(deal.AgreedPriceCents.Value);
            await _conversations.PostSystemAsync(conversation.Id, deal.AgreedPriceCents.HasValue ? "dealProposedPrice" : "dealProposed",
                $"🤝 Deal proposed: {MethodText(method)}{PriceText(deal.AgreedPriceCents)}. Waiting for the buyer to accept.", proposedArgs);
            return await GetAsync(userId, deal.Id);
        }

        public async Task<DealDto> AcceptAsync(Guid userId, Guid dealId)
        {
            var deal = await LoadAsync(userId, dealId);
            RequireBuyer(deal, userId);
            RequireStatus(deal, DealStatus.Proposed);
            await MarketTerms.EnsureAcceptedAsync(_db, userId);
            if (deal.Listing.Status != ListingStatus.Active) throw MarketplaceException.Conflict("thisListingIsNoLongerAvailable", "This listing is no longer available.");

            if (deal.Method == DeliveryMethod.LocalPickup)
            {
                deal.Status = DealStatus.AwaitingHandoff;
                deal.HandoffPin = NewPin();
                deal.Listing.Status = ListingStatus.PendingPickup;
            }
            else
            {
                deal.Status = DealStatus.AwaitingShipment;
                deal.Listing.Status = ListingStatus.PendingShipment;
            }
            Touch(deal);
            RecordDeal(userId, "deal.accepted", deal);
            await _db.SaveChangesAsync();

            if (deal.Method == DeliveryMethod.LocalPickup)
                await _conversations.PostSystemAsync(deal.ConversationId, "dealAcceptedPickup",
                    "✅ Deal accepted. At the meetup the buyer shows their PIN/QR only after checking the item; the seller enters it to finish.");
            else
                await _conversations.PostSystemAsync(deal.ConversationId, "dealAcceptedShipping",
                    "✅ Deal accepted. Seller: ship the item and register the carrier + tracking number here.");
            await NotifyOtherConversationsAsync(deal, "listingReserved", "ℹ️ This listing is now reserved for another buyer.");
            return await GetAsync(userId, dealId);
        }

        public async Task<DealDto> DeclineAsync(Guid userId, Guid dealId)
        {
            var deal = await LoadAsync(userId, dealId);
            RequireBuyer(deal, userId);
            RequireStatus(deal, DealStatus.Proposed);
            RecordDeal(userId, "deal.declined", deal);
            await CancelInternalAsync(deal, userId, DeclinedReason);
            return await GetAsync(userId, dealId);
        }

        public async Task<DealDto> CancelAsync(Guid userId, Guid dealId, string? reason)
        {
            var deal = await LoadAsync(userId, dealId);
            RequireStatus(deal, DealStatus.Proposed, DealStatus.AwaitingHandoff, DealStatus.AwaitingShipment);
            var cancelReason = Text.Optional(reason, 300, "Reason");
            RecordDeal(userId, "deal.cancelled", deal);
            await CancelInternalAsync(deal, userId, cancelReason);
            return await GetAsync(userId, dealId);
        }

        // ------------------------------------------------------------------ local pickup

        public async Task<DealDto> ConfirmHandoffAsync(Guid userId, Guid dealId, string pin)
        {
            var deal = await LoadAsync(userId, dealId);
            RequireSeller(deal, userId);
            RequireStatus(deal, DealStatus.AwaitingHandoff);
            var now = _clock.UtcNow;
            if (deal.PinLockedUntil > now)
                throw MarketplaceException.Conflict("tooManyWrongPinsTryAgainIn", "Too many wrong PINs. Try again in a few minutes.");

            var entered = NormalizePin(pin, deal.Id);
            if (!PinEquals(entered, deal.HandoffPin))
            {
                deal.PinFailedAttempts++;
                MarketplaceException error;
                if (deal.PinFailedAttempts >= MaxPinAttempts)
                {
                    deal.HandoffPin = NewPin();
                    deal.PinFailedAttempts = 0;
                    deal.PinLockedUntil = now.Add(PinLock);
                    error = MarketplaceException.Validation("wrongPinLocked", "Wrong PIN. Too many attempts: the buyer got a new PIN, try again in 15 minutes.");
                }
                else
                {
                    var left = MaxPinAttempts - deal.PinFailedAttempts;
                    error = MarketplaceException.Validation("wrongPinAttemptsLeft", $"Wrong PIN. {left} attempt(s) left.", ErrorArgs.Of($"{left}"));
                }
                Touch(deal);
                await _db.SaveChangesAsync();
                throw error;
            }

            RecordDeal(userId, "deal.handoffConfirmed", deal); // only on the right PIN; a wrong PIN saves its counter but is no action
            await CompleteAsync(deal, CompletionReason.HandoffVerified);
            return await GetAsync(userId, dealId);
        }

        // ------------------------------------------------------------------ shipping

        public async Task<DealDto> ShipAsync(Guid userId, Guid dealId, string carrier, string trackingNumber, IFormFile? photo)
        {
            var deal = await LoadAsync(userId, dealId);
            RequireSeller(deal, userId);
            RequireStatus(deal, DealStatus.AwaitingShipment);
            var code = (carrier ?? "").Trim().ToLowerInvariant();
            if (!Carriers.IsKnown(code)) throw MarketplaceException.Validation("chooseACarrierFromTheList", "Choose a carrier from the list.");
            var tracking = Text.Required(trackingNumber, 4, 40, "Tracking number");
            if (!tracking.All(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == ' '))
                throw MarketplaceException.Validation("trackingNumberMayOnlyContainLettersDigits", "Tracking number may only contain letters, digits, spaces and dashes.");

            if (photo != null) deal.ShipmentPhoto = await SavePhotoAsync(photo);
            deal.Carrier = code;
            deal.TrackingNumber = tracking;
            deal.ShippedAt = _clock.UtcNow;
            deal.Status = DealStatus.Shipped;
            Touch(deal);
            RecordDeal(userId, "deal.shipped", deal, new { carrier = code });
            await _db.SaveChangesAsync();

            var carrierParam = code == "other" ? ErrorArgs.Key("market:system.otherCarrier") : Carriers.Label(code)!;
            await _conversations.PostSystemAsync(deal.ConversationId, "shipped",
                $"📦 Shipped with {Carriers.Label(code)}, tracking number {tracking}. Buyer: confirm receipt when it arrives " +
                "(or report a problem). Without either, the deal completes automatically after 14 days.",
                new Dictionary<string, string> { ["carrier"] = carrierParam, ["tracking"] = tracking });
            return await GetAsync(userId, dealId);
        }

        public async Task<DealDto> ConfirmReceiptAsync(Guid userId, Guid dealId, IFormFile? photo)
        {
            var deal = await LoadAsync(userId, dealId);
            RequireBuyer(deal, userId);
            RequireStatus(deal, DealStatus.Shipped);
            if (photo != null) deal.ReceiptPhoto = await SavePhotoAsync(photo);
            deal.ReceivedAt = _clock.UtcNow;
            RecordDeal(userId, "deal.receiptConfirmed", deal);
            await CompleteAsync(deal, CompletionReason.ReceiptConfirmed);
            return await GetAsync(userId, dealId);
        }

        /// <summary>
        /// Buyer reports a problem with a shipment. Coffer does not arbitrate: the deal ends as "disputed",
        /// the reason is posted in the chat, and both sides can leave a review. The listing is archived
        /// (the owner may reactivate it if the item comes back).
        /// </summary>
        public async Task<DealDto> DisputeAsync(Guid userId, Guid dealId, string reason)
        {
            var deal = await LoadAsync(userId, dealId);
            RequireBuyer(deal, userId);
            RequireStatus(deal, DealStatus.Shipped);
            var text = Text.Required(reason, 20, 1000, "Problem description");

            var now = _clock.UtcNow;
            deal.Status = DealStatus.Disputed;
            deal.DisputeReason = text;
            deal.DisputedAt = now;
            deal.ReviewDeadline = now + ReviewWindow;
            deal.Listing.Status = ListingStatus.Archived;
            deal.Listing.UpdatedAt = now;
            Touch(deal);
            RecordDeal(userId, "deal.disputed", deal);
            await _db.SaveChangesAsync();

            await _conversations.PostSystemAsync(deal.ConversationId, "disputed",
                $"⚠️ The buyer reported a problem: \"{text}\". The deal is closed as disputed — Coffer does not decide " +
                "who is right. You can both leave a review within 14 days.",
                new Dictionary<string, string> { ["reason"] = text });
            return await GetAsync(userId, dealId);
        }

        // ------------------------------------------------------------------ queries

        public async Task<DealDto> GetAsync(Guid userId, Guid dealId)
        {
            var deal = await LoadAsync(userId, dealId);
            await ApplyTimeRulesAsync(deal);
            return await ToDtoAsync(deal, userId);
        }

        public async Task<Coffer.Domain.Paging.PagedList<DealDto>> GetMinePageAsync(Guid userId, int? page, int? pageSize)
        {
            var deals = await Coffer.DataAccess.Extensions.PagingExtensions.ToPagedListAsync(Query().Where(d => d.SellerId == userId || d.BuyerId == userId)
                .OrderByDescending(d => d.UpdatedAt).ThenBy(d => d.Id), page, pageSize);
            var result = new List<DealDto>();
            foreach (var deal in deals.Items)
            {
                await ApplyTimeRulesAsync(deal);
                result.Add(await ToDtoAsync(deal, userId));
            }
            return new Coffer.Domain.Paging.PagedList<DealDto>(result, deals.Page, deals.PageSize, deals.Total);
        }

        public async Task<List<DealDto>> GetMineAsync(Guid userId)
        {
            var deals = await Query().Where(d => d.SellerId == userId || d.BuyerId == userId)
                .OrderByDescending(d => d.UpdatedAt).ToListAsync();
            var result = new List<DealDto>();
            foreach (var deal in deals)
            {
                await ApplyTimeRulesAsync(deal);
                result.Add(await ToDtoAsync(deal, userId));
            }
            return result;
        }

        public async Task<bool> CanViewPhotoAsync(Guid userId, string fileName)
        {
            var deal = await _db.Deals.AsNoTracking()
                .FirstOrDefaultAsync(d => d.ShipmentPhoto == fileName || d.ReceiptPhoto == fileName);
            if (deal == null) return false;
            if (deal.SellerId == userId || deal.BuyerId == userId) return true;
            var role = await _db.Users.Where(u => u.Id == userId).Select(u => (UserRole?)u.Role).FirstOrDefaultAsync();
            return role is UserRole.Moderator or UserRole.Admin;
        }

        // ------------------------------------------------------------------ time rules & moderation

        public async Task ApplyDueTimeRulesAsync()
        {
            var cutoff = _clock.UtcNow - AutoCompleteAfter;
            var due = await Query().Where(d => d.Status == DealStatus.Shipped && d.ShippedAt <= cutoff).ToListAsync();
            foreach (var deal in due) await ApplyTimeRulesAsync(deal);
        }

        private async Task ApplyTimeRulesAsync(Deal deal)
        {
            if (deal.Status == DealStatus.Shipped && deal.ShippedAt.HasValue && _clock.UtcNow >= deal.ShippedAt.Value + AutoCompleteAfter)
                await CompleteAsync(deal, CompletionReason.AutoCompleted);
        }

        private async Task CompleteAsync(Deal deal, CompletionReason reason)
        {
            var now = _clock.UtcNow;
            deal.Status = DealStatus.Completed;
            deal.CompletionReason = reason;
            deal.CompletedAt = now;
            deal.ReviewDeadline = now + ReviewWindow;
            deal.HandoffPin = null;
            deal.Listing.Status = ListingStatus.Sold;
            deal.Listing.UpdatedAt = now;
            Touch(deal);
            await _db.SaveChangesAsync();

            var (code, why) = reason switch
            {
                CompletionReason.HandoffVerified => ("completedHandoff", "Handoff verified with the buyer's PIN."),
                CompletionReason.ReceiptConfirmed => ("completedReceipt", "The buyer confirmed receipt."),
                CompletionReason.AutoCompleted => ("completedAuto", "No problem was reported within 14 days of shipping."),
                _ => ("completedModerator", "Completed by a moderator."),
            };
            await _conversations.PostSystemAsync(deal.ConversationId, code,
                $"🎉 Deal completed. {why} You can now review each other for 14 days — reviews stay hidden until both of you submit.");
            await NotifyOtherConversationsAsync(deal, "listingSold", "ℹ️ This listing has been sold.");
        }

        private async Task CancelInternalAsync(Deal deal, Guid userId, string? reason)
        {
            deal.Status = DealStatus.Cancelled;
            deal.CancelledBy = userId;
            deal.CancelReason = reason;
            deal.HandoffPin = null;
            if (deal.Listing.Status is ListingStatus.PendingPickup or ListingStatus.PendingShipment)
            {
                deal.Listing.Status = ListingStatus.Active;
                deal.Listing.UpdatedAt = _clock.UtcNow;
            }
            Touch(deal);
            await _db.SaveChangesAsync();
            if (reason == null)
                await _conversations.PostSystemAsync(deal.ConversationId, "dealCancelled", "✖️ Deal cancelled.");
            else
                await _conversations.PostSystemAsync(deal.ConversationId, "dealCancelledReason", $"✖️ Deal cancelled: {EnglishReason(reason)}",
                    new Dictionary<string, string> { ["reason"] = reason });
        }

        // ------------------------------------------------------------------ helpers

        private IQueryable<Deal> Query() => _db.Deals
            .Include(d => d.Listing).ThenInclude(l => l.Images)
            .Include(d => d.Seller).Include(d => d.Buyer);

        /// <summary>Loads a deal the user is a party of; anyone else gets NotFound (no existence leak).</summary>
        private async Task<Deal> LoadAsync(Guid userId, Guid dealId) =>
            await Query().FirstOrDefaultAsync(d => d.Id == dealId && (d.SellerId == userId || d.BuyerId == userId))
            ?? throw MarketplaceException.NotFound("dealNotFound", "Deal not found.");

        private static void RequireBuyer(Deal deal, Guid userId)
        {
            if (deal.BuyerId != userId) throw MarketplaceException.Forbidden("onlyTheBuyerCanDoThis", "Only the buyer can do this.");
        }

        private static void RequireSeller(Deal deal, Guid userId)
        {
            if (deal.SellerId != userId) throw MarketplaceException.Forbidden("onlyTheSellerCanDoThis", "Only the seller can do this.");
        }

        private static void RequireStatus(Deal deal, params DealStatus[] allowed)
        {
            if (!allowed.Contains(deal.Status))
                throw MarketplaceException.Conflict("notPossibleWhileTheDealIs", $"Not possible while the deal is {EnumText.ToSnake(deal.Status).Replace('_', ' ')}.", ErrorArgs.Of(ErrorArgs.Key($"market:dealState.{EnumText.ToSnake(deal.Status)}")));
        }

        private void Touch(Deal deal) => deal.UpdatedAt = _clock.UtcNow;

        /// <summary>Logs a deal step for the party who took it (saved by the step's own save). Automatic and moderator steps are not logged.</summary>
        private void RecordDeal(Guid userId, string kind, Deal deal, object? details = null) =>
            _activity?.Record(userId, kind, new ActivityTargets(DealId: deal.Id, ConversationId: deal.ConversationId, ListingId: deal.ListingId,
                OtherUserId: deal.SellerId == userId ? deal.BuyerId : deal.SellerId), details);

        private async Task SaveOrConflictAsync(string code, string message)
        {
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { throw MarketplaceException.Conflict(code, message); }
        }

        private static string NewPin() => RandomNumberGenerator.GetInt32(0, 10000).ToString("D4");

        /// <summary>Accepts the typed 4 digits or the scanned QR text "coffer-handoff:{dealId}:{pin}".</summary>
        private static string NormalizePin(string? input, Guid dealId)
        {
            var value = (input ?? "").Trim();
            if (value.StartsWith(QrPrefix, StringComparison.OrdinalIgnoreCase))
            {
                var parts = value.Substring(QrPrefix.Length).Split(':');
                if (parts.Length != 2 || !Guid.TryParse(parts[0], out var qrDeal) || qrDeal != dealId)
                    throw MarketplaceException.Validation("thisQrCodeBelongsToADifferent", "This QR code belongs to a different deal.");
                value = parts[1];
            }
            if (value.Length != 4 || !value.All(char.IsAsciiDigit))
                throw MarketplaceException.Validation("thePinHas4Digits", "The PIN has 4 digits.");
            return value;
        }

        private static bool PinEquals(string entered, string? expected) =>
            expected != null && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(entered), Encoding.ASCII.GetBytes(expected));

        private async Task<string> SavePhotoAsync(IFormFile photo)
        {
            ImageUploadGuard.Validate(photo);
            return await _images.SaveImageAsync(photo, Guid.NewGuid(), _storage.DealImages);
        }

        private async Task NotifyOtherConversationsAsync(Deal deal, string code, string text)
        {
            var others = await _db.Conversations
                .Where(c => c.SubjectType == ListingConversationPolicy.Type && c.SubjectId == deal.ListingId && c.Id != deal.ConversationId)
                .Select(c => c.Id).ToListAsync();
            foreach (var id in others) await _conversations.PostSystemAsync(id, code, text);
        }

        private static string MethodText(DeliveryMethod m) => m == DeliveryMethod.LocalPickup ? "personal pickup" : "shipping";

        /// <summary>Generated cancel reasons are stored as translation keys (the app shows them in the user's language).</summary>
        public static readonly string DeclinedReason = ErrorArgs.Key("market:system.cancelReason.declined");
        public static readonly string RuleBreakReason = ErrorArgs.Key("market:system.cancelReason.listingRemoved");

        private static string EnglishReason(string reason) =>
            reason == DeclinedReason ? "Declined by the buyer."
            : reason == RuleBreakReason ? "The listing was removed for breaking the marketplace rules."
            : reason;

        private static string PriceText(int? cents) => cents.HasValue ? $" for €{cents.Value / 100m:0.00}" : "";

        private async Task<DealDto> ToDtoAsync(Deal d, Guid viewerId)
        {
            var isBuyer = d.BuyerId == viewerId;
            var showPin = isBuyer && d.Status == DealStatus.AwaitingHandoff && d.HandoffPin != null;
            var actions = new List<string>();
            switch (d.Status)
            {
                case DealStatus.Proposed:
                    if (isBuyer) actions.AddRange(new[] { "accept", "decline" }); else actions.Add("cancel");
                    break;
                case DealStatus.AwaitingHandoff:
                    actions.Add(isBuyer ? "show_pin" : "enter_pin");
                    actions.Add("cancel");
                    break;
                case DealStatus.AwaitingShipment:
                    if (!isBuyer) actions.Add("ship");
                    actions.Add("cancel");
                    break;
                case DealStatus.Shipped:
                    if (isBuyer) actions.AddRange(new[] { "confirm_receipt", "dispute" });
                    break;
                case DealStatus.Completed:
                case DealStatus.Disputed:
                    if (d.ReviewDeadline > _clock.UtcNow
                        && !await _db.Reviews.AnyAsync(r => r.DealId == d.Id && r.ReviewerId == viewerId))
                        actions.Add("review");
                    break;
            }

            return new DealDto(
                d.Id, d.ListingId, d.Listing.Title, d.Listing.Images.OrderBy(i => i.Position).Select(i => i.FileName).FirstOrDefault(),
                d.Listing.Kind, d.ConversationId, UserSummaryDto.From(d.Seller), UserSummaryDto.From(d.Buyer),
                isBuyer ? ReviewerRole.Buyer : ReviewerRole.Seller, d.Method, d.Status, d.AgreedPriceCents, d.MeetupAt, d.MeetupPlace,
                showPin ? d.HandoffPin : null, showPin ? $"{QrPrefix}{d.Id}:{d.HandoffPin}" : null, d.PinLockedUntil,
                d.Carrier, Carriers.Label(d.Carrier), d.TrackingNumber, Carriers.TrackingUrl(d.Carrier, d.TrackingNumber),
                d.ShipmentPhoto, d.ShippedAt, d.ShippedAt.HasValue && d.Status == DealStatus.Shipped ? d.ShippedAt + AutoCompleteAfter : null,
                d.ReceiptPhoto, d.ReceivedAt, d.CompletedAt, d.CompletionReason, d.ReviewDeadline, d.DisputeReason, d.DisputedAt, d.CancelReason,
                d.CreatedAt, d.UpdatedAt, actions, d.Listing.DeletedAt != null);
        }
    }
}
