# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can delete their account. Their own content is wiped. Every deletion in the app (account, item, collection, admin item removal) leaves other users' data in place, linked to an empty placeholder ("tombstone") row.

**Architecture:**
- **Tombstones:** `users`, `collections`, `items` and `listings` get a nullable `deleted_at` column. One backend service, `ContentTombstoneService`, wipes content and sets `deleted_at` instead of deleting rows, so no foreign key cascade can reach other users' rows.
- **Hiding:** read paths filter out tombstones explicitly.
- **Placeholders:** DTOs carry `isDeleted` flags, and the app maps them to translated placeholder labels.

**Tech Stack:** ASP.NET Core 8, EF Core (Npgsql in production, SQLite in xUnit), hand-run SQL migrations, Expo/React Native with i18next (en + hu), node:test for app unit tests.

**Spec:** `docs/superpowers/specs/2026-11-20-account-deletion-design.md`

## Global Constraints

- **Git:** never add a `Co-authored-by` line or any AI attribution to commits. Don't push. No new branches; commit on `development`.
- **Schema:** schema changes go into `src/startup/account_deletion_migration.sql`. Follow the style of `src/startup/drop_user_contacts_migration.sql`: a header with "Run with:", and the body inside `BEGIN; … COMMIT;`. The EF model must match it.
- **No EF global query filters.** Filter `DeletedAt == null` explicitly.
- **Blocking deal statuses:** `Proposed`, `AwaitingHandoff`, `AwaitingShipment`, `Shipped`. Finished: `Completed`, `Cancelled`, `Disputed`.
- **Placeholder labels:**

  | Key | en | hu |
  |---|---|---|
  | `common:deleted.user` | Deleted user | Törölt felhasználó |
  | `common:deleted.collection` | Deleted user's collection | Törölt felhasználó gyűjteménye |
  | `common:deleted.item` | Deleted user's item | Törölt felhasználó tárgya |
  | `common:deleted.listing` | Deleted user's listing | Törölt felhasználó hirdetése |

- **Error codes:**
  - `accountHasOpenTrades` (409)
  - `accountDeleted` (401, written by the middleware)
  - `userDeleted`, `itemDeleted`, `collectionDeleted`, `listingDeleted` (404)
  - `otherUserDeleted` (409, sending into a chat whose other participant is deleted)
- **Commands:**
  - dotnet runs from Bash as `"/c/Program Files/dotnet/dotnet.exe"`.
  - Backend tests: `"/c/Program Files/dotnet/dotnet.exe" test src/Coffer/Coffer.Tests`.
  - App checks, from `src/Coffer/Coffer.ReactNative`: `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors`.
- **Cleanup after commit:** files and embeddings are cleaned up after the database commit, best effort. A failure is logged and skipped. The database tombstone is what counts.

## Review Focus

1. **A trade moves to Shipped while deletion runs.** The open-trade check and the wipe must run in the same transaction, so a deal that becomes `Shipped` mid-delete still blocks it. Task 3 does the check inside the transaction.
2. **An old token after deletion, or deleting twice.** Expect 401 `accountDeleted`, never 500 and never a second wipe. Task 3: test `OldTokenIsRejectedAfterDeletion`.
3. **Comment threads that mix users.** A deleted user's comment that has other users' replies, and the deleted user's reply inside another user's thread, both stay as "Comment deleted" placeholders in their place. Task 3: test `DeletedUsersCommentsBecomePlaceholdersInThreads`.
4. **A chat whose other participant was deleted.** The other user can still load it from the inbox; sending returns 409 `otherUserDeleted`. Task 5: test `ChatWithDeletedUserLoadsButCannotSend`.
5. **Signing in again with the same Google/GitHub account.** `GetUserByLogin` finds nothing, so registration creates a new user with no old data. Task 3: test `SameLoginAfterDeletionIsANewUser`.

Known limitation, not a test: other users' comment bodies may still contain the literal text "@OldName". That text belongs to them. The mention chip becomes a placeholder.

---

### Task 1: Tombstone columns and generic hiding

**Files:**
- Create: `src/Coffer/Coffer.Domain/Entities.Interfaces/ITombstoned.cs`
- Modify:
  - `src/Coffer/Coffer.Domain/Entities/User.cs`, `Collection.cs`, `Item.cs`
  - `src/Coffer/Coffer.Domain/Marketplace/Entities.cs` (Listing)
  - `src/Coffer/Coffer.DataAccess/Repositories/Generic/ReadOnlyGenericRepository.cs`
  - `src/Coffer/Coffer.DataAccess/Repositories/Generic/GenericRepository.cs` (both `UpdateItemAsync` overloads)
- Create: `src/startup/account_deletion_migration.sql`
- Test: `src/Coffer/Coffer.Tests/Deletion/TombstoneHidingTests.cs`

**Interfaces:**
- Produces:
  - `interface ITombstoned { DateTime? DeletedAt { get; set; } }`, implemented by `UserProvided`, `CollectionProvided`, `ItemProvided` and `Listing`.
  - `protected IQueryable<TEntity> Live(IQueryable<TEntity> q)` in `ReadOnlyGenericRepository`. It filters `DeletedAt == null` when `TEntity : ITombstoned`, and otherwise returns `q`.

- [ ] **Step 1: Write the failing tests**
  - `GenericPageSkipsTombstonedItems`:
    1. Two items in one collection; set `DeletedAt` on one.
    2. `GET api/Items/Page?filter=…collectionId…` returns `total == 1` and `totalQuantity` of the live item only.
  - `GetByIdOfTombstonedItemIs404`: `GET api/Items/{id}` of the tombstoned item returns 404.
  - `UpdateOfTombstonedCollectionIs404`: `PUT api/Collections/{id}` of a tombstoned collection by its owner returns 404.
- [ ] **Step 2: Run them.** `… test src/Coffer/Coffer.Tests --filter TombstoneHidingTests`. Expected: FAIL. `DeletedAt` doesn't exist yet, so this is a compile error.
- [ ] **Step 3: Implement.**
  - Add `DeletedAt` to the four entities.
  - Apply `Live` in `GetItemsAsync`, `GetPageAsync`, `GetItemByIdAsync` and both `UpdateItemAsync` overloads.
  - `ItemsRepository.SumQuantityAsync` must use `Live` too.
  - SQL: `ALTER TABLE users|collections|items|listings ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;`, with no new indexes.
- [ ] **Step 4: Run.** `… --filter TombstoneHidingTests` → PASS. Then the full backend suite → all pass.
- [ ] **Step 5: Commit.** `feat(api): tombstone columns and hiding in generic reads`

### Task 2: Item, collection and admin removal keep links (audit part 1)

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Account/ContentTombstoneService.cs`
- Modify:
  - `src/Coffer/Coffer.ASPNET/Controllers/ItemsController.cs` (`Delete`)
  - `src/Coffer/Coffer.ASPNET/Controllers/CollectionsController.cs` (`Delete`)
  - `src/Coffer/Coffer.BusinessLogic/Community/ItemRemovalService.cs`
  - `src/Coffer/Coffer.Infrastructure/ModerationRegistration.cs` (DI)
- Test: `src/Coffer/Coffer.Tests/Deletion/DeletionKeepsLinksTests.cs`

**Interfaces:**
- Consumes: `ITombstoned` (Task 1).
- Produces:
  ```csharp
  public interface IContentTombstoneService {
      Task TombstoneItemAsync(Guid itemId);                 // own transaction unless one is open; files + embedding after commit
      Task TombstoneCollectionAsync(Guid collectionId);     // collection + all its live items; deletes follows of it
  }
  ```
  - **An item tombstone:** set `DeletedAt`; clear `Description` and `PrivateNote`; set `Image = ""`; delete its `ItemAttributes` and `ItemTags` rows. Afterwards, delete the image file and call `DELETE {python}/delete_embeddings/{id}`.
  - **Reactions and comments are kept.** That includes the owner's own reactions on the item; they're harmless.
  - **A collection tombstone:** clear `Name` (set it to `""`), `Description` and `Image`; delete `Follows` of the collection; tombstone each item. Afterwards, delete the cover file and call `delete_collection_embeddings/{id}`.
  - `ItemRemovalService.RemoveAsync` keeps its signature, but calls `TombstoneItemAsync` and returns `null`. The service now deletes the file itself.

- [ ] **Step 1: Write the failing tests.** In each test, user B creates linked data on user A's content: a comment, a reply from A under B's comment, a reaction, and a `Report` with `ItemId`/`TargetId` on the item.
  - `OwnerDeletingItemKeepsOthersCommentsReactionsAndReports`:
    1. `DELETE api/Items/{id}` as A returns 200.
    2. A new context shows the item row still exists with `DeletedAt != null`, `Image == ""` and no tags.
    3. B's comment, the reply and the reaction still exist and have `ItemId == item.Id`. The report still exists.
    4. `FakePythonHandler.Calls` contains `delete_embeddings/{id}`.
  - `OwnerDeletingCollectionKeepsOthersDataOnAllItsItems`:
    1. Same setup, on two items of one collection, plus B follows the collection.
    2. After `DELETE api/Collections/{id}`: both items are tombstoned and every comment and reaction remains. B's follow is gone.
  - `AdminRemovingItemKeepsOthersData`: resolve a report with the remove-item decision through `AdminReportService`; the same assertions as the first test.
  - `TombstoneSurvivesAiServiceFailure`: with `FakePythonHandler.StatusCode = 500`, `DELETE api/Items/{id}` still returns 200 and the item is tombstoned.
- [ ] **Step 2: Run.** `--filter DeletionKeepsLinksTests` → FAIL (the rows are gone, cascaded).
- [ ] **Step 3: Implement** `ContentTombstoneService` and wire the three callers to it. Drop the controllers' own transaction and Python calls.
- [ ] **Step 4: Run** the filter → PASS. Then the full suite. Existing item, collection and admin-report tests that asserted the row is gone must now assert a tombstone instead. Update them and record each change as a ruling.
- [ ] **Step 5: Commit.** `feat(api): item and collection deletions keep other users' data (tombstones)`

### Task 3: Account deletion endpoint, wipe and token rejection (audit part 2)

**Files:**
- Modify:
  - `src/Coffer/Coffer.BusinessLogic/Account/ContentTombstoneService.cs`
  - the `AccountController` in `src/Coffer/Coffer.ASPNET/Controllers/CommentsController.cs` (route `api/Account`)
  - `src/Coffer/Coffer.ASPNET/Controllers/UsersController.cs`: override `Delete` with `[NonAction]` so the route is gone
  - `src/Coffer/Coffer.ASPNET/Extensions/SuspensionEnforcementMiddleware.cs`
  - `src/Coffer/Coffer.DataAccess/Repositories/UsersRepository.cs`: `GetUserById`, `GetUserByLogin` and `GetUserByName` skip tombstones
- Test: `src/Coffer/Coffer.Tests/Deletion/AccountDeletionTests.cs`

**Interfaces:**
- Consumes: `TombstoneCollectionAsync` (Task 2).
- Produces:
  ```csharp
  public sealed record BlockingDealDto(Guid DealId, Guid ConversationId, string ListingTitle, UserSummaryDto Other, DealStatus Status, bool CanCancel, DateTime? EndsLatestAt);
  public sealed record AccountDeletionStatusDto(bool CanDelete, List<BlockingDealDto> BlockingDeals);
  Task<AccountDeletionStatusDto> GetDeletionStatusAsync(Guid userId);
  Task DeleteAccountAsync(Guid userId);   // throws MarketplaceException.Conflict("accountHasOpenTrades", …)
  ```
  - `GET api/Account/Deletion` returns `AccountDeletionStatusDto`.
  - `DELETE api/Account` returns 204, or 409 `accountHasOpenTrades`.
  - `CanCancel = Status != Shipped`.
  - `EndsLatestAt = ShippedAt + DealService.AutoCompleteAfter` for shipped deals, otherwise null. `AutoCompleteAfter` is already `public static readonly`.
- **Wiping a user**, in one transaction that begins with the open-trade check:
  - **Profile:** `Name = $"deleted-{id:N}"`, `Email = $"deleted-{id:N}@deleted.invalid"`, `ProviderUserId = $"deleted-{id:N}"`, `Avatar = null`, `Summary = null`, `Country = ""`, market-terms fields set to null, `DeletedAt = now`.
  - **Collections:** tombstone every live collection.
  - **Listings:** tombstone every listing: status `Archived`, `Title = ""`, `Description = null`, `ExchangeFor = null`; delete its lines and images. The image files are deleted after commit.
  - **Own rows:** delete the user's own follows and reactions.
  - **Comments:** every comment by the user gets `Body = ""` and `DeletedAt` (if not already set), and its mentions are removed. Never hard-delete.
  - **Kept as they are:** messages, participants, deals, reviews, reports, moderation actions and suspensions.
  - **After commit:** delete the avatar file if it is a stored upload, not an OAuth URL; then `SuspensionService.Forget(userId)`.
- **Middleware:** when the token's user row has `DeletedAt != null` (or doesn't exist), answer 401 with `{ code: "accountDeleted", message }`. Cache the lookup the same way suspensions are cached.

- [ ] **Step 1: Write the failing tests.**
  - `OpenTradesBlockDeletion`:
    1. One deal each in `AwaitingHandoff` and `Shipped`.
    2. `GET api/Account/Deletion` returns `canDelete == false` and 2 blocking deals. The shipped one has `canCancel == false` and `endsLatestAt == shippedAt + 14 days`.
    3. `DELETE api/Account` returns 409 `accountHasOpenTrades`, and nothing has changed.
  - `FinishedTradesDoNotBlock`: Completed, Cancelled and Disputed deals → `canDelete == true`.
  - `DeletingAccountWipesOwnContentAndKeepsOthers`:
    - Setup:
      - A has a collection with an item (B commented and reacted) and a listing with a completed deal with B, chat messages both ways, and B's review of A.
      - A has a comment on B's item, follows B's collection, and filed a report.
      - A has a suspension.
    - After `DELETE api/Account` (204):
      - **A's user row:** exists, with `DeletedAt` set, no email, avatar or summary, and a provider id starting with `deleted-`.
      - **A's content:** the collection, item and listing are tombstoned.
      - **Kept:** B's comment and reaction, the deal, both sides' messages (A's body unchanged), B's review, A's report and A's suspension.
      - **Wiped:** A's comment has an empty body and `DeletedAt` set; A's follow is gone.
  - `DeletedUsersCommentsBecomePlaceholdersInThreads`: B's thread has A's reply, and A's thread has B's reply. After deletion, both threads load through `GET api/Items/{id}/Comments`: A's comments have `isDeleted == true` and `author.isDeleted == true`, and B's replies are present.
  - `OldTokenIsRejectedAfterDeletion`: A's old client calling `GET api/Auth/currentUser` → 401 `accountDeleted`. A second `DELETE api/Account` → 401.
  - `SameLoginAfterDeletionIsANewUser`: `UsersRepository.GetUserByLogin("google", "sub-A")` returns null after deletion.
  - `GenericUserDeleteRouteIsGone`: `DELETE api/Users/{A.Id}` as A → 404 or 405, and A is untouched.
- [ ] **Step 2: Run.** `--filter AccountDeletionTests` → FAIL (404 on the new routes).
- [ ] **Step 3: Implement** as specified above.
- [ ] **Step 4: Run** the filter → PASS. Then the full suite.
- [ ] **Step 5: Commit.** `feat(api): delete account (blocked by open trades), reject deleted users' tokens`

### Task 4: Hide tombstones in every list and search

**Files:**
- Modify:
  - `src/Coffer/Coffer.DataAccess/Repositories/ItemsRepository.cs`: `GetFeedPageAsync`, `SearchItems`, `SearchItemsSmart`, `GetItemsByCollectionAsync`
  - `CollectionsRepository.cs`: `GetGroupedPageAsync`, `GetCollectionByIdForDelete`, `SearchCollections`, `SearchCollectionsSmart`
  - `UsersRepository.cs`: `SearchUsersAsync`, `SearchUsersSmartAsync`
  - `ItemTagsRepository.cs`: both searches and `GetTagStatsAsync`
  - `FollowsRepository.cs`: both reads
  - `src/Coffer/Coffer.ASPNET/Controllers/CollectionsController.cs`: the image check maps the Python ids to live items only
  - `src/Coffer/Coffer.BusinessLogic/Community/ItemCommentService.cs`: create, list and mentionable
  - `src/Coffer/Coffer.BusinessLogic/Marketplace/Listings/ListingService.cs`: details of a tombstoned listing return 404 `listingDeleted`
- Test: `src/Coffer/Coffer.Tests/Deletion/TombstoneListsTests.cs`

**Interfaces:**
- Consumes: the tombstones made by Task 2 and Task 3 services. Tests create them through `IContentTombstoneService`.
- Produces: no new signatures.
- **Error codes for tombstoned targets:**
  - Comments: listing or creating comments on a tombstoned item returns 404 `itemDeleted`. Comment counts are unchanged.
  - Profiles: profile-by-id or name of a deleted user returns 404 `userDeleted`.
  - Collections: a collection by id returns 404 `collectionDeleted`.

- [ ] **Step 1: Write the failing tests.** Create one theory or test per path, each with one live and one tombstoned row, asserting that only the live one comes back and that totals count only live rows:
  - feed
  - `Search` (mixed), `Search/Users`, `Search/Collections`, `Search/Items`, `SearchTag`
  - `UserExists/{name}` of a deleted user's old name → false
  - `Collections/Grouped`
  - `Feed/UserFollows`
  - comments mentionable
  - `Comments` on a tombstoned item → 404 `itemDeleted`
  - listing search
  - listing details → 404 `listingDeleted`
  - tag stats

  Use Postgres-only trigram searches the same way `FeedPagingApiTests` does, skipping those tests under SQLite. Note any skip as a ruling and verify it with curl in Task 7.
- [ ] **Step 2: Run.** `--filter TombstoneListsTests` → FAIL (tombstones show up).
- [ ] **Step 3: Implement.** Add `x.DeletedAt == null` at each listed query, on the entity being listed and on its owner where the query joins one.
- [ ] **Step 4: Run** the filter → PASS. Then the full suite.
- [ ] **Step 5: Commit.** `feat(api): tombstones never appear in feeds, searches, profiles or lists`

### Task 5: Placeholders in API responses; chats with deleted users

**Files:**
- Modify:
  - `src/Coffer/Coffer.BusinessLogic/Marketplace/Common/Shared.cs` (`UserSummaryDto`)
  - `Community/ItemCommentService.cs` (`MentionDto`)
  - `Marketplace/Messaging/MessagingDtos.cs` (`SubjectSummaryDto`) and `ConversationService` (subject mapping, send guard)
  - `Marketplace/Deals/DealDtos.cs` and its mapper
  - `Marketplace/Reviews/ReviewService.cs`
- Test: `src/Coffer/Coffer.Tests/Deletion/PlaceholderDtoTests.cs`

**Interfaces:**
- Produces:
  - `UserSummaryDto(Guid Id, string Name, string? Avatar, bool IsDeleted = false)`. `From(User u)` returns `Name = ""`, `Avatar = null` and `IsDeleted = true` when `u.DeletedAt != null`.
  - `MentionDto(Guid UserId, string Name, bool IsDeleted = false)`. Same rule.
  - `SubjectSummaryDto(…, bool IsDeleted = false)`. For a tombstoned listing: `Title = ""` and `Image = null`.
  - `DealDto` and `ReviewDto` gain `bool ListingDeleted` as the last parameter, with default `false`.
  - Sending any message or proposal in a conversation whose other participant is tombstoned throws `MarketplaceException.Conflict("otherUserDeleted", "This user deleted their account.")`.
  - `ConversationDto` gains nothing: the app reads `other.isDeleted`.

- [ ] **Step 1: Write the failing tests.**
  - `DeletedCounterpartIsAPlaceholderEverywhere`: after A's deletion, B's view of each of these shows A with `isDeleted == true`, `name == ""` and `avatar == null`:
    - inbox
    - conversation
    - deals mine
    - deal by id
    - reviews for B
    - comments on B's item
  - In the same views, the listing subject and deal show `isDeleted` / `listingDeleted == true` with an empty title.
  - `ChatWithDeletedUserLoadsButCannotSend`: B's `GET` of the conversation messages → 200, and it includes A's old messages with their bodies unchanged. B's `POST` of a message → 409 `otherUserDeleted`.
  - `MentionOfDeletedUserIsPlaceholder`: B's comment mentioning A returns a mention with `isDeleted == true` and `name == ""`.
- [ ] **Step 2: Run.** `--filter PlaceholderDtoTests` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the filter → PASS. Then the full suite.
- [ ] **Step 5: Run** `npm run check:errors` (it reads the backend codes); if it reports changes, run `npm run gen:errors`.
- [ ] **Step 6: Commit.** `feat(api): deleted users and their content come back as placeholders`

### Task 6: App placeholders and handling a deleted account

**Files:**
- Create:
  - `src/Coffer/Coffer.ReactNative/src/utils/deleted_labels.ts`
  - `tests/deleted_labels.test.ts`
- Modify:
  - `src/types/entities/market.ts` (`UserSummary.isDeleted?`, `SubjectSummary.isDeleted?`, `Deal.listingDeleted?`, `Review.listingDeleted?`)
  - `src/types/entities/comment.ts` (`Mention.isDeleted?`)
  - **Every place a `UserSummary.name` or subject or listing title is shown:**
    - `components/comments/comment_section.tsx`, `comment_body.tsx`
    - `components/market/chats/chat_list.tsx`
    - `app/chat/index.tsx`
    - `components/market/deal/deal_panel.tsx`
    - the deal list
    - `components/market/review/review_card.tsx`, `review_modal.tsx`
    - `app/listingdetails/index.tsx`

    Find the rest with `grep -rn "\.name\b\|\.title\b\|listingTitle" src`.
  - `src/const/backendAccessConfiguration.ts`
  - `src/i18n/locales/{en,hu}/common.json`

**Interfaces:**
- Produces:
  ```ts
  export function userLabel(u: { name: string; isDeleted?: boolean } | null | undefined, t: TFunction): string; // deleted or null → t("common:deleted.user")
  export function listingLabel(title: string, deleted: boolean | undefined, t: TFunction): string;             // deleted → t("common:deleted.listing")
  export function canOpenProfile(u: { isDeleted?: boolean } | null | undefined): boolean;
  ```
  - The existing keys `comments:row.deletedUser` and `market:review.deletedUser` are replaced by `common:deleted.user`. Remove them from both locales.
  - `components/account/` gains handling for the 401 `accountDeleted` answer: clear the token and reset navigation to the sign-in screen. Hook it in the axios interceptor next to the suspension handling.
  - In `app/chat/index.tsx`, when `conversation.other.isDeleted`, render a notice row with `market:chat.otherDeleted` ("This user deleted their account." / "Ez a felhasználó törölte a fiókját.") instead of the composer.
  - Tapping a deleted user's avatar or name does nothing.

- [ ] **Step 1: Write the failing test** in `tests/deleted_labels.test.ts`:
  - `userLabel({name:"", isDeleted:true}, t)` returns `"common:deleted.user"`, using a `t` that echoes the key.
  - `userLabel({name:"Anna"}, t)` returns `"Anna"`.
  - `userLabel(null, t)` returns the deleted label.
  - `listingLabel("", true, t)` returns `"common:deleted.listing"`.
  - `canOpenProfile({isDeleted:true})` returns false.
- [ ] **Step 2: Run** `npm run test:unit` → FAIL (the module is missing).
- [ ] **Step 3: Implement** the helpers, then replace every display site found in the file list. Add the i18n keys from Global Constraints and add `market:chat.otherDeleted`.
- [ ] **Step 4: Run** `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n` and `npm run check:errors` → all pass.
- [ ] **Step 5: Commit.** `feat(app): placeholders for deleted users and listings`

### Task 7: Delete-account screen, device check, audit report

**Files:**
- Create:
  - `src/Coffer/Coffer.ReactNative/src/app/settings/delete_account.tsx`
  - `src/components/settings/delete_account/blocking_trades.tsx`
- Modify:
  - `src/app/settings/user.tsx`: a destructive `ListRow` "Delete account" at the bottom
  - `src/const/navigation_params.ts`: `ROUTES.SETTINGS.DELETE_ACCOUNT`
  - `src/utils/market_api.ts`: `deletionStatus()` and `deleteAccount()`
  - `src/const/endpoints.ts`: `accountDeletion: "api/Account/Deletion"`, `account: "api/Account"`
  - the `settings.json` locales (en, hu)

**Interfaces:**
- Consumes:
  - `GET api/Account/Deletion` and `DELETE api/Account` (Task 3)
  - `marketApi.cancelDeal(id, reason?)` (existing)
  - the `ConfirmDialog` component (existing)
- **The screen:**
  1. A short text on what is deleted and what is kept. Keys `settings:deleteAccount.*`, en + hu.
  2. The blocking trades list:
     - each row shows `listingLabel`, `userLabel(other)` and a status label;
     - a Cancel button when `canCancel` (it confirms, calls `cancelDeal`, then refetches);
     - otherwise "Ends by {date}" from `endsLatestAt`, using the existing date formatter.
  3. A username text field. The red Delete button is enabled only when `canDelete` and the field equals `user.name`.
  4. `ConfirmDialog`. On confirm it calls `DELETE api/Account`, signs out exactly like `handleLogout` in `app/settings/index.tsx` (Google revoke + `removeToken`), and resets navigation to `ROUTES.ROOT`.

- [ ] **Step 1: Implement** the screen, row, route and API calls.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run check:i18n` and `npm run test:unit` → pass.
- [ ] **Step 3: Apply the migration** to the dev db, rebuild the API container, then check on the emulator:
  - Migration: `docker compose -f src/docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < src/startup/account_deletion_migration.sql`. Expected: `ALTER TABLE` ×4 and `COMMIT`.
  - Device check, with a dev-login user who has an open trade:
    1. The screen lists the trade and the button is disabled.
    2. Cancel the trade; the button enables after typing the name.
    3. Delete; you land on the login screen.
    4. As the other dev user: the chat shows "Deleted user", has no composer, and the old messages are visible. The deal shows "Deleted user's listing". Comments on the deleted user's item show "Comment deleted" / "Deleted user". The feed and search don't show the deleted user's content.
  - With curl and a dev-login token, check that the Postgres search endpoints skip tombstones.
- [ ] **Step 4: Commit.** `feat(app): delete account screen`
- [ ] **Step 5: Write the audit result** into the final report: every deletion path from the spec's table, with what happens to other users' data now and the test that proves it (Tasks 2–5), plus why each unchanged path was already safe.
