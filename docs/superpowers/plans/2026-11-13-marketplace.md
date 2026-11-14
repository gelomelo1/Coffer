# Coffer Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Barter feature with a listing marketplace, generic chat, PIN/QR + shipping verified deals, double-blind reviews and a moderation queue.

**Architecture:** New `Marketplace` folders in Domain / BusinessLogic / ASPNET. Business-logic services own every state transition and talk to `CofferDbContext` directly; thin controllers map `MarketplaceException` to HTTP codes. Time comes from an injectable `IClock` so 14-day rules are testable. Frontend replaces the barter tab with a "Market" tab built from existing custom UI components.

**Tech Stack:** ASP.NET Core 8, EF Core 9 (Npgsql prod / SQLite tests), xUnit; Expo 54, expo-router, react-query, zustand, react-native-elements, expo-camera, react-native-qrcode-svg.

**Spec:** `docs/superpowers/specs/2026-11-13-marketplace-design.md`

## Global Constraints

- Enum values persisted as snake_case text (`pending_pickup`, `local_pickup`, `item_not_as_described`, …) exactly as listed in spec §5.
- Money: `PriceCents int`, currency always `"EUR"`.
- Review window and shipping auto-complete: **14 days**. PIN: **4 digits**, **5** wrong tries → regenerate + **15 min** lock.
- Low rating (stars ≤ 2): reason tag required and trimmed comment ≥ **20** chars. Comment ≤ 1000, reply ≤ 500.
- Listing: title 1..80, description ≤ 2000, 1..30 lines (name 1..80, qty 1..9999), 0..6 images, ≥1 image for sell/exchange.
- Every endpoint `[Authorize]`; actor is always `BaseController.UserId`, never a body field.
- Errors: 400 validation · 403 wrong actor · 404 missing/not visible · 409 wrong state.
- Frontend colors only from `customTheme`; fonts `VendSans` / `VendSansBold`; 2px square borders.
- Warning copy (spec §2): **"Coffer does not handle payments. Advance payment and shipping are at your own risk — only pay in advance or ship to people you trust."**
- No git commits unless the user asks (working tree holds unrelated uncommitted work).
- dotnet is at `"C:\Program Files\dotnet\dotnet.exe"` (not on PATH in bash).

## Review Focus

1. Two buyers accept / two deals proposed on the same listing at once → exactly one succeeds, other gets 409 (Task 5 test `Propose_SecondOpenDealOnListing_Conflicts`).
2. Owner edits price after a deal was proposed → edit rejected with 409 so the buyer accepts what they saw (Task 3 test `Update_WithOpenDeal_Conflicts`).
3. Wanted listing: role inversion — inquirer is seller, owner is buyer; owner must not be able to propose (Task 5 test `WantedListing_InquirerIsSeller`).
4. Upload of a non-image or >6 images → 400 and no files left behind (Task 3 test `Create_RejectsNonImageFile`).
5. Meetup proposed in the past / offer of 0 or negative → 400 (Task 4 tests `Meetup_InPast_Rejected`, `Offer_NonPositive_Rejected`).

---

### Task 1: Domain model, DbContext, removal of old barter backend, SQL migration

**Files:**
- Create: `src/Coffer/Coffer.Domain/Marketplace/Enums.cs`, `City.cs`, `Listing.cs` (Listing, ListingLine, ListingImage), `Conversation.cs` (Conversation, ConversationParticipant, Message), `Deal.cs`, `Review.cs`, `ModerationCase.cs`
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Common/IClock.cs`, `MarketplaceException.cs`
- Create: `src/Coffer/Coffer.ASPNET/Extensions/MarketplaceExceptionFilter.cs`
- Create: `src/startup/marketplace_migration.sql`
- Modify: `src/Coffer/Coffer.DataAccess/CofferDbContext.cs` (remove Trades/TradeItems/Offers/OfferItems/TradeReviews; add new sets + `OnModelCreating` config)
- Delete: Trade/Offer/TradeReview entities, repositories, include providers, permission services, `TradeCleanupService`, `ITradeCleanupService`, `IOfferPermissionService`, the three controllers; trade parts of `TestDb`, `ApiFactory`, `ApiSecurityTests`, `PermissionTests`
- Modify: `src/Coffer/Coffer.Infrastructure/DependencyInjection.cs`, `src/Coffer/Coffer.ASPNET/Extensions/StartupExtension.cs` (register filter)
- Test: `src/Coffer/Coffer.Tests/Marketplace/ModelTests.cs`, `src/Coffer/Coffer.Tests/Marketplace/MarketplaceTestBase.cs`

**Interfaces:**
- Produces: enums `ListingKind{Sell,Exchange,Wanted}`, `ListingCondition{New,LikeNew,Good,Fair,Poor}`, `ListingStatus{Active,PendingPickup,PendingShipment,Sold,Archived}`, `ParticipantRole{Owner,Inquirer}`, `MessageKind{Text,PriceOffer,MeetupProposal,System}`, `ProposalStatus{Pending,Accepted,Declined,Withdrawn}`, `DeliveryMethod{LocalPickup,Shipping}`, `DealStatus{Proposed,AwaitingHandoff,AwaitingShipment,Shipped,Completed,Disputed,Cancelled}`, `CompletionReason{HandoffVerified,ReceiptConfirmed,AutoCompleted,Moderator}`, `ReviewerRole{Buyer,Seller}`, `ReviewReasonTag{ItemNotAsDescribed,LateToMeetup,NoShow,PoorCommunication,DamagedInShipping,SlowShipping,PaymentProblem,RudeBehavior,Other}`, `ModerationCaseKind{ReviewReport,ShippingDispute}`, `ModerationCaseStatus{Open,Resolved}`, `ModerationResolution{ReviewRemoved,ReviewRestored,DealCompleted,DealCancelled}`.
- Entities with the columns of spec §5 (PascalCase props). `Message.Payload` is `string?` (JSON) mapped `jsonb`; `ModerationCase.Snapshot` `string` mapped `jsonb`.
- `interface IClock { DateTime UtcNow { get; } }` + `SystemClock`.
- `class MarketplaceException(MarketplaceError error, string message)`; `enum MarketplaceError{Validation,Forbidden,NotFound,Conflict}`.
- `EnumSnakeCase` value converter helper used for every enum property (`ListingStatus.PendingPickup` ↔ `"pending_pickup"`).
- `MarketplaceTestBase` (tests): owns `TestDb`, a `FakeClock { DateTime UtcNow {get;set;} }`, `AddCity()`, `AddListing(owner, kind=Sell, pickup=true, shipping=true)` helpers.

- [ ] **Step 1:** Delete the old barter backend files listed above and the trade parts of tests; build must fail only on references being removed — fix `DependencyInjection` and test helpers.
- [ ] **Step 2: Write failing tests** `ModelTests`:
  - `Enums_PersistAsSnakeCaseText` — save a listing with `Status = PendingPickup`, read raw column via `SELECT status FROM listings` → `"pending_pickup"`.
  - `Deal_OnlyOneOpenDealPerListing_UniqueIndex` — two deals with status `proposed` on one listing → `DbUpdateException`.
  - `Review_UniquePerDealAndReviewer` — second review same (deal, reviewer) → `DbUpdateException`.
- [ ] **Step 3:** Run `"C:\Program Files\dotnet\dotnet.exe" test src/Coffer/Coffer.Tests --filter ModelTests` → FAIL (types missing).
- [ ] **Step 4:** Implement entities + DbContext config. Partial unique index on `deals(listing_id)` with filter `status IN ('proposed','awaiting_handoff','awaiting_shipment','shipped','disputed')`.
- [ ] **Step 5:** Run tests → PASS; run full suite → PASS.
- [ ] **Step 6:** Write `marketplace_migration.sql`: `DROP TABLE IF EXISTS` old barter tables (`offer_items, offers, trade_items, trade_reviews, trades, trade_images, trade_followers, trade_chat_messages, trade_chats, trade_confirmations, reports`), `CREATE TABLE` for all §5 tables with CHECK constraints listed in the spec, the partial unique index, and the review low-rating CHECK.

### Task 2: City search (Open-Meteo proxy + cache)

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Cities/CityService.cs`, `ICityService.cs`, `GeoMath.cs`
- Create: `src/Coffer/Coffer.ASPNET/Controllers/Marketplace/CitiesController.cs`
- Test: `src/Coffer/Coffer.Tests/Marketplace/CityServiceTests.cs`

**Interfaces:**
- Produces: `Task<IReadOnlyList<CityDto>> SearchAsync(string query)`; `record CityDto(int Id, string Name, string? Admin1, string CountryCode, double Latitude, double Longitude)`; `static double GeoMath.DistanceKm(double lat1,double lon1,double lat2,double lon2)` (haversine, R = 6371).
- Endpoint `GET api/Cities/Search?q=` (q trimmed, 2..60 chars else 400).

- [ ] **Step 1: Failing tests:** `Search_CallsOpenMeteoAndUpsertsCities` (fake `HttpMessageHandler` returns `{"results":[{"id":3054643,"name":"Budapest","latitude":47.49801,"longitude":19.03991,"country_code":"HU","admin1":"Budapest"}]}`; asserts URL host `geocoding-api.open-meteo.com`, path `/v1/search`, query has `name=Buda`, `count=10`, `language=en`; city row stored once even after two searches); `Search_ApiFailure_ReturnsCachedMatches` (handler 500 → returns stored cities whose name starts with query); `DistanceKm_BudapestToDebrecen_About194` (assert 190..198).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with `IHttpClientFactory`/`HttpClient`, 5 s timeout, `IMemoryCache` for 1 h per normalized query. No user data sent.
- [ ] **Step 4:** Run → PASS.

### Task 3: Listings (service, images, search with distance)

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Listings/ListingService.cs`, `IListingService.cs`, `ListingDtos.cs`, `ListingValidator.cs`
- Create: `src/Coffer/Coffer.ASPNET/Controllers/Marketplace/ListingsController.cs`
- Test: `src/Coffer/Coffer.Tests/Marketplace/ListingServiceTests.cs`, `ListingApiTests.cs`

**Interfaces:**
- Consumes: Task 1 entities, `GeoMath`, `IImageService.SaveImageAsync(IFormFile, Guid, folder)`, `DeleteOwnedImageAsync`.
- Produces:
  - `record ListingInput(ListingKind Kind, int CollectionTypeId, string Title, string? Description, int? PriceCents, string? ExchangeFor, ListingCondition? Condition, int CityId, bool AllowsLocalPickup, bool AllowsShipping, List<ListingLineInput> Lines, List<Guid>? KeepImageIds)`; `record ListingLineInput(string Name, int Quantity)`.
  - `record ListingQuery(ListingKind? Kind, int? CollectionTypeId, int? CityId, double? RadiusKm, int? MinPriceCents, int? MaxPriceCents, ListingCondition? Condition, DeliveryMethod? Delivery, string Sort /* nearest|price_asc|price_desc|newest */, int Page=1, int PageSize=20)`.
  - `ListingSummaryDto` (id, kind, title, priceCents, currency, collectionTypeId, cityName, distanceKm?, firstImage, allowsLocalPickup, allowsShipping, status, createdAt, ownerId, ownerName) and `ListingDetailDto` (+ description, exchangeFor, condition, lines, images, city, owner {id,name,avatar}, openDealId?).
  - `IListingService`: `CreateAsync(Guid userId, ListingInput, IReadOnlyList<IFormFile> images)`, `UpdateAsync(Guid userId, Guid id, ListingInput, IReadOnlyList<IFormFile> newImages)`, `ArchiveAsync(Guid userId, Guid id)`, `ReactivateAsync(Guid userId, Guid id)`, `GetAsync(Guid viewerId, Guid id)`, `SearchAsync(Guid viewerId, ListingQuery)`, `GetMineAsync(Guid userId)`.
  - Image folder: `{IMAGESTORE_PATH}/listings`; `GET api/Listings/Image/{fileName}`.
- Search: SQL filters + lat/lng bounding box when radius set, then exact distance in memory, sort, page. Excludes viewer's own listings and non-active ones. `nearest` without `CityId` → 400.

- [ ] **Step 1: Failing tests** (service, FakeClock, SQLite):
  - `Create_Sell_RequiresPriceImageAndLine` (each missing → Validation), `Create_Exchange_RequiresExchangeFor`, `Create_Wanted_AllowsNoImage`, `Create_RequiresAtLeastOneDelivery`, `Create_RejectsUnknownCollectionTypeOrCity`.
  - `Update_ByNonOwner_Forbidden`, `Update_SoldListing_Conflicts`, `Update_WithOpenDeal_Conflicts`, `Update_CannotChangeKindOrType` (Validation).
  - `Search_FiltersAndSortsByDistance` (cities Budapest 47.498/19.040, Debrecen 47.531/21.627, Szeged 46.253/20.148; viewer in Budapest; radius 200 → Budapest, Szeged order, Debrecen excluded only when radius 150), `Search_ExcludesOwnAndInactive`, `Search_PriceRangeAndSort`.
  - `Archive_ThenReactivate_ByOwnerOnly`.
  - API: `Create_RejectsNonImageFile` (multipart with `.txt` → 400, no file in folder), `Create_MoreThanSixImages_400`, `Anonymous_401`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement validator, service, controller (multipart: `[FromForm] string payload` JSON + `[FromForm] List<IFormFile> images`; max 6, ≤ 8 MB each, jpg/png only).
- [ ] **Step 4:** Run → PASS.

### Task 4: Generic messaging core + listing chat (offers, meetups, responsiveness)

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Messaging/ConversationService.cs`, `IConversationService.cs`, `IConversationSubjectPolicy.cs`, `ListingConversationPolicy.cs`, `MessagingDtos.cs`
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Reputation/ResponsivenessService.cs`
- Create: `src/Coffer/Coffer.ASPNET/Controllers/Marketplace/ConversationsController.cs`
- Test: `src/Coffer/Coffer.Tests/Marketplace/ConversationServiceTests.cs`

**Interfaces:**
- Produces:
  - `interface IConversationSubjectPolicy { string SubjectType {get;} Task<Guid> ResolveOwnerAsync(Guid subjectId); Task EnsureCanStartAsync(Guid userId, Guid subjectId); bool AllowsKind(MessageKind kind, Guid subjectId); }` — `ListingConversationPolicy` (`"listing"`): owner can't start, only `active`/`pending_*` listings accept new conversations; price offers not allowed for exchange listings.
  - `IConversationService`: `OpenAsync(Guid userId, string subjectType, Guid subjectId) → ConversationDto` (idempotent), `ListMineAsync(Guid userId) → List<ConversationSummaryDto>` (unread count, last message preview, listing title/image, other user), `GetAsync(Guid userId, Guid id)`, `GetMessagesAsync(Guid userId, Guid id, DateTime? after)`, `PostAsync(Guid userId, Guid id, PostMessageInput)`, `RespondAsync(Guid userId, Guid id, Guid messageId, string action)`, `MarkReadAsync(Guid userId, Guid id)`, `PostSystemAsync(Guid conversationId, string body)`, `GetTranscriptAsync(Guid conversationId) → List<MessageDto>`.
  - `record PostMessageInput(MessageKind Kind, string? Body, int? AmountCents, DateTime? At, string? Place)`.
  - `ResponsivenessService.GetAsync(Guid userId) → (double? ResponseRate, int? TypicalResponseMinutes, int ConversationsReceived)` (last 90 days; answered = owner first response ≤ 48 h; median minutes).
- Accepting a price offer sets `Conversation.AgreedPriceCents`; accepting a meetup copies `At/Place` to the conversation's open deal if any. Only the recipient can accept/decline; only the sender can withdraw; only `pending` can change (else 409). New offer by same sender withdraws their older pending offer.

- [ ] **Step 1: Failing tests:** `Open_IsIdempotentPerInquirer`, `Open_OwnerCannotStartOwnConversation` (Forbidden), `Open_ArchivedListing_Conflicts`, `NonParticipant_CannotReadOrPost` (NotFound), `Text_EmptyOrTooLong_Rejected`, `Offer_NonPositive_Rejected`, `Offer_OnExchangeListing_Rejected`, `Offer_AcceptedByRecipient_SetsAgreedPrice`, `Offer_SenderCannotAccept` (Forbidden), `Offer_NewOfferWithdrawsOlderPending`, `Meetup_InPast_Rejected`, `OwnerFirstReply_StampsResponseTime`, `Responsiveness_RateAndMedian` (3 conversations: replies after 30 min, 90 min, none → rate 0.67, median 60), `MarkRead_ResetsUnread`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; register policies as `IEnumerable<IConversationSubjectPolicy>`.
- [ ] **Step 4:** Run → PASS.

### Task 5: Deal state machine (pickup PIN/QR, shipping, auto-complete, sweeper)

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Deals/DealService.cs`, `IDealService.cs`, `DealDtos.cs`, `Carriers.cs`, `PinGenerator.cs`
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/MarketplaceMaintenanceService.cs` (hosted, hourly)
- Create: `src/Coffer/Coffer.ASPNET/Controllers/Marketplace/DealsController.cs`
- Test: `src/Coffer/Coffer.Tests/Marketplace/DealServiceTests.cs`, `DealApiTests.cs`

**Interfaces:**
- Consumes: `IConversationService.PostSystemAsync`, `IModerationService.OpenDisputeAsync` (Task 7 — define the interface here in Task 5 with `Task OpenDisputeAsync(Deal deal, Guid openedBy, string reason)` and implement in Task 7; until then a minimal implementation creating the case row).
- Produces: `IDealService`: `ProposeAsync(Guid userId, Guid conversationId, DeliveryMethod method)`, `AcceptAsync`, `DeclineAsync`, `CancelAsync(Guid userId, Guid dealId, string? reason)`, `ConfirmHandoffAsync(Guid userId, Guid dealId, string pin)`, `ShipAsync(Guid userId, Guid dealId, string carrier, string trackingNumber, IFormFile? photo)`, `ConfirmReceiptAsync(Guid userId, Guid dealId, IFormFile? photo)`, `DisputeAsync(Guid userId, Guid dealId, string reason)`, `GetAsync(Guid userId, Guid dealId) → DealDto` (`HandoffPin` only for buyer; `TrackingUrl` from carrier template; `NextActions: string[]` for the viewer; `AutoCompleteAt`), `GetMineAsync(Guid userId)`, `ApplyTimeRulesAsync(Deal)` (auto-complete + review publication, used lazily and by sweeper), `CompleteAsync(Deal, CompletionReason)` (sets listing sold, `ReviewDeadline = CompletedAt + 14d`, system messages), `ModeratorResolveAsync(Guid dealId, bool complete)`.
- Carriers: `magyar_posta, gls, dpd, foxpost, packeta, dhl, ups, other` with tracking URL templates (`other` → null).
- PIN: `RandomNumberGenerator.GetInt32(0, 10000).ToString("D4")`; compare with `CryptographicOperations.FixedTimeEquals`.

- [ ] **Step 1: Failing tests:**
  - `Propose_BySellerOnly` (buyer → Forbidden), `Propose_MethodNotAllowedByListing_Validation`, `Propose_SecondOpenDealOnListing_Conflicts`, `Propose_UsesAgreedPriceElseListingPrice`, `WantedListing_InquirerIsSeller`.
  - `Accept_ByBuyerOnly_SetsListingPendingAndGeneratesPin` (pickup → `pending_pickup`, PIN 4 digits; shipping → `pending_shipment`, no PIN), `Decline_ReturnsListingActive`, `Cancel_AfterShipped_Conflicts`.
  - `GetDeal_PinHiddenFromSeller`.
  - `ConfirmHandoff_CorrectPin_CompletesAndOpensReviewWindow` (listing `sold`, `ReviewDeadline = now+14d`), `ConfirmHandoff_ByBuyer_Forbidden`, `ConfirmHandoff_FiveWrong_LocksAndRegenerates` (6th attempt with old correct PIN within 15 min → Conflict; after clock +16 min new PIN works).
  - `Ship_RequiresTrackingNumber`, `Ship_BySellerOnly`, `ConfirmReceipt_ByBuyerOnly_Completes`, `Dispute_FreezesDealAndOpensCase`, `Shipped_AutoCompletesAfter14Days` (clock +14d+1min, `GetAsync` returns `completed`/`auto_completed`), `Disputed_DoesNotAutoComplete`.
  - API: `Stranger_CannotReadDeal` (404), `Ship_Multipart_PhotoStored`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Each command: load deal with listing, check actor role, check status, mutate, save, post system message. Catch unique-index `DbUpdateException` on propose → Conflict.
- [ ] **Step 4:** Run → PASS.

### Task 6: Reviews, double-blind publication, replies, reputation

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Reviews/ReviewService.cs`, `IReviewService.cs`, `ReviewDtos.cs`
- Create: `src/Coffer/Coffer.ASPNET/Controllers/Marketplace/ReviewsController.cs` (`api/Deals/{id}/Reviews`, `api/Reviews/{id}/Reply`, `api/Reviews/{id}/Report`, `api/Users/{id}/Reputation`, `api/Users/{id}/MarketReviews`)
- Test: `src/Coffer/Coffer.Tests/Marketplace/ReviewServiceTests.cs`

**Interfaces:**
- Consumes: `IDealService.ApplyTimeRulesAsync`, `ResponsivenessService`, `IModerationService.OpenReviewReportAsync(Review review, Guid openedBy, string reason)` (defined Task 7).
- Produces: `IReviewService`: `SubmitAsync(Guid userId, Guid dealId, ReviewInput)`, `GetForDealAsync(Guid userId, Guid dealId) → DealReviewsDto { Mine, Theirs (null unless published), CanReview, Deadline }`, `ReplyAsync(Guid userId, Guid reviewId, string text)`, `ReportAsync(Guid userId, Guid reviewId, string reason)`, `GetForUserAsync(Guid userId) → List<ReviewDto>` (published, not removed; `IsFrozen` flag), `GetReputationAsync(Guid userId) → ReputationDto(double? Average, int Count, int CompletedDeals, double? ResponseRate, int? TypicalResponseMinutes)`, `PublishDueAsync()` (sweeper).
- `record ReviewInput(int Stars, ReviewReasonTag? ReasonTag, string? Comment)`.

- [ ] **Step 1: Failing tests:** `Submit_WithoutCompletedDeal_Conflicts`, `Submit_ByOutsider_Forbidden`, `Submit_AfterDeadline_Conflicts`, `Submit_Twice_Conflicts`, `LowRating_RequiresReasonAnd20Chars` (stars 2 + 19-char comment → Validation; 20 chars + tag → ok), `Stars_OutOfRange_Validation`, `FirstReview_HiddenFromOtherParty`, `SecondReview_PublishesBoth`, `Deadline_PublishesSingleReview`, `Reply_OnlyRevieweeOnceAfterPublish`, `Report_OnlyReviewee_FreezesAndExcludesFromAverage` (avg of 5 and 1 → 5 after reporting the 1), `Reputation_CountsOnlyPublishedUnfrozenUnremoved`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.

### Task 7: Moderation queue

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Marketplace/Moderation/ModerationService.cs`, `IModerationService.cs`, `ModerationDtos.cs`
- Create: `src/Coffer/Coffer.ASPNET/Controllers/Marketplace/ModerationController.cs`
- Test: `src/Coffer/Coffer.Tests/Marketplace/ModerationServiceTests.cs`, `ModerationApiTests.cs`

**Interfaces:**
- Produces: `OpenReviewReportAsync`, `OpenDisputeAsync` (snapshot JSON: `{ deal:{…status, method, price, carrier, tracking, timestamps}, listing:{id,title,kind}, reviews:[…], transcript:[{sender, kind, body, payload, createdAt}] }`), `ListAsync(Guid userId, ModerationCaseStatus?)`, `GetAsync(Guid userId, Guid id)`, `ResolveAsync(Guid userId, Guid id, ModerationResolution, string? note)`. Moderator/Admin role checked via `Users.Role` → else Forbidden.
- Valid resolutions: review_report → `review_removed|review_restored`; shipping_dispute → `deal_completed|deal_cancelled` (calls `IDealService.ModeratorResolveAsync`). Resolving twice → Conflict.

- [ ] **Step 1: Failing tests:** `Report_CreatesCaseWithTranscriptSnapshot`, `NonModerator_CannotList` (Forbidden; API → 403), `Resolve_ReviewRemoved_HidesReview`, `Resolve_ReviewRestored_Unfreezes`, `Resolve_DisputeCompleted_CompletesDeal`, `Resolve_WrongResolutionForKind_Validation`, `Resolve_Twice_Conflicts`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run full backend suite → PASS.

### Task 8: Frontend foundation — remove barter UI, types, API, shared retro widgets

**Files:**
- Delete: `src/app/tradedetails/*`, `src/app/offerdetails/*`, `src/components/collections/tabs/barter/*`, `src/components/otheruser/trade_review_*`, trade/offer consts, stores, types listed in the spec scan.
- Create: `src/types/entities/market.ts` (TS mirrors of every DTO above; enum string unions), `src/const/market.ts` (labels/colors for statuses, conditions, reason tags, carriers, warning copy), `src/hooks/market_api.ts` (react-query hooks per endpoint, polling options), `src/hooks/market_store.ts` (zustand: selected listing/conversation/deal ids)
- Create: `src/components/market/ui/` — `chip.tsx` (toggle chip), `warning_banner.tsx`, `star_rating.tsx` (input + display), `price_text.tsx` (`€12.50` from cents), `section_card.tsx` (2px bordered retro card with hard shadow), `city_autocomplete.tsx` (debounced `api/Cities/Search`)
- Modify: `src/const/endpoints.ts`, `src/const/querykeys.ts`, `src/const/navigation_params.ts`, `src/utils/data_access_utils.ts` (drop trade helpers), `src/app/otheruser/index.tsx` (drop old review UI usages for now)
- Test: `npx tsc --noEmit` and `npx expo lint`

- [ ] **Step 1:** Delete old files; run `npx tsc --noEmit` and fix every dangling import.
- [ ] **Step 2:** Add types, endpoints, hooks, widgets. **Step 3:** `npx tsc --noEmit` → 0 errors.

### Task 9: Market tab — browse feed, filters, my listings, listing form

**Files:**
- Create: `src/app/tabs/market.tsx` (replaces `barter.tsx`; inner tabs BROWSE · MY LISTINGS · CHATS · DEALS), `src/components/market/browse/listing_feed.tsx`, `listing_card.tsx`, `listing_filter_sheet.tsx`, `sort_bar.tsx`, `src/components/market/listing_form/listing_form_overlay.tsx`, `line_editor.tsx`, `image_strip_picker.tsx`, `src/components/market/mine/my_listings.tsx`
- Modify: `src/app/tabs/_layout.tsx` (tab "Market", icon `storefront`), `src/const/navigation_params.ts`
- [ ] **Step 1:** Implement; filters held in `market_store`; sort `nearest` disabled until a city is chosen. Form validation mirrors Task 3 rules with inline errors. **Step 2:** `npx tsc --noEmit` → 0 errors.

### Task 10: Listing detail, chat, deal panel (PIN/QR/scan, shipping)

**Files:**
- Create: `src/app/listingdetails/_layout.tsx`, `index.tsx`; `src/app/chat/_layout.tsx`, `index.tsx`
- Create: `src/components/market/chat/message_bubble.tsx`, `offer_card.tsx`, `meetup_card.tsx`, `composer.tsx`, `offer_overlay.tsx`, `meetup_overlay.tsx`, `src/components/market/deal/deal_panel.tsx`, `pin_display.tsx` (PIN + QR `coffer-handoff:{dealId}:{pin}`), `pin_entry.tsx` (4 boxes + "Scan QR" with expo-camera), `ship_form_overlay.tsx`, `dispute_overlay.tsx`, `src/components/market/chats/chat_list.tsx`
- Modify: `package.json` (`expo-camera`, `react-native-svg`, `react-native-qrcode-svg` via `npx expo install`), `app.json` (camera permission plugin)
- [ ] **Step 1:** `npx expo install expo-camera react-native-svg react-native-qrcode-svg`. **Step 2:** Implement; messages poll every 4 s while screen focused, inbox every 20 s. Deal panel renders from `deal.nextActions`. **Step 3:** `npx tsc --noEmit` → 0 errors.

### Task 11: Deals tab, review modal, profile reputation, moderation screen

**Files:**
- Create: `src/components/market/deals/deal_list.tsx`, `src/components/market/review/review_modal.tsx`, `review_card.tsx`, `reply_overlay.tsx`, `report_overlay.tsx`, `reputation_summary.tsx`, `src/app/settings/moderation.tsx`, `src/components/market/moderation/case_detail.tsx`
- Modify: `src/app/otheruser/index.tsx` (reputation + reviews), `src/app/settings/index.tsx` (Moderation entry for role ≥ Moderator), `src/app/settings/_layout.tsx`
- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit` → 0 errors, `npx expo lint` → no errors.

### Task 12: Database migration + emulator end-to-end

- [ ] **Step 1:** Back up DB (`docker compose exec db pg_dump -Fc`), apply `marketplace_migration.sql` with `psql`, start backend.
- [ ] **Step 2:** On the emulator with two accounts (or one account + Swagger with second token): create sell listing (pickup+shipping) → second user filters by city/radius, opens chat, sends offer → seller accepts → seller proposes pickup deal → buyer accepts, sees PIN/QR → seller enters PIN → both see review CTA → buyer reviews 2★ (reason + 20 chars enforced) → seller's review hidden for buyer until seller submits → reply → report → moderator resolves. Repeat shipping path: ship → receipt.
- [ ] **Step 3:** Fix anything found; full backend test suite + `tsc` green.
