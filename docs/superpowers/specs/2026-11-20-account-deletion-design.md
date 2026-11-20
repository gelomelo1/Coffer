# Account deletion, and deletions that keep other users' data linked

## Why

Users must be able to delete their account (GDPR right to erasure). The rule: a deletion removes **the deleter's
own content**, but **never another user's data**. Other users' comments, chats, deals, reviews and reports, plus the
moderation records and admin log, have to keep pointing at what they were about. This keeps users accountable and
the records intact. Wherever such a record points at deleted content, the app shows a placeholder: "Deleted user",
"Deleted user's collection", "Deleted user's item", "Deleted user's listing", "Comment deleted".

The same rule applies to every other deletion in the app (item, collection, admin removal). An audit with tests
proves it.

## Goals

- `Delete my account` in the app's user settings.
- Deleting the account wipes the user's personal data, collections, items and listings, and the text of their
  comments. Other users' records stay linked and show placeholders.
- Deletion is **blocked while the user has trades in progress**. The delete screen lists them:
  - Trades that haven't shipped get a Cancel button, which uses the existing cancel flow.
  - Shipped trades say when they end at the latest: shipped date + 14 days, or earlier once the buyer confirms
    receipt or disputes.
- Deleting an item or a collection, and an admin removing an item, also keep other users' data linked.
- An audit of every deletion path, backed by a test per path.

## Non-goals

- Scheduled or "pending" deletion. Your human partner chose the simple block: the user comes back once the trades
  are finished.
- Data export (the GDPR "download my data" right) is out of scope.
- An admin-side "delete this user" in Coffer.Manager. Admins keep suspensions.
- Restoring a deleted account. Deletion is final.

## Anti-goals (a failure even if it "works")

- Any deletion that removes, or silently unlinks, a row another user created: a comment, reply, message, deal,
  review, report or reaction.
- Deleted content still reachable in a feed, search, profile, collection list, follows list, @mention picker,
  marketplace browse or image-similarity search.
- The deleted user's name, email, avatar, summary or images still being stored or served.
- A deleted user's existing login token still working.

## Constraints

- Schema changes go into a new hand-run SQL script, `src/startup/account_deletion_migration.sql`, written in the
  style of the existing migration scripts (a "Run with:" header, inside `BEGIN;` / `COMMIT;`). The EF model in
  `CofferDbContext`, `CommunityModel` and `MarketplaceModel` must match it. The test database is built by
  `EnsureCreated` from the EF model.
- Image files live under `IMAGESTORE_PATH`. Embeddings live in the Python service (`delete_embeddings/{itemId}`,
  `delete_collection_embeddings/{collectionId}`).
- Everything the user sees is in i18n (en + hu); `check:i18n` must pass.
- No new git branches, no pushes, no Co-authored-by trailers.

## Approaches

| | What | Trade-off |
|---|---|---|
| **A — tombstones (chosen)** | The user, collection, item and listing rows stay as empty placeholders flagged deleted. Personal fields and images are wiped, and the rows are hidden from every list and search. | No foreign key changes, so nothing that exists today can be deleted by accident. Cost: every list and search must skip deleted rows (about 15 places), each covered by a test. |
| B — hard delete with loosened links | Rows really removed; every link changed to SET NULL, with labels stored alongside. | Most links must change in SQL and EF, and every screen must cope with "nothing there". One missed link silently deletes another user's data. |
| C — hybrid | Tombstone only the rows others interacted with, hard-delete the rest. | Both sets of costs. Dropped. |

Your human partner picked **A**.

## Decided by your human partner

- In-progress trades **block** deletion (no scheduled deletion).
- The deleted user's **comments**: the text is wiped, and a placeholder ("Deleted user" / "Comment deleted") is
  always kept, so threads, replies and reports keep working.
- The deleted user's **market chat messages are kept as they are**, with the sender shown as "Deleted user". They
  are the other person's record of the trade.
- Approach A, followed by the deletion audit.

## Design

### Data

New nullable `deleted_at timestamp` on `users`, `collections`, `items` and `listings`. A row is a tombstone when
it's set.

**Wiping a user** (in one transaction):
- `name` gets a unique, never-shown placeholder. `GetUserByName` must never match it, so the name becomes free
  again.
- `email` gets a placeholder; `provider_user_id` gets a unique placeholder, so signing in again with the same
  Google or GitHub account creates a fresh user.
- `avatar`, `summary` and the market-terms fields are cleared. `country` is set to an empty placeholder value.
- The user's suspensions, reports they filed, moderation actions and reviews about them all **stay**. They hold
  only the user's id.

**What happens to the user's content:**
- **Collections:** tombstoned. Name, description and image are cleared, and the image file and collection
  embeddings deleted.
- **Items:** tombstoned. Description, private note, tags and attributes are cleared, and the image file and
  embedding deleted. `Image` is NOT NULL, so it becomes an empty string.
- **Listings:** tombstoned, and the status is set to `Archived` so that no market query that checks status shows
  them. Title, description, exchange text, lines and image files are wiped.
- **The user's own follows and reactions:** deleted. Nothing links to them.
- **Follows other users had on the deleted collections:** deleted. A follow is a subscription, not content, so
  removing it costs nobody accountability.
- **The user's comments:** body cleared, `DeletedAt` set, mentions removed. They are never hard-deleted.
- **Chat messages, conversation participation, deals and reviews written by the user:** unchanged.

### Shared tombstone code

There is one service, `ContentTombstoneService`, with `TombstoneItemAsync`, `TombstoneCollectionAsync` and
`DeleteAccountAsync`. Every deletion path uses it:

| Deletion path | Today | After |
|---|---|---|
| Owner deletes an item (`DELETE api/Items/{id}`) | Hard delete; other users' comments and reactions cascade away | Tombstone item |
| Owner deletes a collection (`DELETE api/Collections/{id}`) | Hard delete; its items, and their comments, cascade away | Tombstone collection and its items |
| Admin removes an item when resolving a report (`ItemRemovalService`) | Hard delete; cascades | Tombstone item |
| User deletes their account (new `DELETE api/Account`) | `DELETE api/Users/{id}` hard-deletes; cascades wipe comments, the other side's deals, reviews they received, reports they filed and their suspensions | `DeleteAccountAsync`. The generic `DELETE api/Users/{id}` is removed (it returns 405 / isn't routed). |
| Author deletes a comment | Tombstone if it has replies or reports, otherwise hard delete | Unchanged: already keeps every link |
| Listing ends (sold, archived, removed by admin) | Status change, row kept | Unchanged |
| Admin removes a message, review or comment | `IsRemoved` flag | Unchanged |
| Unfollow, un-like, removing a listing image or line on edit | Removes the user's own row; nothing else links to it | Unchanged |
| Collection types, attributes and item options | Read-only over the API, no delete | Unchanged |

The **audit** is a test class, `DeletionKeepsLinksTests`, with one test per changed row of the table:
1. Another user creates linked data: a comment and a reply, a reaction, a report, a chat message, a deal, a review.
2. The deletion runs.
3. The test asserts that every one of those rows still exists and still references the tombstone, and that the
   API returns placeholders for them.

The unchanged rows each get a short entry in the final report, saying why they are already safe.

### Blocking trades

A trade blocks deletion when its status is `Proposed`, `AwaitingHandoff`, `AwaitingShipment` or `Shipped`. The
statuses `Completed`, `Cancelled` and `Disputed` are finished.

`GET api/Account/Deletion` returns:
- `canDelete`
- the blocking deals, each with: deal id, listing title, the other user's name, status, `canCancel` (true when not
  shipped), and `endsLatestAt` (shipped date + 14 days, for shipped deals).

`DELETE api/Account` returns 409 with the code `accountHasOpenTrades` when trades block it, and 204 when the
account is deleted.

### Hiding tombstones

Use explicit `DeletedAt == null` filters, not EF global query filters. A global filter on Users or Items would
silently drop comments, messages and deals in queries that include those navigations.

Places to filter:
- Feed: the feed itself, search (users, collections, items, tags, mixed), image-similarity results.
- Users: user profile by id or name, `UserExists`, the mentionable list.
- Collections: grouped collections, collection by id.
- Items: item pages, `SumQuantity`.
- Follows: follows of a user.
- Marketplace: listing search, listing details.
- Embeddings: the Python service has no tombstones, because embeddings are deleted.

Opening a tombstoned collection or item, or the profile of a deleted user, returns 404 with codes such as
`userDeleted` and `itemDeleted`. The app shows a "This was deleted" state.

### Placeholders in API responses

DTOs that show another user or another user's content gain an `isDeleted` flag, with the name or title left empty:
- comment authors and mention chips
- conversation participants and chat senders
- deal counterparts and the listing title on deals and conversations
- reviewers and reviewees
- the item and collection in the comment and report contexts

The app maps `isDeleted` to translated labels:
- `common:deleted.user`: "Deleted user" / "Törölt felhasználó"
- `common:deleted.collection`: "Deleted user's collection" / "Törölt felhasználó gyűjteménye"
- `common:deleted.item`: "Deleted user's item" / "Törölt felhasználó tárgya"
- `common:deleted.listing`: "Deleted user's listing" / "Törölt felhasználó hirdetése"

Deleted users get a neutral avatar.

### Signing out and old tokens

`SuspensionEnforcementMiddleware`, or a sibling of it, rejects requests from a user whose row is tombstoned. The
answer is 401 with the code `accountDeleted`, so an old JWT is useless. After a successful delete, the app clears
its tokens and storage and goes to the sign-in screen.

### App

Settings → User → **Delete account** (red, at the bottom) opens a screen that:
1. Explains what is deleted and what is kept: "Your comments stay as 'Comment deleted', and your chat messages stay
   in the other person's chats as 'Deleted user'."
2. Lists the blocking trades, with Cancel buttons (the existing cancel flow, optional reason) or "ends by <date>",
   and keeps the delete button disabled while any remain.
3. Asks for confirmation: the user types their username and confirms with a destructive confirmation dialog.

## Calls made while writing this up (your human partner can overturn them)

- **Chat:** in a conversation whose other participant is deleted, the composer is replaced by "This user deleted
  their account", because nobody can answer. The history stays readable.
- **Reviews:** the other person can still leave their review inside the normal 14-day window after the deal ended,
  and reviews the deleted user wrote stay, shown as "Deleted user".
- **Admin removal:** an item an admin removed shows the same placeholder as one its owner deleted. The report keeps
  its frozen snapshot as the evidence.
- **Old URL:** `DELETE api/Users/{id}` is removed rather than redirected, so no caller can reach the old
  hard-delete cascade.

## Left to the builder

- The exact placeholder strings stored in name, email and provider id (unique, never shown).
- Whether the tombstone service lives in `Coffer.BusinessLogic/Community` or a new `Account` folder.
- The exact UI layout of the delete screen, within the existing settings style.
- Whether file and embedding cleanup that fails after commit is logged and skipped (preferred) or retried. The
  database state is what counts for accountability.
