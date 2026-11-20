# Waiting-for-Review List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every cap the AI detects is kept on its collection's waiting-for-review list until the owner acts on it. The owner works through the list on a redesigned review screen with Add, Skip and Skip & delete (each with a 5-second Undo), can upload several photos at once, and reaches the list from the collection or from Settings.

**Architecture:**
- **Storage:** right after the AI check, the backend moves each detection's crop and fingerprint (`.jpg` + `.npy`) from the 10-minute temp folder to `IMAGESTORE_PATH/pending/` and inserts a `pending_items` row.
- **Matching:** a new Python endpoint re-matches stored fingerprints whenever the list is read.
- **Add:** creates the item (or adds its quantity to an existing one) and saves the fingerprint through a second new Python endpoint.
- **Undo:** the app holds each action for 5 seconds before sending it, so Undo never needs a server-side reversal.

**Tech Stack:**
- Backend: ASP.NET Core 8, EF Core (Npgsql / SQLite in xUnit), hand-run SQL migrations.
- AI service: FastAPI with ChromaDB (unittest + TestClient).
- App: Expo SDK 54 / React Native 0.81 with expo-router, @tanstack/react-query and i18next (en + hu); unit tests run on node:test.

**Spec:** `docs/superpowers/specs/2026-11-20-item-review-queue-design.md`

## Global Constraints

- **Git:** no Co-authored-by or AI attribution in commits; never push; no new branches (commit on `development`).
- **Schema:** schema changes go in `src/startup/item_review_queue_migration.sql`, in the existing style (a "Run with:" header and a `BEGIN; … COMMIT;` body). The EF model must match it.
- **Pending files:** stored at `{IMAGESTORE_PATH}/pending/{id}.jpg` and `{id}.npy`. The fingerprint is never kept in the database.
- **Required fields:** the primary attribute is always required, whatever its flag. A required field counts as filled when:
  - text, select, multi-select, autocomplete: not blank;
  - number: set;
  - date: set;
  - boolean: always.
- **Undo window:** exactly 5000 ms.
- **Gallery limit:** 10 photos per upload.
- **Review list paging:** 20 per page, newest first (`created_at desc, id`).
- **New error codes:** `requiredAttributeMissing` (400, arg = attribute name), `pendingItemNotFound` (404), `matchItemNotFound` (404).
- **Commands:**
  - Backend tests: `"/c/Program Files/dotnet/dotnet.exe" test src/Coffer/Coffer.Tests`.
  - Python tests: `src/Coffer/Coffer.PythonService/venv/Scripts/python.exe -m unittest discover -s tests`, run from `Coffer.PythonService`.
  - App, from `src/Coffer/Coffer.ReactNative`: `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors`.
- **UI:** icons from `@expo/vector-icons/MaterialIcons` (no emoji icons); theme tokens only; touch targets at least 48 dp; reduced motion respected for the slide between caps.

## Review Focus

1. **Files missing at move time** (the temp files already expired or vanished). Those detections are counted as `lost` and skipped; the rest of the photo still becomes pending, never a 500. Test: `ImageCheckSkipsDetectionsWhoseFilesVanished` (Task 3).
2. **A match that was deleted meanwhile.** Adding to a `matchItemId` that is tombstoned or in another collection answers 404 `matchItemNotFound`, and the pending item stays. Test: `AddToDeletedMatchKeepsPending` (Task 4).
3. **Double send** (a retry after a timeout). A second Add of the same pending id answers 404 `pendingItemNotFound` and creates no second item; a second DELETE answers 204. Test: `AddTwiceCreatesOneItem` (Task 4).
4. **The app leaves the review while an action is held.** The held action is sent at once on unmount or app-background, never dropped. Test: `flushSendsHeldActionImmediately` (Task 6).
5. **Another user's pending id.** Every pending endpoint answers 404 for a non-owner. Test: `OtherUsersPendingIs404` (Task 4).

---

### Task 1: Schema — pending items and the required flag

**Files:**
- Create: `src/Coffer/Coffer.Domain/Entities/PendingItem.cs`, `src/startup/item_review_queue_migration.sql`, `src/Coffer/Coffer.Tests/Pending/PendingSchemaTests.cs`
- Modify: `src/Coffer/Coffer.Domain/Entities/Attribute.cs` (`public bool Required { get; set; }`), `src/Coffer/Coffer.DataAccess/CofferDbContext.cs` (`DbSet<PendingItem> PendingItems`, table `pending_items`, FKs to users and collections with cascade, index on (`collection_id`, `created_at`)), `src/Coffer/Coffer.ReactNative/src/types/entities/attribute.ts` (`required: boolean`)

**Interfaces:**
- Produces: `class PendingItem { Guid Id; Guid UserId; Guid CollectionId; int Quantity; string Image; DateTime CreatedAt; }`; `Attribute.Required`; `static bool AttributeRules.IsRequired(Attribute a) => a.Primary || a.Required` in `Coffer.Domain/Entities/Attribute.cs`.

- [ ] **Step 1: Write the failing tests.** `PendingItemRoundTrips` inserts a `PendingItem` and reads it back with every field equal. `PrimaryIsAlwaysRequired` checks that `AttributeRules.IsRequired` is true for `{Primary=true, Required=false}`, true for `{Primary=false, Required=true}`, and false for `{false,false}`. `AttributesApiExposesRequired`: `GET api/Attributes` JSON has a `required` property.
- [ ] **Step 2: Run** `--filter PendingSchemaTests` → FAIL (compile).
- [ ] **Step 3: Implement.** SQL: `CREATE TABLE IF NOT EXISTS pending_items (...)` with the FKs `ON DELETE CASCADE`, the index, `ALTER TABLE attributes ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false; UPDATE attributes SET required = true WHERE "primary" = true;`
- [ ] **Step 4: Run** the filter → PASS; then the full suite → all pass.
- [ ] **Step 5: Commit.** `feat(api): pending items table and required attribute flag`

### Task 2: AI service — match and save from a stored fingerprint

**Files:**
- Create: `src/Coffer/Coffer.PythonService/pending.py`, `src/Coffer/Coffer.PythonService/tests/test_pending.py`
- Modify: `src/Coffer/Coffer.PythonService/app.py`

**Interfaces:**
- Produces:
  - `POST /pending_similars/{collection_id}` with body `{"ids": [str]}` returns `{"status":"ok","response":[{"id":str,"state":"found"|"not found","similars":[str]}]}`.
    - The `.npy` is read from `{IMAGESTORE_PATH}/pending/{id}.npy`.
    - Matching uses the same rules as `build_image_check_response`: `SIMILARITY_THRESHOLD`, secondary = main − 0.1, top_n 3, metadata filter `collection_id`.
    - A missing file gives `{"state":"not found","similars":[]}` for that id only.
  - `POST /save_pending_embedding/{collection_id}` with body `{"pendingId":str,"itemId":str}` saves `pending/{pendingId}.npy` under `itemId` with metadata `collection_id`. It doesn't delete the file (the backend deletes it), and failures answer HTTP 500 through `error_response`.
  - In `pending.py`: `pending_similars(collection, collection_id, base_path, ids) -> list[dict]` and `save_pending_embedding(collection, collection_id, base_path, pending_id, item_id) -> None`.

- [ ] **Step 1: Write the failing tests.** Use a `FakeCollection` with `query` returning fixed distances and `add` recording calls.
  - `test_pending_similars_found_and_missing_file`: one `.npy` exists with fake distance 0.02, so `found` and its id are in `similars`; a second id has no file, so `not found` with `[]`; HTTP 200.
  - `test_save_pending_embedding_adds_under_item_id`: `add` was called with `ids=[itemId]` and metadata `{"collection_id": cid}`.
  - `test_save_pending_embedding_missing_file_is_500`.
- [ ] **Step 2: Run** the unittest command → FAIL (404 routes).
- [ ] **Step 3: Implement** in `pending.py` and wire the routes in `app.py`, with `IMAGESTORE_PATH` from the environment and `os.path.join(..., "pending")`.
- [ ] **Step 4: Run** → PASS (including the existing `test_app_security.py`).
- [ ] **Step 5: Commit.** `feat(ai): match and save from a stored pending fingerprint`

### Task 3: Image check creates pending items

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Pending/PendingItemService.cs`, `src/Coffer/Coffer.Tests/Pending/PendingImageCheckTests.cs`
- Modify:
  - `src/Coffer/Coffer.ASPNET/Controllers/CollectionsController.cs`: `ImageCheck/{id}` delegates to the service.
  - `src/Coffer/Coffer.Tests/ApiFactory.cs`: `FakePythonHandler` gains `Func<HttpRequestMessage, (HttpStatusCode, string)>? Responder`, used when set; also adds `TestEnvironment.Pending`.
  - DI in `src/Coffer/Coffer.Infrastructure/ModerationRegistration.cs`.

**Interfaces:**
- Consumes: `PendingItem` (Task 1).
- Produces:
  - `public sealed record PendingItemDto(Guid Id, Guid CollectionId, int Quantity, DateTime CreatedAt, string State, List<ItemProvided> Similars);`
  - `public sealed record ImageCheckResultDto(List<PendingItemDto> Created, int Lost);`
  - `IPendingItemService.CreateFromImageAsync(Guid userId, Guid collectionId, IFormFile file) -> Task<ImageCheckResultDto>`
  - `public static string PendingFolder` (= `IMAGESTORE_PATH/pending`).
  - `POST api/Collections/ImageCheck/{id}` now returns `ImageCheckResultDto`. Permission and Python errors behave as before.

- [ ] **Step 1: Write the failing tests.** The `Responder` returns the detections `[{id:A,state:"not found",quantity:2,similars:[]},{id:B,state:"found",quantity:1,similars:[existingItemId]}]`, and the test writes `A.jpg/.npy` and `B.jpg/.npy` into `TestEnvironment.Temp`.
  - `ImageCheckCreatesPendingItemsAndMovesFiles`:
    - The response has `created.length == 2` and `lost == 0`, and B's `similars[0].id == existingItemId`.
    - The database has 2 `pending_items` for the owner and collection, with quantities 2 and 1.
    - The files now exist in `pending/` and no longer in temp.
  - `ImageCheckSkipsDetectionsWhoseFilesVanished`: only A's files exist, so `created.length == 1`, `lost == 1` and HTTP 200.
  - `ImageCheckOnOthersCollectionIsForbidden`: another user gets 403 and no rows.
- [ ] **Step 2: Run** `--filter PendingImageCheckTests` → FAIL.
- [ ] **Step 3: Implement.**
  - Move each detection with `File.Move(temp/{id}.jpg → pending/{id}.jpg)`, and the same for `.npy`.
  - If either source is missing, count it as `lost` and delete whichever half was moved.
  - Insert the rows and save; then load the similars' items through the live `GetItemByIdAsync`.
- [ ] **Step 4: Run** → PASS; then the full suite. Any existing test asserting the old `ImageCheckResponse[]` shape is updated, with a ruling.
- [ ] **Step 5: Commit.** `feat(api): image check keeps every detection on the waiting list`

### Task 4: Pending item API — list, summary, image, add, delete

**Files:**
- Create: `src/Coffer/Coffer.ASPNET/Controllers/PendingItemsController.cs`, `src/Coffer/Coffer.Tests/Pending/PendingItemsApiTests.cs`
- Modify: `src/Coffer/Coffer.BusinessLogic/Pending/PendingItemService.cs`

**Interfaces:**
- Consumes: the Task 2 endpoints and the Task 3 service.
- Produces, for the owner only (anyone else gets 404 `pendingItemNotFound`):
  - `GET api/Collections/{id}/Pending?page&pageSize` returns `PagedList<PendingItemDto>`, re-matched through `/pending_similars` in one call per page. If that call fails, entries get `state:"not found"` and an empty `similars`, never a 500.
  - `GET api/Pending/Summary` returns `List<PendingSummaryDto>`, where `PendingSummaryDto(Guid CollectionId, string CollectionName, int CollectionTypeId, int Count, Guid LatestId)`. It covers only collections with count > 0 and skips tombstoned collections.
  - `GET api/Pending/Image/{id}` returns the jpg.
  - `POST api/Pending/{id}/Add` takes `AddPendingInput(Guid? MatchItemId, ItemRequired? Item, int Quantity)`. Exactly one of `MatchItemId` and `Item` is set, otherwise 400; `Quantity` is at least 1, otherwise 400.
    - **Match:** a live item of the same collection gets `+= Quantity`.
    - **New:** `Item.Quantity = Quantity` and `Item.CollectionId = pending.CollectionId`; required attributes are validated (`requiredAttributeMissing`); the item is inserted; the jpg is copied with `IImageService.CopyImageAsync(newId, pending/{id}.jpg, ItemFolder)`; then `/save_pending_embedding` is called. If any step fails, the transaction rolls back, the new image file is removed, and the pending item stays.
    - Afterwards the row, the jpg and the npy are deleted, and the response is the `ItemProvided`.
  - `DELETE api/Pending/{id}` deletes the row and the files; it is idempotent (204).

- [ ] **Step 1: Write the failing tests.**
  - `ListIsNewestFirstAndRematched`: 3 pending items with different `CreatedAt`; the Responder answers `/pending_similars` with a found match for one; the order and that match are asserted.
  - `ListSurvivesAiFailure`: `/pending_similars` answers 500, the list still answers 200, and every entry is `not found`.
  - `SummaryCountsPerCollection`.
  - `AddToMatchIncreasesQuantityAndClearsPending`: an item with quantity 2 plus a pending item, Add with quantity 3; the item ends at 5, the row is gone, and the files are gone.
  - `AddNewCreatesItemWithImageAndEmbedding`: the new item exists with an image file in the items folder, and the Python calls include `/save_pending_embedding/{cid}`.
  - `AddNewWithoutRequiredAttributeIs400`: an empty primary value gives 400 `requiredAttributeMissing`, no item, and the pending item stays.
  - `AddNewWhenAiFailsKeepsPending`: `/save_pending_embedding` answers 500, the result is not 2xx, there is no item and no new image file, and the pending item stays.
  - `AddToDeletedMatchKeepsPending`.
  - `AddTwiceCreatesOneItem`.
  - `DeleteRemovesRowAndFilesAndIsIdempotent`.
  - `OtherUsersPendingIs404`: list, image, add and delete all answer 404.
- [ ] **Step 2: Run** `--filter PendingItemsApiTests` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; run the full suite; run `npm run check:errors` (regenerate with `npm run gen:errors` and add the hu translations of the 3 new codes by hand).
- [ ] **Step 5: Commit.** `feat(api): review, add and delete waiting items`

### Task 5: Waiting items go with their collection or account

**Files:**
- Modify: `src/Coffer/Coffer.BusinessLogic/Account/ContentTombstoneService.cs` (`TombstoneCollectionAsync` deletes the collection's pending rows and adds their jpg and npy to `TombstoneCleanup.Files`), `src/Coffer/Coffer.BusinessLogic/Account/AccountDeletionService.cs` (the user's remaining pending rows, if any outside collections, are deleted the same way)
- Test: `src/Coffer/Coffer.Tests/Pending/PendingCleanupTests.cs`

**Interfaces:**
- Consumes: `TombstoneCleanup.Files`, which takes `(OwnerId, File, Folder)`. Pending files are deleted with `IImageService.DeleteImageAsync`, not the "owned image" check, so `CleanupAsync` gains a list `RawFiles` of full paths (they are deleted when they exist).

- [ ] **Step 1: Write the failing tests.**
  - `CollectionDeleteRemovesItsPendingItemsAndFiles`: 2 pending items with files; after `DELETE api/Collections/{id}`, no rows and no files remain.
  - `AccountDeleteRemovesPendingItemsAndFiles`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; then the full suite.
- [ ] **Step 5: Commit.** `feat(api): waiting items go with their collection or account`

### Task 6: App logic — required fields and the held-action (undo) queue

**Files:**
- Create: `src/Coffer/Coffer.ReactNative/src/utils/required_fields.ts`, `src/utils/held_action.ts`, `tests/required_fields.test.ts`, `tests/held_action.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // required_fields.ts
  export function isRequired(a: { primary: boolean; required?: boolean }): boolean;
  export function isFilled(a: Attribute, value: string | number | boolean | null | undefined): boolean; // rules from Global Constraints
  export function missingRequired(attributes: Attribute[], values: Record<number, unknown>): Attribute[]; // primary first, then attribute order
  export function orderFields(attributes: Attribute[]): { required: Attribute[]; optional: Attribute[] }; // primary first
  // held_action.ts
  export interface HeldAction { id: string; label: string; send: () => Promise<void> }
  export class HeldActionQueue {
    constructor(opts: { delayMs: number; onSent?: (a: HeldAction) => void; onFailed?: (a: HeldAction, e: unknown) => void;
                        setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (t: unknown) => void });
    hold(a: HeldAction): void;   // sends any currently held action first, then holds a
    undo(): HeldAction | null;   // cancels and returns the held one
    flush(): Promise<void>;      // sends the held one now
    get held(): HeldAction | null;
  }
  ```

- [ ] **Step 1: Write the failing tests.**
  - `missingRequiredListsPrimaryFirst`: Brand (primary) is empty and a required Year is empty, so the result is `[Brand, Year]`.
  - `booleanAlwaysFilled`; `zeroNumberIsFilled`; `blankStringIsMissing`.
  - `orderFieldsPutsPrimaryOnTop`.
  - `holdSendsAfterDelay`: fake timers; nothing is sent before 5000 ms, then exactly one send.
  - `undoCancels`: undo returns the action and it is never sent.
  - `holdingSecondSendsFirstImmediately`.
  - `flushSendsHeldActionImmediately`.
  - `failedSendReportsOnFailed`.
- [ ] **Step 2: Run** `npm run test:unit` → FAIL (modules missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; run `npx tsc --noEmit`.
- [ ] **Step 5: Commit.** `feat(app): required-field rules and the 5-second held action`

### Task 7: App — upload several photos

**Files:**
- Create:
  - `src/Coffer/Coffer.ReactNative/src/utils/pending_api.ts`: `checkImage(collectionId, asset)`, `pending(collectionId, page)`, `summary()`, `addPending(id, input)`, `deletePending(id)`, `pendingImageUrl(id)`.
  - `src/hooks/pending.ts`: `usePendingList(collectionId)` with `usePagedQuery`, `usePendingSummary()`, and query keys `pending`/`pendingSummary` in `src/const/querykeys.ts`.
  - `src/components/itemregister/upload_sheet.tsx`: Take photos / Choose from gallery.
  - `src/components/itemregister/upload_progress.tsx`: "Checking photo n of m", a per-photo result, Retry for failed photos, then "Review N caps".
- Modify:
  - `src/utils/data_access_utils.ts`: `pickImage` accepts `allowsMultipleSelection` and `selectionLimit: 10` for the gallery.
  - `src/components/itemregister/item_register_action_button.tsx` and `item_register_action_button_tabs.tsx`: open the upload sheet. The camera loops "Take another / Done (n)" through a small `ConfirmDialog`.
  - `src/const/endpoints.ts`, `src/types/entities/` (`PendingItem`, `PendingSummary`, `ImageCheckResult`).
  - en + hu `items.json` keys under `items:upload.*`.

**Interfaces:**
- Consumes: the Task 3 and Task 4 endpoints.
- Produces: `openReview(collectionId)`, which navigates to `ROUTES.REVIEW` with `{ collectionId }` (implemented in Task 8). The upload flow calls it when finished.

- [ ] **Step 1:** Implement the API, hooks and components. Photos are checked one by one with `await`, never in parallel. A failed photo keeps its asset for Retry.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run check:i18n`, `npm run test:unit` → pass.
- [ ] **Step 3: Commit.** `feat(app): upload several photos into the waiting list`

### Task 8: App — redesigned review screen

**Files:**
- Create:
  - `src/Coffer/Coffer.ReactNative/src/app/review/index.tsx`: the route, with `collectionId` as a param.
  - `src/components/review/review_header.tsx`
  - `src/components/review/photo_compare.tsx`: your photo next to the selected match, tap to enlarge.
  - `src/components/review/match_chips.tsx`: "+ New" plus up to 3 chips showing name and count.
  - `src/components/review/review_fields.tsx`: required section, Quantity stepper (at least 1), collapsible Optional.
  - `src/components/review/action_bar.tsx`: the "Still needed: …" / "✓ Ready to add" line plus Skip & delete / Skip / Add, fixed and safe-area and keyboard aware.
  - `src/components/review/undo_bar.tsx`
  - `src/components/review/review_help_sheet.tsx`: 3 steps, "Don't show again" stored per device (`expo-secure-store`, already used by `token_store`, key `reviewHelpSeen`).
- Modify: `src/const/navigation_params.ts` (`ROUTES.REVIEW`, `pageParams.review(collectionName)`); en + hu `items.json` keys under `items:review.*`. Delete `item_register_overlay.tsx`, `item_register_card.tsx` and `item_register_form.tsx` once nothing imports them; the private-note bug goes with them, and the new fields write `privateNote`.

**Interfaces:**
- Consumes: `usePendingList`, `addPending`, `deletePending` and `pendingImageUrl` (Task 7); `HeldActionQueue`, `missingRequired`, `orderFields` and `isRequired` (Task 6); `ItemEditDynamicFields` and `ItemEditTags` (existing).

- [ ] **Step 1: Implement** with this behaviour (spec §Review screen):
  - **Default selection:** match #1 when `state === "found"`, otherwise "+ New".
  - **Add** is disabled with `accessibilityState.disabled` and an accessibility label that includes "still needed: …". Tapping a missing name scrolls to and focuses its field.
  - **Actions:**
    - Add and Skip & delete hold through the queue, show the undo bar and advance.
    - Skip only advances, and Undo steps back.
    - Undo of a held action restores the cap on screen.
  - **Leaving:**
    - `useEffect` cleanup and the `AppState` change to background call `flush()`.
    - Close or back flushes, then pops.
  - **Feedback:**
    - After a send, `pending` and `pendingSummary` are invalidated.
    - `onFailed` shows the toast `items:review.sendFailed` (with the name) and refetches.
  - **Empty list:** "Nothing waiting · All caught up" and Close.
  - **Help:** the help sheet opens automatically the first time.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run check:i18n`, `npm run test:unit`, and `npx eslint src/app/review src/components/review` → pass, with no new warnings.
- [ ] **Step 3: Commit.** `feat(app): review screen with fixed actions, required tracking and undo`

### Task 9: App — ways into the list, device check

**Files:**
- Create: `src/Coffer/Coffer.ReactNative/src/app/settings/pending.tsx`: collections with waiting caps (thumbnail, name, count), opening `openReview`.
- Modify:
  - `src/app/mycollection/index.tsx`: banner "N caps waiting for review · Review" above the list when count > 0.
  - The collections-tab collection card: a tag "N waiting" from `usePendingSummary`.
  - `src/app/settings/index.tsx`: row "Waiting for review" with a count tag (`ROUTES.SETTINGS.PENDING`).
  - en + hu `settings.json` and `collections.json`.

**Interfaces:**
- Consumes: `usePendingSummary` and `openReview`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** the app checks → pass.
- [ ] **Step 3: Apply the migration** to the dev db (port-5433 override if the local Postgres still holds 5432) and restart `fastapi` and `api`. Then check on the emulator:
  1. Pick 2 gallery photos → progress → review opens on the newest caps.
  2. With "+ New" and an empty Brand, Add is disabled and the line says "Still needed: Brand"; type it, Add is enabled; Add → undo bar → Undo restores the cap.
  3. Add again and wait 5 s; the item appears in the collection.
  4. Skip moves on and the cap stays in the banner count.
  5. Skip & delete, wait 5 s; the count drops and the files are gone from `images/pending`.
  6. Close mid-list, reopen from Settings → Waiting for review; the remaining caps are still there.
  7. Choose a match → only Quantity shows → Add increases the match's quantity.
- [ ] **Step 4: Commit.** `feat(app): waiting-for-review banner, badges and Settings list`
