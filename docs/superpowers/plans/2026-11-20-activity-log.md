# Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user action is recorded in a private event log; Settings › My activity shows it per category, newest first, and each entry opens where it happened.

**Architecture:** An `activity_events` table written by `IActivityLog.Record(...)` inside each action's own save (no separate commit). Targets are stored as ids only and resolved at read time (names, images, availability). A one-time idempotent startup task fills the past from existing dated rows. The app adds a menu screen and a paged per-category list with navigation helpers.

**Tech Stack:** ASP.NET Core 8 + EF Core (Npgsql / SQLite in xUnit), hand-run SQL migration; Expo / React Native, expo-router, @tanstack/react-query, i18next (en + hu), node:test.

**Spec:** `docs/superpowers/specs/2026-11-20-activity-log-design.md`

## Global Constraints

- Git: no Co-authored-by / AI attribution in commits; never push; no branches (commit on `development`).
- Schema change in `src/startup/activity_log_migration.sql` (header "Run with:", `BEGIN; … COMMIT;`); EF in sync. `details` is a `string` column (`jsonb` only when `Database.IsNpgsql()`, same pattern as `CofferDbContext.cs:159`).
- No foreign keys from `activity_events` to targets; only `user_id` → users with cascade.
- Never store another person's name or text in `details`; names come from the targets at read time.
- Recording adds the row to the same `CofferDbContext` before the action's `SaveChanges`; an action that fails records nothing.
- A deal step is recorded only for the acting user.
- Categories (exact strings): `likes`, `comments`, `collection`, `follows`, `marketplace`, `trades`, `reports`.
- Paging: 20 per page, newest first (`occurred_at desc, id`).
- Commands: backend `"/c/Program Files/dotnet/dotnet.exe" test src/Coffer/Coffer.Tests`; app (in `src/Coffer/Coffer.ReactNative`) `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors`.

## Review Focus

1. **Unlike / unrate / quantity → 0** — the "undo" kinds are recorded with the right `from` value, not as a new like/edit. Tests `UnlikeRecordsUnliked`, `ChangingRarityRecordsFromAndTo`, `QuantityZeroRecordsItemDeleted` (Task 2).
2. **A failed action records nothing** (permission denied, validation error, AI failure on pending add). Test `FailedActionRecordsNothing` (Task 2), `FailedDealStepRecordsNothing` (Task 3).
3. **Target deleted later / other user deleted their account** — the entry is still listed, `available=false`, placeholder title, no image, no other user's name. Test `DeletedTargetsAreUnavailableAndNameless` (Task 4).
4. **Backfill run twice / after real events exist** — no duplicates; only users not deleted. Test `BackfillIsIdempotent` (Task 5).
5. **Another user's log** — never readable. Test `LogIsOwnerOnly` (Task 4).

---

### Task 1: Activity table, kinds and recorder

**Files:**
- Create: `src/Coffer/Coffer.Domain/Entities/ActivityEvent.cs`, `src/Coffer/Coffer.BusinessLogic/Activity/ActivityLog.cs`, `src/startup/activity_log_migration.sql`, `src/Coffer/Coffer.Tests/Activity/ActivityLogTests.cs`
- Modify: `src/Coffer/Coffer.DataAccess/CofferDbContext.cs` (`DbSet<ActivityEvent> ActivityEvents`, table `activity_events`, indexes (`user_id`,`category`,`occurred_at`) and (`user_id`,`occurred_at`)), `src/Coffer/Coffer.Infrastructure/ModerationRegistration.cs` (DI)

**Interfaces:**
- Produces:
  ```csharp
  public class ActivityEvent { Guid Id; Guid UserId; string Kind; string Category; DateTime OccurredAt;
      Guid? ItemId, CollectionId, CommentId, ListingId, ConversationId, DealId, ReviewId, ReportId, OtherUserId;
      string Details = "{}"; bool Backfilled; }
  public sealed record ActivityTargets(Guid? ItemId = null, Guid? CollectionId = null, Guid? CommentId = null, Guid? ListingId = null,
      Guid? ConversationId = null, Guid? DealId = null, Guid? ReviewId = null, Guid? ReportId = null, Guid? OtherUserId = null);
  public static class ActivityKinds { public static readonly IReadOnlyDictionary<string,string> Category; /* kind → category, every kind of the spec table */ }
  public interface IActivityLog { void Record(Guid userId, string kind, ActivityTargets targets, object? details = null); }
  ```
  `Record` throws `ArgumentException` for a kind not in `ActivityKinds`; uses `IClock.UtcNow`; serializes `details` with camelCase JSON (`{}` when null); does **not** save.

- [ ] **Step 1: Failing tests** — `RecordAddsRowSavedWithTheAction` (Record then `SaveChanges` → one row with kind, category from the map, targets, details `{"from":3,"to":5}`); `RecordDoesNotSaveByItself` (Record without save → new context sees 0 rows); `UnknownKindThrows`; `EveryKindHasACategory` (all values ∈ the 7 categories; the map contains every kind listed in the spec table — list them in the test).
- [ ] **Step 2: Run** `--filter ActivityLogTests` → FAIL (compile).
- [ ] **Step 3: Implement** (+ SQL `CREATE TABLE IF NOT EXISTS activity_events (...)` with `details jsonb NOT NULL DEFAULT '{}'`, `backfilled boolean NOT NULL DEFAULT false`, FK `user_id` cascade, the two indexes).
- [ ] **Step 4: Run** → PASS; full suite.
- [ ] **Step 5: Commit** `feat(api): activity log table and recorder`

### Task 2: Record collection-side actions

**Files:**
- Modify: `ReactionsController.cs`, `ItemCommentService.cs`, `CollectionsController.cs` (create via generic `Create` override or a small hook, `Update`, `CoverImage/Upload`, `Delete`), `ItemsController.cs` (`Upsert` new/updated, `Update`, `Delete`), `PendingItemService.cs` (`AddAsync` new / match), `FollowsController.cs`
- Test: `src/Coffer/Coffer.Tests/Activity/ActivityRecordingCommunityTests.cs`

**Interfaces:**
- Consumes: `IActivityLog` (Task 1).
- Kinds and details: `reaction.liked`, `reaction.unliked`, `reaction.rated {to}`, `reaction.rerated {from,to}`, `reaction.unrated {from}` (all with `ItemId`, `OtherUserId` = item owner when not self); `comment.posted` / `comment.replied` (`ItemId`, `CommentId`), `comment.edited`, `comment.deleted`; `collection.created` / `.edited` / `.deleted` (`CollectionId`); `item.added {quantity}` (`ItemId`, `CollectionId`) for Upsert-new and pending-Add-new, `item.addedToExisting {quantity}` for pending-Add-match, `item.edited`, `item.deleted` (incl. Update with quantity 0); `follow.followed` / `follow.unfollowed` (`CollectionId`, `OtherUserId` = owner).
- Generic-controller saves happen inside repositories: record **before** calling the repository method that saves (the shared `CofferDbContext` instance persists the event with it), or call `SaveChangesAsync` once after — never in a separate transaction.

- [ ] **Step 1: Failing tests** (API level via `ApiFactory`, one per kind group): `LikeAndUnlikeRecorded`, `UnlikeRecordsUnliked`, `ChangingRarityRecordsFromAndTo` (rate 3 → rerate 5 → unrate: details `{to:3}`, `{from:3,to:5}`, `{from:5}`), `CommentKindsRecorded` (post, reply, edit, delete), `CollectionKindsRecorded`, `ItemKindsRecorded` (Upsert new with Python ok, PUT edit, DELETE), `QuantityZeroRecordsItemDeleted`, `PendingAddRecordsAddedOrAddedToExisting`, `FollowKindsRecorded`, `FailedActionRecordsNothing` (PUT another user's collection → 403 and 0 events; pending Add with AI failure → 0 events).
- [ ] **Step 2: Run** `--filter ActivityRecordingCommunityTests` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; full suite.
- [ ] **Step 5: Commit** `feat(api): record likes, comments, collections, items and follows`

### Task 3: Record marketplace actions

**Files:**
- Modify: `ListingService.cs` (create, update, archive, reactivate), `ConversationService.cs` (`OpenAsync` when it creates a conversation → `chat.started`; `PostAsync` price offer → `offer.sent {priceCents}`, meetup → `meetup.proposed`; `RespondAsync` → `proposal.accepted|declined|withdrawn`), `DealService.cs` (propose, accept, decline, cancel, confirm handoff, ship, confirm receipt, dispute — **not** auto-complete / moderator actions), `ReviewService.cs` (`review.written {stars}`, `review.replied`), `ReportService.cs` (`report.filed`)
- Test: `src/Coffer/Coffer.Tests/Activity/ActivityRecordingMarketTests.cs` (service level on `DealTestBase`/`ReportTestBase` helpers, constructing services with a real `ActivityLog`)

**Interfaces:**
- Consumes: `IActivityLog`. Services gain it as a constructor parameter (DI); test bases construct it with `new ActivityLog(Db.Context, Clock)`.
- Targets: listing kinds `ListingId`; chat/offer/proposal kinds `ConversationId`, `ListingId`, `OtherUserId`; deal kinds `DealId`, `ConversationId`, `ListingId`, `OtherUserId`; review kinds `ReviewId`, `DealId`, `OtherUserId`; `report.filed` `ReportId` + the reported target's ids (`ItemId`/`ListingId`/`ConversationId`/`CommentId`) when known.

- [ ] **Step 1: Failing tests** — `ListingKindsRecorded`, `ChatAndProposalKindsRecorded`, `DealStepsRecordedForTheActorOnly` (seller proposes → seller's log only; buyer accepts → buyer's log only; …), `AutoCompletionRecordsNothing`, `FailedDealStepRecordsNothing` (cancel after shipped → conflict, 0 new events), `ReviewKindsRecorded`, `ReportFiledRecorded`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; full suite (existing test bases updated to pass `IActivityLog`).
- [ ] **Step 5: Commit** `feat(api): record listings, chats, deals, reviews and reports`

### Task 4: Read API, target resolution, deletion

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Activity/ActivityQueryService.cs`, `src/Coffer/Coffer.ASPNET/Controllers/ActivityController.cs` (`MarketplaceControllerBase`), `src/Coffer/Coffer.Tests/Activity/ActivityApiTests.cs`
- Modify: `AccountDeletionService.cs` (delete the user's events in the deletion transaction)

**Interfaces:**
- Produces:
  ```csharp
  public sealed record ActivityTargetDto(string Type, Guid? Id, Guid? ItemId, Guid? CollectionId, Guid? CommentId, Guid? ListingId,
      Guid? ConversationId, Guid? DealId, string Title, string? Image, string? Excerpt, bool Available, string? OtherName);
  public sealed record ActivityEntryDto(Guid Id, string Kind, string Category, DateTime OccurredAt, JsonElement Details, ActivityTargetDto Target);
  public sealed record ActivityCategoryDto(string Category, int Count, DateTime? LatestAt);
  // GET api/Activity?category&page&pageSize → PagedList<ActivityEntryDto>; GET api/Activity/Summary → List<ActivityCategoryDto> (all 7, zeros included)
  ```
  `Type` priority: comment > item > collection > deal > conversation > listing > review > report. Resolution per page with batched queries. `Title`: item primary attribute value, collection name, listing title, report summary; `OtherName` from the other user (`""` when deleted). `Image`: item image / collection image / listing first image (file names; the app builds URLs). `Excerpt`: comment body (own comments only; empty when deleted/removed). `Available=false` when the main target is missing, tombstoned (`DeletedAt`), a removed listing, or a deleted comment; then `Title=""`, `Image=null`, `Excerpt=null`. Unknown `category` → 400 `unknownActivityCategory`.

- [ ] **Step 1: Failing tests** — `ListIsNewestFirstAndPaged` (25 events → 20 + 5), `CategoryFilter`, `SummaryHasAllCategories`, `TargetsResolveNamesAndImages`, `DeletedTargetsAreUnavailableAndNameless` (tombstoned item, deleted comment, other user deleted → `available=false`, `otherName=""`), `LogIsOwnerOnly` (B's request never returns A's events; there is no id-based endpoint), `UnknownCategoryIs400`, `AccountDeletionRemovesLog`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; full suite; `npm run check:errors` (+ hu text for `unknownActivityCategory`).
- [ ] **Step 5: Commit** `feat(api): read the activity log with resolved targets`

### Task 5: Fill the past

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Activity/ActivityBackfill.cs`, `src/Coffer/Coffer.Tests/Activity/ActivityBackfillTests.cs`
- Modify: `src/Coffer/Coffer.ASPNET/Extensions/StartupExtension.cs` (`app.RunActivityBackfill()` after the development seed), `Program.cs` (call it)

**Interfaces:**
- Produces: `IActivityBackfill.RunAsync() -> Task<int>` (rows inserted). Skips entirely when any `Backfilled` row exists. Sources and kinds exactly as the spec's "Filling the past"; users with `DeletedAt` skipped; all rows `Backfilled = true`; deal events attributed per the spec (seller: proposed, shipped; buyer: receiptConfirmed, disputed; `CancelledBy`: cancelled); `review.replied` for the reviewee at `RepliedAt`.

- [ ] **Step 1: Failing tests** — `BackfillCreatesEventsFromDatedRows` (one row of each source → the expected kinds, users, times), `BackfillSkipsDeletedUsers`, `BackfillIsIdempotent` (second run inserts 0; total unchanged), `BackfillLeavesLikesOut`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; full suite.
- [ ] **Step 5: Commit** `feat(api): fill the activity log from existing dated data`

### Task 6: App — My activity screens and navigation

**Files:**
- Create: `src/types/entities/activity.ts`, `src/utils/activity_api.ts`, `src/hooks/activity.ts` (`useActivitySummary()`, `useActivity(category | null)` via `usePagedQuery`), `src/utils/activity_format.ts` (pure: `groupByDay(entries, now, labels)`, `sentenceParams(entry, t)`), `tests/activity_format.test.ts`, `src/app/settings/activity/index.tsx` (menu), `src/app/settings/activity/list.tsx` (category list; category via a small store like `review_store`), `src/components/activity/activity_row.tsx`, `src/utils/open_activity.ts`, `src/hooks/comment_focus_store.ts`
- Modify: `src/app/settings/index.tsx` (row "My activity" under "Waiting for review"), `src/const/navigation_params.ts`, `src/const/endpoints.ts`, `src/components/comments/open_item.ts` (`openItem(itemId, opts?: { commentId?: string })` sets the focus store), `src/components/comments/comment_section.tsx` (scroll to + highlight the focused comment once, then clear), new i18n namespace `activity` (en + hu: menu titles, category names/icons, `kinds.<kind>` sentences with `{{name}}`, `{{stars}}`, `{{from}}`, `{{to}}`, `{{quantity}}`, `{{price}}`, `{{other}}`, day labels, "No longer available", empty states), `src/i18n` registration

**Interfaces:**
- Consumes: Task 4 API.
- `openActivity(entry)` → item/comment: `openItem(itemId, { commentId })`; collection (own): load collection + type, set `useCollectionStore`, navigate `ROUTES.MYCOLLECTION`; listing: `openListing(id, title)`; conversation/deal/review: `openChat(conversationId, other, title)`; report: navigate `ROUTES.SETTINGS.REPORTS`. Not available → no navigation (row not pressable).

- [ ] **Step 1: Failing tests** (`tests/activity_format.test.ts`) — `groupsByTodayYesterdayAndDate`, `sentenceParamsForRerate` ({from:3,to:5} → `from: "3★"`, `to: "5★"`), `sentenceParamsUsePlaceholderWhenUnavailable`, `priceIsFormatted` (via existing money formatter, injected).
- [ ] **Step 2: Run** `npm run test:unit` → FAIL. **Step 3: Implement** the screens (menu: "All activity" + 7 category rows with icon, count, last time; list: day sections, rows with kind icon, sentence, thumbnail when any, relative time, long-press full date; infinite scroll; empty state per category; unavailable rows muted with "No longer available").
- [ ] **Step 4: Run** `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors` → pass.
- [ ] **Step 5: Commit** `feat(app): My activity — per-category log that opens where it happened`

### Task 7: Device check

- [ ] **Step 1:** Apply `src/startup/activity_log_migration.sql` to the dev db (port-5433 override if needed); restart `api` (runs the backfill).
- [ ] **Step 2:** On the emulator (a seeded user): Settings › My activity shows counts per category from the filled past; like an item, rate it, change the rating, comment, edit and delete the comment, follow/unfollow — each appears at the top of its category with the right sentence; tapping a comment entry opens the item and highlights the comment; a deal entry opens the chat; an entry of a deleted item reads "No longer available" and does nothing.
- [ ] **Step 3: Commit** any fixes found (each with its failing test first where testable).
