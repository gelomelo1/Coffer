# Coffer Marketplace — Design

Date: 2026-11-13 · Status: approved to build ("you can start")

## 1. Intent

Replace the current Barter feature (trades built from collection items + counter-offers + thumbs-up/down reviews)
with a peer-to-peer marketplace in the spirit of Facebook Marketplace: users post *sell*, *exchange* or
*searching-for* listings for collectible item types, talk to each other in per-listing chats, close deals
either through a **PIN/QR verified meetup** or a **tracked shipping workflow**, and rate each other through an
abuse-resistant, double-blind review system with a moderation queue.

The point of the rework is **trust**: reviews must only ever come from a verified, completed deal, must not be
usable for retaliation, low ratings must carry context, and contested reviews/deals must reach a moderator
with the evidence attached.

## 2. Goals / non-goals / anti-goals

Goals
- Listings: create / edit / archive; filter by item type, kind, price, condition, city + radius, delivery
  method; sort by nearest, price, newest.
- Listing content: kind (sell / exchange / wanted), item type (= existing `collection_types`), title, city,
  price in EUR (sell) or "wants in exchange" text (exchange), condition, delivery (pickup and/or shipping),
  ≥1 image (sell/exchange; optional for wanted), a bullet list of `name × quantity` lines (≥1), optional
  description.
- Per-listing buyer↔seller chat with text, price offers (accept/decline) and meetup proposals
  (accept/decline). Messaging core is generic so item comments etc. can reuse it later (not built now).
- Deal state machine with two completion paths: local pickup (PIN/QR) and shipping (tracking + receipt
  confirmation, 14-day auto-complete, dispute).
- Double-blind 14-day review window; 1–5 stars; reason tag + ≥20 chars for 1–2 stars; one public reply.
- Report review → frozen from average → moderation queue with chat log + deal metadata snapshot.
- Passive responsiveness metric (response rate / typical response time), never a public star rating.
- Prominent warning: Coffer does not handle payment; advance payment and shipping are at the user's own risk,
  only with trusted sellers.
- Backend tests (xUnit) for every gate; manual end-to-end pass on the Android emulator.

Non-goals
- In-app payments / escrow, carrier API integration (tracking is verified by the buyer on the carrier site),
  push notifications, real-time sockets, item comments on the new messaging core, migrating old barter data.

Anti-goals (would be failure even if it "works")
- Any path where a review can be written without a completed deal between exactly those two users.
- Any path where one party can complete a deal alone without the other's verification/consent
  (except the documented 14-day shipping auto-complete after a registered shipment with no dispute).
- Generic CRUD endpoints that let a client set statuses/foreign keys directly.
- Reviews of one side visible to the other before both submit or the window ends.

## 3. Constraints (from the existing project)

- Backend: ASP.NET Core 8, EF Core 9 + Npgsql, snake_case naming, layered projects
  (Domain / DataAccess / BusinessLogic / ASPNET / Infrastructure), JWT auth, roles User/Moderator/Admin.
- **No EF migrations**: schema lives in Postgres and is created by hand. → Ship
  `src/startup/marketplace_migration.sql` (drops old barter tables, creates new ones). Tests use SQLite
  `EnsureCreated()` from the EF model, so the EF model must be the source of truth and the SQL must match it.
- Frontend: Expo 54 / React Native 0.81, expo-router, react-query, zustand, react-native-elements; retro style
  via `customTheme` colors (`background #fefdf0`, `primary #19283f`, `secondary #a98d3c`), VendSans fonts,
  square 2px borders with hard shadows (`CustomButton`, `CustomOverlay`, `CustomText`, `rootViewStyle`).
- Images: stored on disk via `IImageService` (`{ownerId}_{timestamp}.ext` naming), multipart upload pattern
  as in `CollectionsController.UploadCoverImage`.
- Old trade data need not be preserved (confirmed).

## 4. Approaches considered

| Decision | Options | Pick & why |
|---|---|---|
| Backend shape | (a) reuse `GenericController`/`GenericRepository` CRUD + permission services; (b) dedicated controllers calling a business-logic service that owns the state machine | **(b)**. Generic CRUD lets the client post whole entities (status, buyer id, …), which is exactly the "unfair operation" surface we must close. Commands like `reserve`, `confirm-handoff`, `ship` are explicit endpoints, each validating actor + current state. Read endpoints return DTOs, not entities. |
| Chat transport | (a) SignalR websockets; (b) REST + react-query polling | **(b)**. No new infra in docker/prod, reuses JWT + axios; open chat polls every 4s, inbox every 20s. The service layer is transport-agnostic, so SignalR can be added later. |
| Messaging model | (a) marketplace-specific `listing_messages`; (b) generic `conversations` (subject_type + subject_id) + `conversation_participants` + `messages` (kind + JSON payload) with a per-subject policy | **(b)**, as requested — generic core, listing policy is the only implementation now. |
| City / distance | (a) Open-Meteo geocoding API (free, no key); (b) Nominatim/OSM (1 req/s, UA required); (c) static city list | **(a)**, proxied through the backend and cached in a `cities` table with lat/lng; distance = haversine. |
| Timers (14-day windows) | (a) cron-only; (b) lazy evaluation on read + periodic sweeper | **(b)**. Visibility/auto-complete are computed from timestamps on every read, so correctness never depends on the job; an hourly `MarketplaceMaintenanceService` persists the transitions. |
| Handoff proof | (a) PIN only; (b) PIN + QR | **(b)**. Buyer shows a 4-digit PIN and a QR (`coffer-handoff:{dealId}:{pin}`); seller types it or scans it. Adds `expo-camera`, `react-native-svg`, `react-native-qrcode-svg` (native → one dev-client rebuild). |

## 5. Data model

All enums are C# enums persisted as **text** (EF `HasConversion<string>()`, snake_case values) with SQL
`CHECK` constraints. Money is `price_cents INT` + `currency TEXT DEFAULT 'EUR'`.

**cities** — `id SERIAL PK`, `external_id BIGINT UNIQUE` (Open-Meteo id), `name`, `admin1 NULL`,
`country_code`, `latitude DOUBLE`, `longitude DOUBLE`.

**listings** — `id UUID PK`, `owner_id → users (cascade)`, `kind {sell, exchange, wanted}`,
`collection_type_id → collection_types`, `title (≤80)`, `description NULL (≤2000, plain text)`,
`price_cents NULL` (required >0 for sell; optional budget for wanted; null for exchange),
`currency 'EUR'`, `exchange_for NULL` (required for exchange), `condition {new, like_new, good, fair, poor}`
(NULL for wanted = "any"), `city_id → cities`, `allows_local_pickup BOOL`, `allows_shipping BOOL`
(at least one true), `status {active, pending_pickup, pending_shipment, sold, archived}`,
`created_at`, `updated_at`. Index on (status, collection_type_id), (city_id).

**listing_lines** — `id UUID PK`, `listing_id → listings (cascade)`, `name (≤80)`, `quantity INT 1..9999`,
`position INT`. 1..30 lines.

**listing_images** — `id UUID PK`, `listing_id → listings (cascade)`, `file_name`, `position`. 0..6 images
(≥1 enforced for sell/exchange before the listing becomes visible — see §6.1).

**conversations** (generic) — `id UUID PK`, `subject_type TEXT` (`listing` now), `subject_id UUID`,
`created_at`, `last_message_at`, `owner_first_response_at NULL`, `agreed_price_cents NULL`.
Unique (subject_type, subject_id, starter_id) is enforced via participants (see service).

**conversation_participants** — PK (`conversation_id`, `user_id`), `role {owner, inquirer}`,
`last_read_at NULL`, `joined_at`.

**messages** — `id UUID PK`, `conversation_id → conversations (cascade)`, `sender_id NULL → users`
(NULL = system), `kind {text, price_offer, meetup_proposal, system}`, `body TEXT (≤2000)`,
`payload JSONB NULL` (price_offer: `{amountCents, status}`; meetup: `{at, place, status}`;
status ∈ pending/accepted/declined/withdrawn), `created_at`.

**deals** (the "transactions" of the brief) — `id UUID PK`, `listing_id → listings`, `conversation_id →
conversations`, `seller_id → users`, `buyer_id → users`, `method {local_pickup, shipping}`,
`status {proposed, awaiting_handoff, awaiting_shipment, shipped, completed, disputed, cancelled}`,
`agreed_price_cents NULL`, `meetup_at NULL`, `meetup_place NULL`,
`handoff_pin CHAR(4) NULL` (never returned to the seller), `pin_failed_attempts INT`, `pin_locked_until NULL`,
`carrier NULL`, `tracking_number NULL`, `shipment_photo NULL`, `shipped_at NULL`,
`receipt_photo NULL`, `received_at NULL`, `completed_at NULL`, `completion_reason NULL
{handoff_verified, receipt_confirmed, auto_completed, moderator}`, `review_deadline NULL`,
`cancelled_by NULL`, `cancel_reason NULL`, `created_at`, `updated_at`.
Partial unique index: one non-terminal deal per listing.

**reviews** — `id UUID PK`, `deal_id → deals`, `reviewer_id → users (set null)`, `reviewee_id → users`,
`reviewer_role {buyer, seller}`, `stars SMALLINT 1..5`, `reason_tag NULL`
{item_not_as_described, late_to_meetup, no_show, poor_communication, damaged_in_shipping, slow_shipping,
payment_problem, rude_behavior, other}, `comment NULL (≤1000)`, `created_at`, `published_at NULL`,
`reply NULL (≤500)`, `replied_at NULL`, `is_frozen BOOL`, `is_removed BOOL`. Unique (deal_id, reviewer_id).
CHECK: stars ≤ 2 ⇒ reason_tag NOT NULL AND length(comment) ≥ 20.

**moderation_cases** — `id UUID PK`, `kind {review_report, shipping_dispute}`, `review_id NULL`,
`deal_id → deals`, `opened_by → users`, `reason TEXT`, `snapshot JSONB` (deal metadata, both reviews,
full chat log at the time of reporting), `status {open, resolved}`, `resolution NULL
{review_removed, review_restored, deal_completed, deal_cancelled}`, `resolution_note NULL`,
`resolved_by NULL`, `resolved_at NULL`, `created_at`.

Old tables dropped: `trades`, `trade_items`, `offers`, `offer_items`, `trade_reviews` (+ the unused draft
tables if present).

## 6. Business rules (state machines)

### 6.1 Listing
- Create (multipart: JSON payload + 1..6 images) → `active`. Validation in service, not client.
- Edit allowed only by owner while `active` and with no open deal (so a buyer accepts what they saw) (title, description, price, exchange_for, condition, city,
  delivery flags, lines, images). Kind and item type are immutable after creation.
- `active → archived` by owner (or moderator). `archived → active` by owner if no deal is open.
- `active → pending_pickup | pending_shipment` only via deal acceptance (§6.3). Back to `active` on deal
  cancel. `→ sold` on deal completion. Sold listings are read-only.
- Feed shows only `active` listings of other users. Owner sees all of their own.

### 6.2 Conversations & messages
- A non-owner opens/continues **one** conversation per listing (idempotent `POST /listings/{id}/conversations`).
  Owner can't start a conversation with themselves; archived/sold listings can't get new conversations.
- Only participants can read/post. Text 1..2000 chars.
- Price offer: either party, amount > 0; only for sell/wanted listings. Recipient accepts/declines; sender
  can withdraw while pending. A newer offer auto-withdraws the sender's older pending offer. Accepting sets
  `conversations.agreed_price_cents`.
- Meetup proposal: either party, future time + place (≤120 chars); recipient accepts/declines. Accepted
  meetup is copied to the open deal (if any).
- System messages are written by the deal service on each deal transition (audit trail in the chat log).
- Responsiveness: when the listing owner sends their first message in a conversation started by someone
  else, `owner_first_response_at` is stamped. Stats per user (last 90 days, conversations where they are
  owner): response rate = answered within 48h / total; typical time = median of answered delays.
  Exposed on profile and listing seller card as text, never as stars.

### 6.3 Deal (seller/buyer roles: for sell/exchange listings seller = owner; for wanted listings seller =
inquirer, buyer = owner)
- `propose` — by the **seller** side from a conversation; choose `method` allowed by the listing; price =
  conversation agreed price ?? listing price. Only one non-terminal deal per listing. → `proposed`.
- `accept` — by the **buyer** only. → `awaiting_handoff` (pickup: generate PIN) or `awaiting_shipment`.
  Listing → `pending_pickup` / `pending_shipment`. Other conversations of the listing get a system message.
- `decline` (buyer) / `cancel` (either side) allowed in `proposed`, `awaiting_handoff`, `awaiting_shipment`
  → `cancelled`; listing → `active`.
- Pickup `confirm-handoff` — **seller** submits the buyer's PIN (typed or scanned QR). Correct →
  `completed` (`handoff_verified`). Wrong → attempts+1; 5 wrong → PIN regenerated and locked 15 minutes.
  The buyer reveals the PIN only after inspecting the item, which is the buyer's verification.
- Shipping `ship` — **seller**: carrier (enum list + other) + tracking number (4..40 chars, required),
  optional photo → `shipped`, `shipped_at`.
- Shipping `confirm-receipt` — **buyer**, optional photo → `completed` (`receipt_confirmed`).
- Shipping `dispute` — **buyer**, in `shipped`, reason ≥20 chars → `disputed` + moderation case.
- Auto-complete — `shipped` and `now ≥ shipped_at + 14d` and not disputed → `completed`
  (`auto_completed`). Applied lazily on read and by the sweeper.
- Moderator resolves dispute → `completed` (`moderator`) or `cancelled`.
- On `completed`: listing → `sold`, `review_deadline = completed_at + 14d`, other conversations notified.

### 6.4 Reviews
- Gate: caller is buyer or seller of a `completed` deal, `now < review_deadline`, no existing review by
  them → may submit one review of the **other** party. Nothing else unlocks reviews (no message counts).
- Validation: stars 1..5; stars ≤2 ⇒ reason tag + comment ≥20 chars (trimmed); comment ≤1000.
- Double-blind: `published_at` is set when the second review arrives (both get the same timestamp) or when
  the deadline passes (lazy + sweeper). Unpublished reviews are visible only to their author.
  Reviews cannot be edited or deleted by users.
- Reply: reviewee only, once, only after publication, 1..500 chars.
- Score: average stars and count over reviews with `published_at` set, `is_frozen = false`,
  `is_removed = false`.
- Report: only the reviewee may report a published review, once; reason ≥10 chars → `is_frozen = true` +
  moderation case with snapshot (deal metadata, both reviews, full chat transcript). Moderator: remove
  (`is_removed = true`) or restore (`is_frozen = false`).

### 6.5 Moderation
- `GET /moderation/cases?status=open`, `GET /moderation/cases/{id}`, `POST /moderation/cases/{id}/resolve`
  — Moderator/Admin only. Resolution must fit the case kind.

## 7. API (all `[Authorize]`, JSON DTOs)

```
GET    api/Cities/Search?q=                       city autocomplete (proxy to Open-Meteo, cached)
GET    api/Listings?kind&collectionTypeId&cityId&radiusKm&minPrice&maxPrice&condition&delivery&sort&page&pageSize
GET    api/Listings/Mine
GET    api/Listings/{id}
POST   api/Listings                (multipart: payload JSON + images[])
PUT    api/Listings/{id}           (multipart: payload JSON incl. keepImageIds + new images[])
POST   api/Listings/{id}/Archive | /Reactivate
GET    api/Listings/Image/{fileName}
POST   api/Listings/{id}/Conversations        open or get my conversation
GET    api/Conversations                      my inbox (with unread count, listing summary)
GET    api/Conversations/{id}                 header: participants, listing, active deal
GET    api/Conversations/{id}/Messages?after=
POST   api/Conversations/{id}/Messages        {kind:text|price_offer|meetup_proposal, body, amountCents?, at?, place?}
POST   api/Conversations/{id}/Messages/{messageId}/Respond   {action: accept|decline|withdraw}
POST   api/Conversations/{id}/Read
POST   api/Deals                               {conversationId, method}
GET    api/Deals/Mine
GET    api/Deals/{id}                          (pin only for buyer)
POST   api/Deals/{id}/Accept | /Decline | /Cancel {reason?}
POST   api/Deals/{id}/ConfirmHandoff           {pin}
POST   api/Deals/{id}/Ship                     multipart {carrier, trackingNumber, photo?}
POST   api/Deals/{id}/ConfirmReceipt           multipart {photo?}
POST   api/Deals/{id}/Dispute                  {reason}
GET    api/Deals/Image/{fileName}              (deal participants + moderators only)
POST   api/Deals/{id}/Reviews                  {stars, reasonTag?, comment?}
GET    api/Deals/{id}/Reviews                  my review + other's (if published)
GET    api/Users/{id}/Reputation               {average, count, responseRate, typicalResponseMinutes, completedDeals}
GET    api/Users/{id}/Reviews                  published, not removed (frozen shown with a "under review" flag)
POST   api/Reviews/{id}/Reply                  {text}
POST   api/Reviews/{id}/Report                 {reason}
GET    api/Moderation/Cases?status=  ·  GET api/Moderation/Cases/{id}  ·  POST api/Moderation/Cases/{id}/Resolve {resolution, note?}
```
Errors: 400 validation, 403 wrong actor, 404 not found / not visible, 409 wrong state.

## 8. Frontend

- Tab "Barter" becomes **"Market"** (storefront icon). Inner tabs: **BROWSE · MY LISTINGS · CHATS · DEALS**.
- **Browse**: warning banner (collapsible after first view), filter button → bottom sheet (kind chips, item
  type dropdown, city autocomplete + radius chips 5/10/25/50/100 km/any, price min/max, condition chips,
  delivery chips), sort chips (Nearest · Price ↑ · Price ↓ · Newest), "＋ New listing" and
  "＋ I'm searching for…" buttons. Listing card: first image, kind badge, title, price/“Exchange”/“Wanted”,
  item type color stripe (`collection_types.color`), city · distance, pickup/ship icons.
- **Listing detail** screen: image pager, warning banner, kind/price, item type, condition, delivery,
  "What's included" bullet list `• name ×qty`, description, seller card (avatar, ★ avg (count),
  responsiveness text), "Message seller" button; owner sees Edit / Archive / Reactivate and a list of
  conversations.
- **Listing form** overlay (create/edit): kind segmented control, item type dropdown, title, city
  autocomplete, price € (sell) / wants-in-exchange (exchange) / budget € optional (wanted), condition,
  delivery checkboxes, images (camera/gallery, 1..6, reorder by remove/re-add), bullet line editor
  (name + qty, add/remove), description. Inline validation mirrors backend rules.
- **Chat** screen: header with listing mini-card; **deal panel** pinned at top showing the next action for
  *this* user (propose deal / accept-decline / show PIN+QR / enter-scan PIN / ship form / tracking info +
  carrier link + confirm receipt / dispute / review CTA); message list (text bubbles, offer cards with
  Accept/Decline/Withdraw, meetup cards, system lines); composer with "€ Offer" and "📅 Meetup" buttons.
- **Deals** tab: list of my deals grouped by "Needs your action" / "In progress" / "Finished"; review
  badge when a review is due.
- **Review modal**: explains double-blind ("hidden until both of you review or 14 days pass"), 5 tappable
  stars, reason chips required at ≤2, comment with live char counter (min 20 at ≤2), submit.
- **Profile (other user)**: replace thumbs rating with ★ average + count + responsiveness; reviews list with
  reply (own profile) and "Report" (own received reviews).
- **Moderation** (Settings → visible for Moderator/Admin): open cases list → detail with snapshot (deal
  facts, reviews, chat transcript) and resolution buttons.
- Styling: only `customTheme` colors + VendSans, square 2px bordered cards with hard shadows, gold
  (`secondary`) for primary actions/highlights, red reserved for warnings/destructive.

## 9. Left to the builder
- Exact component decomposition, query keys, polling intervals within the stated ranges.
- Carrier list and tracking URL templates (Magyar Posta, GLS, DPD, Foxpost, Packeta, DHL, UPS, Other).
- Copy text, empty states, loading states.

## 10. Calls made by Claude (user may veto)
- Listing has a required **title** (feed needs a headline).
- Listing statuses add `pending_shipment` next to the requested `pending_pickup`.
- Deal requires **buyer acceptance** before it becomes active (prevents a seller forcing a shipping deal +
  auto-complete on an unwilling buyer to unlock a review).
- Buyer reveals PIN = buyer's verification; seller entering it = seller's verification.
- Only the reviewee can report a review (stops anyone freezing arbitrary reviews).
- Responsiveness tracked for the listing owner's replies only.
- Old reviews/trades are dropped; the "Barter" tab is renamed "Market".
