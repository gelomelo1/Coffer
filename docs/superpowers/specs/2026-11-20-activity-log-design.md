# My activity: a personal event log

## Why

Users want to look back at what they did in the app — what they liked and rated, what they commented, what they
added, which trades they made — see when, and jump straight to the place it happened (the item with that comment,
the chat, the deal, the listing). Today nothing records this: the data shows what *is*, not what was *done*.

## Goals

- Every user action is recorded as an **event** in a private, append-only log: who, what, when, on what.
- **Settings › My activity** opens a menu of categories, each its own sub-page (plus "All activity"); entries are newest
  first, 20 at a time, grouped by day.
- Each entry says what happened in plain words ("You rated Heineken 5★ (was 3★)"), shows the target (thumbnail / name)
  and the time, and **opens where it happened** when tapped.
- The log is **filled with the past** where the data has a date (once, at rollout).

## Non-goals

- "Waiting for review" stays where it is in Settings (not moved into My activity) — decided by your human partner.
- Other users' actions on your things (someone liked your item) — that is notifications, a different feature.
- Moderation outcomes of your reports as log entries (they're not your actions; Settings › Reports already shows them).
- Plain chat text messages (too noisy); chats show up as "started a chat", offers and meetup proposals as their own
  events.
- Export, search, or deleting single log entries.

## Anti-goals

- An entry that says something untrue (wrong verb, wrong before/after value).
- A tap that crashes or shows an error because the target was deleted — it must say "No longer available".
- Keeping another person's name in the log after they deleted their account (names are looked up at read time).
- Anyone but the owner seeing a log.

## Constraints

- Backend ASP.NET Core 8 + EF Core; schema by hand-run SQL in `src/startup/`, EF model kept in sync; xUnit on SQLite.
- App Expo / React Native, i18n en + hu (`check:i18n`, `check:errors`), existing paging hook (`usePagedQuery`, 20/page).
- Recording happens **in the same save** as the action (a failed action leaves no event; a recorded event always
  matches a real change).
- Account deletion removes the user's log (it is their personal data; the accountability rule covers other users'
  data and moderation records, not this).
- Git: no branches, no pushes, no Co-authored-by trailers.

## Approaches

| | What | Trade-off |
|---|---|---|
| **A — record each action where it happens (chosen)** | Every action path calls a shared `ActivityLog.Record(user, kind, targets, details)` inside its save. | ~30 paths get one line each; a future action must remember to record — guarded by a test per action kind. Entries say exactly what happened. |
| B — derive events from database changes | A save hook turns added/changed/deleted rows into events. | Nothing forgotten, but intent is guessed from raw rows (quantity up = "+2 from a photo" or an edit? empty comment = deleted or account deleted?) → half-right sentences; needs the user plumbed into the data layer. |
| C — no log, list current things | "Your likes", "your comments" built from current data. | Rejected by your human partner: undone actions and changes would be invisible. |

Your human partner picked **A**, with the past filled in.

## Decided by your human partner

- An event log (history of actions, including undoing and changing things), not a list of current things.
- Shown under Settings in separate sub-pages per kind of activity; each entry tells what, when, and navigates to it.
- Waiting for review stays as it is.
- The past is filled in where a date exists.
- Approach A.

## Design

### Data

New table `activity_events` (append-only):

| column | |
|---|---|
| `id uuid`, `user_id uuid` → users (cascade) | |
| `kind text` | e.g. `reaction.liked`, `deal.shipped` (list below) |
| `category text` | `likes`, `comments`, `collection`, `follows`, `marketplace`, `trades`, `reports` |
| `occurred_at timestamptz` | |
| `item_id`, `collection_id`, `comment_id`, `listing_id`, `conversation_id`, `deal_id`, `review_id`, `report_id`, `other_user_id` — all `uuid NULL` | targets; **no foreign keys** (a target may be deleted later; the entry stays and shows "No longer available") |
| `details jsonb NOT NULL DEFAULT '{}'` | small facts the sentence needs that may change later: `{"from":3,"to":5}`, `{"quantity":2}`, `{"priceCents":1500}` — **never names or free text of other people** |
| `backfilled boolean` | came from the one-time fill of the past |

Index (`user_id`, `category`, `occurred_at desc`) and (`user_id`, `occurred_at desc`).

### Kinds recorded (one test each)

| Category | Kinds (action path) |
|---|---|
| likes | `reaction.liked`, `reaction.unliked`, `reaction.rated` {to}, `reaction.rerated` {from,to}, `reaction.unrated` {from} (ReactionsController) |
| comments | `comment.posted`, `comment.replied`, `comment.edited`, `comment.deleted` (ItemCommentService) |
| collection | `collection.created`, `collection.edited` (incl. cover image), `collection.deleted`; `item.added` {quantity} (Upsert, pending Add new), `item.addedToExisting` {quantity} (pending Add to match), `item.edited`, `item.deleted` (incl. quantity → 0) |
| follows | `follow.followed`, `follow.unfollowed` |
| marketplace | `listing.posted`, `listing.edited`, `listing.archived`, `listing.reactivated`; `chat.started`; `offer.sent` {priceCents}, `meetup.proposed`, `proposal.accepted`/`declined`/`withdrawn` |
| trades | `deal.proposed`, `deal.accepted`, `deal.declined`, `deal.cancelled`, `deal.handoffConfirmed`, `deal.shipped`, `deal.receiptConfirmed`, `deal.disputed`; `review.written` {stars}, `review.replied` |
| reports | `report.filed` |

Recorded for **the acting user only** (a deal step by the seller is in the seller's log, not the buyer's).

### Recording

`IActivityLog.Record(Guid userId, string kind, ActivityTargets targets, object? details = null)` adds the row to the
current `CofferDbContext` without saving; the action's own `SaveChanges` persists both. One static list
`ActivityKinds` holds every kind → category, used by the API filter and the tests.

### Filling the past (once)

An idempotent startup task `ActivityBackfill` (runs when no `backfilled` rows exist yet) inserts, per user:
comments (`comment.posted` / `comment.replied` at `created_at`), items (`item.added` at `acquired_at`, live and
tombstoned), collections (`collection.created` at `created_at`), follows (`follow.followed` at `followed_at`),
listings (`listing.posted` at `created_at`), deals (proposed by seller at `created_at`; `deal.shipped` at `shipped_at`
by seller; `deal.receiptConfirmed` at `received_at` and `deal.disputed` at `disputed_at` by buyer; `deal.cancelled` by
`cancelled_by` at `updated_at`), reviews (`review.written` at `created_at`, `review.replied` at `replied_at` by the
reviewee), reports (`report.filed` at `created_at`). Deleted accounts are skipped. Likes/ratings have no dates and are
not filled.

### API

- `GET api/Activity?category&page&pageSize` → `PagedList<ActivityEntryDto>`, newest first, owner only.
- `GET api/Activity/Summary` → per category: count and latest time (for the menu).
- `ActivityEntryDto(Guid Id, string Kind, string Category, DateTime OccurredAt, JsonElement Details, ActivityTargetDto Target)`
  where the target is **resolved at read time**: `Type` (item/collection/comment/listing/conversation/deal/review/report),
  ids to navigate with, `Title` (item primary attribute / collection name / listing title / other user's name),
  `Image` (item or collection image, listing's first image), `Excerpt` (the comment text, own comments only),
  `Available` (false when the target is deleted/tombstoned or the other user deleted their account → placeholder
  title, no image).

### App

- **Settings** gets a row "My activity" (in Account, under "Waiting for review") → `settings/activity` menu:
  "All activity" on top, then one row per category with an icon, its last activity time, and count.
- **Category page** (`settings/activity/[category]`): day-grouped list ("Today", "Yesterday", "Mon, 17 Nov"), each
  entry: kind icon, sentence (i18n `activity:kinds.<kind>` with `{{name}}`, details values), small thumbnail when
  there is one, relative time; tapping opens the target; empty state per category; infinite scroll.
- **Navigation per target**: item → `openItem(itemId)` (comment kinds pass `commentId`; the item page scrolls to and
  briefly highlights it); own collection → collection screen; listing → `openListing`; conversation / deal → `openChat`
  (deal panel shows the deal); review → its deal's chat; report → Settings › Reports. Unavailable → the row is not
  tappable and reads "No longer available".
- Long-press shows the full date and time.

### Deletion

- Account deletion deletes the user's `activity_events` (before the user row is tombstoned).
- Targets deleted later never delete log rows; the entry turns into "No longer available".

## Calls made while writing this up (your human partner can overturn them)

1. Plain chat text messages are not logged; starting a chat, offers, meetups and answers to them are.
2. A report's moderation outcome is not a log entry (Settings › Reports shows it).
3. The past is filled by an idempotent startup task (testable), not by the SQL migration.
4. Opening a comment scrolls to it and highlights it for a moment (new on the item page).
5. A deal step is logged only for the user who took it.
6. Profile edits and accepting the marketplace terms are not logged (not activity users look back on).

## Left to the builder

- Exact icon per kind, day-header formatting, file split of the screens.
- Whether `details` uses `jsonb` (Postgres) via the existing JSON conversion pattern for SQLite tests.
- Exact sentence wording (en + hu), within the meaning of each kind.
