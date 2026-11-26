# Shape What's Next (contribution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voting and photo-collection rounds for new item types: a Manager tab that runs them, a backend that stores
votes and photos in the trainer's folder layout, and the app's Shape What's Next page — plus a phone-first resize with
a server safety net for every photo upload.

**Architecture:** One `contribution_phases` table for both phase kinds, a singleton settings row for the switch, side
tables for candidates / votes / forms / uploads. A `ContributionLifecycle.SettleAsync()` call at the start of every
contribution request (and from the hourly sweep) closes due phases, so end times are exact. Photos go to
`AppPaths.Contributions/{phaseId}/…` through a shared `UploadedImages.PrepareAsync` helper that every upload path now uses.

**Tech Stack:** ASP.NET Core 8 + EF Core (PostgreSQL; SQLite in tests), xUnit; Python 3 / Tkinter + unittest
(Coffer.Manager); Expo / React Native, expo-router, TanStack Query, i18next, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-26-contribution-design.md`

## Global Constraints

- Git: commit on the current branch (`development`); no new branches, never push, **no `Co-authored-by` trailers**.
- Schema changes only by hand-run SQL in `src/startup/`; the EF model mirrors it (tests use `EnsureCreated`).
- Backend errors: `MarketplaceException.<Kind>("camelCaseCode", "English message.")` so `npm run gen:errors` picks them
  up; Hungarian added to `src/i18n/locales/hu/errors.json`.
- Admin changes audited with `AdminAudit.Add(_db, adminId, action, "contribution", id, details, _clock.UtcNow)`.
- Times: stored and sent in UTC; the Manager shows/edits local time.
- App texts in `en` and `hu` (`npm run check:i18n` and the `locale_parity` test must pass); no new native module.
- Limits (spec): 3 candidates; name 1–60; description 0–300; vote text 10–1000; 1–20 photos per detection upload;
  5–10 per classification form; 300 photos per user per UTC day; "photos left" shown below 40; end date ≥ 5 minutes
  ahead; contribution photo width 800 px (server quality 90); listing / shipping width 1600 px (phone JPEG 0.8,
  server quality 85); 8 MB per file (existing `ImageUploadGuard`); 40 MB per upload request.
- Reason keys: `justFinished`, `communityTooSmall`, `contributionFinished`, `modelsInProgress`.
- Touch targets ≥ 48 dp, loading state on every sending button, error state with retry, reduced motion respected,
  colour never the only signal (ui-ux-pro-max checklist, spec "UI quality").

## Review Focus

1. **A vote or upload sent in the same second the phase ends** — must be refused (`contributionClosed`), never
   half-stored. Test in Task 4 (`VoteAtEndTimeIsRefused`) and Task 5 (`UploadAfterEndIsRefused`).
2. **Two admins / the sweep closing the same phase at once** — the second settle must be a no-op, not a second
   "justFinished" or an exception. Test in Task 3 (`SettleTwiceIsIdempotent`).
3. **A classification form whose 7th photo is not an image** — nothing of the form stored (no rows, no folder, no
   temp leftovers). Test in Task 5 (`BadPhotoInFormStoresNothing`).
4. **A photo the app prepared (≤ width, no metadata)** — stored byte-for-byte, not recompressed; and a small photo
   *with* GPS EXIF is re-encoded without it. Tests in Task 1.
5. **Phone clock several minutes off** — the countdown must follow the server (`serverNow`), not show negative time or
   reach zero early. Test in Task 9 (`countdownUsesServerOffset`, `countdownNeverNegative`).

---

## File map

Backend (`src/Coffer/`)
- Create `Coffer.BusinessLogic/Images/UploadedImages.cs` — safety net (`PrepareAsync`, `UploadWidths`).
- Modify `Coffer.BusinessLogic/Services/ImageService.cs`, `Services.Interfaces/IImageService.cs`, `Marketplace/Listings/ListingService.cs`, `Marketplace/Deals/DealService.cs`, `Pending/PendingItemService.cs`, `Coffer.ASPNET/Controllers/CollectionsController.cs`.
- Create `Coffer.Domain/Entities/Contribution.cs` — entities and enums.
- Modify `Coffer.DataAccess/CofferDbContext.cs` — DbSets + mapping.
- Create `src/startup/contribution_migration.sql`.
- Modify `Coffer.BusinessLogic/AppConfig/AppPaths.cs` — `Contributions`.
- Create `Coffer.BusinessLogic/Contribution/ContributionRules.cs` (constants, reasons, winner rule), `ContributionLifecycle.cs`, `ContributionAdminService.cs`, `ContributionService.cs` (app side), `ContributionStorage.cs`, `ContributionDtos.cs`, `ContributionSweep.cs`.
- Create `Coffer.ASPNET/Controllers/Manager/ContributionAdminController.cs`, `Coffer.ASPNET/Controllers/ContributionController.cs`.
- Modify `Coffer.Infrastructure/ModerationRegistration.cs` (DI), `Coffer.BusinessLogic/Activity/ActivityLog.cs` (kinds), `Coffer.BusinessLogic/Account/AccountDeletionService.cs`.
- Modify `src/docker-compose.dev.yml`, `src/docker-compose.prod.yml`, `README.md`.
- Tests: `Coffer.Tests/Images/UploadedImagesTests.cs`, `Coffer.Tests/Contribution/ContributionAdminTests.cs`, `ContributionVoteTests.cs`, `ContributionUploadTests.cs`, `ContributionMiscTests.cs`.

Manager (`src/Coffer/Coffer.Manager/`)
- Create `contribution/__init__.py`, `contribution/logic.py` (pure helpers), `contribution/view.py`, `contribution/test_contribution.py`.
- Modify `reports/api.py` (client methods), `initialize.py` (`VIEWS`).

App (`src/Coffer/Coffer.ReactNative/src/`)
- Modify `utils/resize_photo.ts`, `const/image_resize_config.ts`, `components/market/listing_form/listing_form_overlay.tsx`, `components/market/deal/shipping_overlays.tsx`.
- Create `types/entities/contribution.ts`, `utils/contribution_api.ts`, `utils/contribution_format.ts`, `hooks/contribution.ts`.
- Replace `app/community/shape.tsx`; create `app/community/shape-detection.tsx`, `app/community/shape-classification.tsx`.
- Create `components/community/contribution/` — `countdown_card.tsx`, `vote_panel.tsx`, `photo_phase_panel.tsx`, `off_panel.tsx`, `latest_result_card.tsx`, `guidelines.tsx`, `example_gallery.tsx`, `photo_grid.tsx`.
- Modify `const/endpoints.ts`, `types/entities/activity.ts`, `utils/activity_format.ts`, `utils/open_activity.ts`, locales `en|hu/community.json`, `en|hu/activity.json`, `en|hu/errors.json`.
- Tests: `tests/contribution_format.test.ts`, extend `tests/activity_format.test.ts`.

---

### Task 1: Upload safety net for every photo path

**Files:**
- Create: `Coffer.BusinessLogic/Images/UploadedImages.cs`
- Modify: `Services/ImageService.cs:173` (`SaveImageAsync(IFormFile…)`), `Services.Interfaces/IImageService.cs`, `Marketplace/Listings/ListingService.cs:403`, `Marketplace/Deals/DealService.cs:456`, `Pending/PendingItemService.cs:276`, `Coffer.ASPNET/Controllers/CollectionsController.cs:120`
- Test: `Coffer.Tests/Images/UploadedImagesTests.cs`

**Interfaces:**
- Produces:
  - `public static class UploadWidths { public const int Small = 800; public const int Large = 1600; }`
  - `public sealed record PreparedImage(byte[] Bytes, string Extension, string ContentType);` (`.jpg`/`image/jpeg` or `.png`/`image/png`)
  - `public static Task<PreparedImage> UploadedImages.PrepareAsync(IFormFile file, int maxWidth, int quality = 85)`
  - `IImageService.SaveImageAsync(IFormFile file, Guid id, string destinationFolder, int maxWidth)` (replaces the 3-arg overload)

- [ ] **Step 1: Write the failing tests** (`[Collection("api")]` not needed — pure unit tests; build images with ImageSharp; reuse `ItemTypeFilesTests.Jpeg(w, h)` for plain JPEGs and a local `JpegWithGps(w, h)` that sets `image.Metadata.ExifProfile` with `ExifTag.GPSLatitude`)

```csharp
[Fact] public async Task AppSizedPhotoIsStoredByteForByte()
{   var bytes = ItemTypeFilesTests.Jpeg(800, 600);
    var p = await UploadedImages.PrepareAsync(FormFile(bytes, "a.jpg", "image/jpeg"), UploadWidths.Small);
    Assert.Equal(bytes, p.Bytes); Assert.Equal(".jpg", p.Extension); }

[Fact] public async Task WiderPhotoIsResizedToTheWidth()
{   var p = await UploadedImages.PrepareAsync(FormFile(ItemTypeFilesTests.Jpeg(3000, 2000), "a.jpg", "image/jpeg"), UploadWidths.Small);
    using var img = Image.Load(p.Bytes); Assert.Equal(800, img.Width); Assert.Equal(533, img.Height); }

[Fact] public async Task SmallPhotoWithGpsIsReencodedWithoutMetadata()
{   var p = await UploadedImages.PrepareAsync(FormFile(JpegWithGps(400, 300), "a.jpg", "image/jpeg"), UploadWidths.Small);
    using var img = Image.Load(p.Bytes); Assert.Null(img.Metadata.ExifProfile); Assert.Equal(400, img.Width); }

[Fact] public async Task NarrowPhotoIsNeverUpscaled() { /* 200×100 → 200 wide */ }

[Fact] public async Task NotAnImageIsRefused()
{   var e = await Assert.ThrowsAsync<MarketplaceException>(() => UploadedImages.PrepareAsync(FormFile(new byte[] {1,2,3,4,5,6,7,8}, "a.jpg", "image/jpeg"), 800));
    Assert.Equal("theUploadedFileIsNotAValid", e.Code); }
```
Plus one API-level test per path proving it is wired: `ListingPhotoWiderThan1600IsResized` (create a listing with a
3000 px JPEG through `api/Listings`, load the stored file from the listing image folder, width 1600) and
`CoverPhotoWiderThan800IsResized` (`api/Collections/CoverImage/Upload/{id}`, stored width 800). Follow the existing
listing / collection API tests for seeding.

- [ ] **Step 2: Run them and see them fail**

Run: `dotnet test Coffer.Tests/Coffer.Tests.csproj --filter "FullyQualifiedName~UploadedImages|ListingPhotoWiderThan1600|CoverPhotoWiderThan800"`
Expected: FAIL — `UploadedImages` does not exist.

- [ ] **Step 3: Implement `UploadedImages.PrepareAsync`**

`ImageUploadGuard.Validate(file)` first (8 MB, JPEG/PNG, magic bytes). Then `Image.IdentifyAsync` on the stream for
width and metadata (`ExifProfile`, `XmpProfile`, `IptcProfile` non-null = has metadata). Width ≤ `maxWidth` and no
metadata → return the original bytes. Otherwise `Image.LoadAsync`, `Mutate(x => x.AutoOrient())`, resize to
`maxWidth` wide when wider (`ResizeMode.Max`, height 0 = keep aspect ratio), set the three profiles to null, save as
JPEG with `quality` (PNG stays PNG only when it has an alpha channel, as `NewsImages` does today).

- [ ] **Step 4: Wire every path**

`ImageService.SaveImageAsync(IFormFile, Guid, string, int maxWidth)` keeps its existing checks and naming, calls
`PrepareAsync`, writes `prepared.Bytes` with `prepared.Extension`. Callers: covers `UploadWidths.Small`, listings and
deals `UploadWidths.Large`. `PendingItemService.CreateFromImageAsync` prepares with `UploadWidths.Small` and forwards
`prepared.Bytes` (as `ByteArrayContent` with `prepared.ContentType`) to the Python service instead of the raw stream.

- [ ] **Step 5: Run the tests — the new ones and the whole suite**

Run: `dotnet test Coffer.Tests/Coffer.Tests.csproj`
Expected: all PASS (existing listing / deal / cover / image-check tests unchanged).

- [ ] **Step 6: Commit**

```bash
git add -A src/Coffer/Coffer.BusinessLogic src/Coffer/Coffer.ASPNET src/Coffer/Coffer.Tests
git commit -m "feat(images): server resizes only photos bigger than the app sends and strips their metadata, on every upload path"
```

---

### Task 2: Phone resize for listing and shipping photos

**Files:**
- Modify: `src/const/image_resize_config.ts`, `src/utils/resize_photo.ts`, `src/components/market/listing_form/listing_form_overlay.tsx:113-128`, `src/components/market/deal/shipping_overlays.tsx:18-27`

**Interfaces:**
- Produces: `export const listingImageResize = { width: 1600, compress: 0.8 };` and
  `resizeForUpload(asset: ImagePickerAsset, config: { width: number; compress: number } = highImageResize): Promise<ImagePickerAsset>`

- [ ] **Step 1: Add the config and the parameter** (default keeps today's behaviour for item photos).
- [ ] **Step 2: Use it** — in `addImages` map every picked asset through `resizeForUpload(a, listingImageResize)` before
  `setNewImages` (show the existing picker loading state while it runs); same in `PhotoPicker.pick` of
  `shipping_overlays.tsx`. Drop the now-pointless `quality: 0.6` picker option in both.
- [ ] **Step 3: Verify**

Run (in `Coffer.ReactNative`): `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: no errors; tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/Coffer/Coffer.ReactNative/src
git commit -m "feat(app): listing and shipping photos are resized on the phone (1600 px wide) before upload"
```

---

### Task 3: Contribution data, phases and the switch (admin side)

**Files:**
- Create: `Coffer.Domain/Entities/Contribution.cs`, `src/startup/contribution_migration.sql`,
  `Coffer.BusinessLogic/Contribution/{ContributionRules,ContributionLifecycle,ContributionAdminService,ContributionDtos,ContributionSweep}.cs`,
  `Coffer.ASPNET/Controllers/Manager/ContributionAdminController.cs`
- Modify: `Coffer.DataAccess/CofferDbContext.cs`, `Coffer.BusinessLogic/AppConfig/AppPaths.cs`, `Coffer.Infrastructure/ModerationRegistration.cs`
- Test: `Coffer.Tests/Contribution/ContributionAdminTests.cs`

**Interfaces:**
- Produces (entities, `Coffer.Domain.Entities`):
  - `enum ContributionPhaseKind { Vote, Photo }`, `enum ContributionPhaseState { Draft, Open, Closed, Interrupted }`, `enum ContributionUploadKind { Detection, Classification }` — stored lowercase strings (`vote`, `open`, `detection`, …) like `NewsStatus`.
  - `ContributionSettings { int Id = 1; bool Enabled; string? Reason; Guid? ActivePhaseId; DateTime UpdatedAt; Guid? UpdatedBy; }`
  - `ContributionPhase { Guid Id; Kind; State; DateTime? OpenedAt; DateTime? EndsAt; DateTime? ClosedAt; Guid? SourcePhaseId; Guid? WinnerCandidateId; DateTime CreatedAt; Guid CreatedBy; DateTime UpdatedAt; Guid UpdatedBy; List<ContributionCandidate> Candidates; }`
  - `ContributionCandidate { Guid Id; Guid PhaseId; int Position; string Name; Dictionary<string,string> NameTranslations; string Description; Dictionary<string,string> DescriptionTranslations; }` (the app DTO in Task 4 carries the `[TranslatedBy]` markers, as `CollectionTypeProvided` does)
  - `ContributionVote { Guid PhaseId; Guid UserId; Guid CandidateId; string Text; DateTime CreatedAt; DateTime UpdatedAt; }` (PK both ids)
  - `ContributionForm { Guid Id; Guid PhaseId; Guid UserId; int PhotoCount; DateTime CreatedAt; }`
  - `ContributionUpload { Guid Id; Guid PhaseId; Guid UserId; ContributionUploadKind Kind; Guid? FormId; string FileName; DateTime CreatedAt; }`
- Produces (`Coffer.BusinessLogic.Contribution`):
  - `ContributionRules` constants from Global Constraints (`CandidateCount`, `NameMax`, `DescriptionMax`, `TextMin`, `TextMax`, `PerUpload`, `FormMin`, `FormMax`, `DailyLimit`, `DailyLeftShownBelow`, `MinLead`), `Reasons` (the four keys, `IsValid(string?)`), and `static Guid? DecideWinner(IReadOnlyDictionary<Guid,int> votesByCandidate)` → the single leader with > 0 votes, else null.
  - `IContributionLifecycle.SettleAsync(): Task` — closes every open phase with `EndsAt <= now` (winner via `DecideWinner` for votes, `ClosedAt = EndsAt`), and if it was the active phase sets `Enabled = false, Reason = "justFinished"`. Idempotent (re-reads state inside the save; a concurrent close is a no-op).
  - `IContributionAdminService` with the routes below; DTOs `AdminSettingsDto(bool Enabled, string? Reason, Guid? ActivePhaseId)`, `SettingsInput(bool Enabled, string? Reason, Guid? ActivePhaseId)`, `PhaseInput(string Kind, DateTime? EndsAt, List<CandidateInput>? Candidates, Guid? SourcePhaseId)`, `CandidateInput(string Name, Dictionary<string,string>? NameTranslations, string? Description, Dictionary<string,string>? DescriptionTranslations)`, `AdminPhaseDto(Guid Id, string Kind, string State, bool Active, DateTime? OpenedAt, DateTime? EndsAt, DateTime? ClosedAt, Guid? SourcePhaseId, Guid? WinnerCandidateId, bool Tie, int UsedByPhotoPhases, List<AdminCandidateDto> Candidates, AdminCandidateDto? Subject, PhotoTotalsDto? Totals, string? Folder)`, `AdminCandidateDto(Guid Id, int Position, string Name, Dictionary<string,string> NameTranslations, string Description, Dictionary<string,string> DescriptionTranslations, int Votes, double Share)`, `PhotoTotalsDto(int DetectionPhotos, int Forms, int FormPhotos, int Contributors)`, `VoteTextDto(Guid CandidateId, string Text, DateTime UpdatedAt)`, `CloseInput(string? Reason)`, `WinnerInput(Guid CandidateId)`.
  - `AppPaths.Contributions => Path.Combine(Root, "data", "contributions")`.
- Admin routes (`[Route("api/Admin/Contribution")]`, `ManagerControllerBase`): `GET/PUT Settings`, `GET Phases?kind&state`, `GET Phases/{id}`, `GET Phases/{id}/Texts?candidateId&page` (50/page, `PagedList<VoteTextDto>`), `POST Phases`, `PUT Phases/{id}`, `POST Phases/{id}/Close`, `POST Phases/{id}/Interrupt`, `POST Phases/{id}/Winner`, `DELETE Phases/{id}`. Every admin call starts with `SettleAsync()`.

- [ ] **Step 1: Write the failing tests** (API tests in the style of `NewsTests`: `ApiFactory`, `ManagerAdminConfig`, a `FakeClock` registered as `IClock` through `_api.Overrides`)

```csharp
[Fact] public async Task EnablingWithADraftOpensIt()          // PUT Settings {enabled:true, activePhaseId:draft} → phase state "open", openedAt = clock
[Fact] public async Task EnablingNeedsAnEndDateAtLeast5MinutesAhead()   // endsAt = now+4min → 400 "contributionEndTooSoon"
[Fact] public async Task EnablingAClosedPhaseIsRefused()       // → 400 "contributionPhaseNotOpenable"
[Fact] public async Task OnlyOneOpenPhase()                     // A open (paused); enable with draft B → 400 "contributionOtherPhaseOpen"
[Fact] public async Task DisablingPausesTheOpenPhase()          // PUT {enabled:false, reason:"modelsInProgress"} → phase still "open", Active=false
[Fact] public async Task DisablingNeedsAReason()                // reason null or "nope" → 400 "contributionReasonRequired"
[Fact] public async Task VotePhaseNeedsExactlyThreeCandidates() // 2 → 400 "contributionCandidateCount"
[Fact] public async Task CandidatesLockedOnceOpen()             // PUT Phases/{open} with candidates → 400 "contributionPhaseLocked"; endsAt alone → OK
[Fact] public async Task PassingTheEndDateClosesAndSwitchesOff()// clock past EndsAt → GET Settings: enabled false, reason "justFinished"; phase "closed", ClosedAt == EndsAt
[Fact] public async Task ClearLeaderWins()                      // votes 3/1/0 → winnerCandidateId = first
[Fact] public async Task TieLeavesNoWinnerAndPickWinnerAcceptsOnlyTiedCandidates() // 2/2/0 → tie=true; Winner(third) → 400 "contributionNotTied"; Winner(first) → OK
[Fact] public async Task NoVotesLetsTheAdminPickAnyCandidate()  // 0/0/0 → no winner, tie=false; Winner(third) → OK
[Fact] public async Task StoredWinnerNeverChanges()             // Winner on a phase with a winner → 400 "contributionWinnerSet"
[Fact] public async Task PhotoPhaseNeedsClosedVoteWithWinner()  // source open / tie / interrupted → 400 "contributionSourceNoWinner"
[Fact] public async Task UsedByPhotoPhasesIsCounted()           // two photo phases from one vote → UsedByPhotoPhases == 2
[Fact] public async Task InterruptActivePhaseNeedsReason()      // Interrupt {reason:null} → 400; {reason:"communityTooSmall"} → interrupted, switch off with that reason
[Fact] public async Task OnlyDraftsCanBeDeleted()
[Fact] public async Task SettleTwiceIsIdempotent()              // two SettleAsync after the end → one close, one audit entry
[Fact] public async Task AdminRoutesRefuseAppTokens()           // app user token → 401/403 on every route
[Fact] public async Task ChangesAreAudited()                    // admin audit has contribution.create / .settings / .close
```

- [ ] **Step 2: Run them and see them fail**

Run: `dotnet test Coffer.Tests/Coffer.Tests.csproj --filter "FullyQualifiedName~ContributionAdminTests"`
Expected: FAIL — types and routes missing.

- [ ] **Step 3: Entities, mapping, migration**

Mapping in `CofferDbContext` like `NewsPost` (lowercase string conversions, `Translations<ContributionCandidate>` for both
dictionaries, composite key for votes). Indexes from the spec; at most one open phase = unique partial index
`ON contribution_phases ((true)) WHERE state = 'open'` in the SQL (EF: `HasIndex(p => p.State).HasFilter("state = 'open'").IsUnique()` — SQLite accepts it). Migration creates the six tables, the indexes, and seeds `contribution_settings (1, false, 'communityTooSmall', NULL, now(), NULL)`; seed the same row in `OnModelCreating` via `HasData` only if other singleton seeds do so, otherwise `ContributionLifecycle` creates it on first read.

- [ ] **Step 4: Rules, lifecycle, admin service, controller, DI, sweep**

`ContributionSweep : IMarketplaceSweep` calls `SettleAsync`. Register services in `ModerationRegistration.cs` beside
News. Translations validated with `Translations.Validate(dict, ContributionRules.NameMax)` /
`DescriptionMax`. Switch rules exactly as the spec's "States and the switch".

- [ ] **Step 5: Run the tests**

Run: `dotnet test Coffer.Tests/Coffer.Tests.csproj --filter "FullyQualifiedName~Contribution"`
Expected: PASS. Then the whole suite: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/startup src/Coffer/Coffer.Domain src/Coffer/Coffer.DataAccess src/Coffer/Coffer.BusinessLogic src/Coffer/Coffer.ASPNET src/Coffer/Coffer.Infrastructure src/Coffer/Coffer.Tests
git commit -m "feat(contribution): phases, switch and admin API (states, pause, winner, sweep)"
```

---

### Task 4: App state and voting (with activity)

**Files:**
- Create: `Coffer.BusinessLogic/Contribution/ContributionService.cs`, `Coffer.ASPNET/Controllers/ContributionController.cs`
- Modify: `Coffer.BusinessLogic/Contribution/ContributionDtos.cs`, `Coffer.BusinessLogic/Activity/ActivityLog.cs:15-31`
- Test: `Coffer.Tests/Contribution/ContributionVoteTests.cs`

**Interfaces:**
- Consumes: Task 3 entities, `IContributionLifecycle.SettleAsync()`, `ContributionRules`.
- Produces:
  - `GET api/Contribution` → `ContributionStateDto(DateTime ServerNow, bool Enabled, string? Reason, PhaseViewDto? Phase, LatestResultDto? LatestResult)`;
    `PhaseViewDto(Guid Id, string Kind, DateTime OpenedAt, DateTime EndsAt, List<CandidateViewDto>? Candidates, MyVoteDto? MyVote, CandidateViewDto? Subject, MineDto? Mine, LimitsDto? Limits)`;
    `CandidateViewDto(Guid Id, [TranslatedBy(nameof(NameTranslations))] string Name, [TranslatedBy(nameof(DescriptionTranslations))] string Description, Dictionary<string,string> NameTranslations, Dictionary<string,string> DescriptionTranslations)` (serialized by `LocalizedJson` like collection types); `MyVoteDto(Guid CandidateId, string Text)`;
    `MineDto(int DetectionPhotos, int ClassificationForms)`; `LimitsDto(int PerUpload, int FormMin, int FormMax, int DailyLeft, DateTime DailyResetsAt)`;
    `LatestResultDto(Guid PhaseId, Guid WinnerCandidateId, List<ResultRowDto> Rows)`; `ResultRowDto(Guid CandidateId, string Name, int Votes, double Share)`.
    `Phase` is null when disabled or paused.
  - `PUT api/Contribution/Vote` body `VoteInput(Guid PhaseId, Guid CandidateId, string? Text)` → `MyVoteDto`.
  - Activity kinds `contribution.voted`, `contribution.voteChanged`, `contribution.photosUploaded`, `contribution.formCompleted` → category `"contribution"` (append to `Categories`).
  - `IContributionGuard.RequireActiveAsync(Guid phaseId, ContributionPhaseKind kind): Task<ContributionPhase>` — settle, then: enabled, active, open, `EndsAt > now`, kind matches; else 409/400 `contributionClosed` / `contributionWrongPhase`. Used by Task 5 too.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public async Task DisabledShowsReasonAndNoPhase()     // enabled false → reason "communityTooSmall", phase null
[Fact] public async Task PausedPhaseIsHidden()               // open phase, switch off → phase null
[Fact] public async Task OpenVotePhaseShowsCandidatesNotCounts() // no "votes"/"share" properties in the candidates JSON
[Fact] public async Task CandidateNamesFollowTheRequestLanguage() // Accept-Language hu → "Bélyeg"
[Fact] public async Task VoteIsStoredAndCanBeChanged()       // second PUT changes candidate + text; one row
[Fact] public async Task VoteTextLengthIsChecked()           // 9 chars and 1001 chars → 400 "contributionVoteText"
[Fact] public async Task VoteForAnotherPhasesCandidateIsRefused() // 400 "contributionUnknownCandidate"
[Fact] public async Task VoteAtEndTimeIsRefused()            // clock == EndsAt → 409 "contributionClosed"
[Fact] public async Task VoteWhilePausedIsRefused()          // → 409 "contributionClosed"
[Fact] public async Task VoteRecordsActivity()               // first → "contribution.voted" {candidate}; change → "contribution.voteChanged" {candidate, previousCandidate}
[Fact] public async Task LatestResultShowsWinnerAndShares()  // after close: rows with votes and shares summing to 1
[Fact] public async Task ContributionsCountAsActiveButNotForCollectorOfTheWeek()
    // user A: 5 contribution.* entries this week, user B: 1 like → GET api/Community/Stats: topCollector == B,
    // activeUsers milestone progress == 2 (put this test in Coffer.Tests/Community beside the existing stats tests)
```

- [ ] **Step 2: Run and see them fail** — `dotnet test … --filter "FullyQualifiedName~ContributionVoteTests"` → FAIL.
- [ ] **Step 3: Implement** `ContributionService` (app side) and `ContributionController : MarketplaceControllerBase`
  (`[Route("api/Contribution")]`). Activity is recorded with `IActivityLog.Record` before the vote's `SaveChanges`.
  `DailyResetsAt` = next UTC midnight; `DailyLeft` = 300 − today's uploads of the user.
  In `Community/Stats/CommunityStatsService.cs:146` the collector-of-the-week query skips kinds starting with
  `"contribution."` (active users keep counting them). The stats cache is 5 minutes — tests build a fresh factory.
- [ ] **Step 4: Run the tests** — `--filter "FullyQualifiedName~Contribution"` PASS, then the full suite PASS (the
  activity kind tests enumerate `ActivityKinds`; add the new kinds wherever those tests list expected kinds).
- [ ] **Step 5: Commit** — `git commit -m "feat(contribution): app state and voting, recorded as activity"`

---

### Task 5: Photo uploads (detection and classification forms)

**Files:**
- Create: `Coffer.BusinessLogic/Contribution/ContributionStorage.cs`
- Modify: `ContributionService.cs`, `ContributionController.cs`
- Test: `Coffer.Tests/Contribution/ContributionUploadTests.cs`

**Interfaces:**
- Consumes: `IContributionGuard.RequireActiveAsync`, `UploadedImages.PrepareAsync(file, UploadWidths.Small, quality: 90)`.
- Produces:
  - `ContributionStorage`: `PhaseDir(Guid phaseId)`, `DetectionDir(Guid phaseId)`, `FormDir(Guid phaseId, Guid formId)`, `ExamplesDir(string form)` (`"detection"` / `"classification"`), `TempDir()` (`contributions/.tmp/{guid}`).
  - `POST api/Contribution/Detection` (multipart `phaseId`, `images`) → `MineDto`; `POST api/Contribution/Classification` (same) → `MineDto`. `[RequestSizeLimit(40 * 1024 * 1024)]` + matching `RequestFormLimits`.
  - Errors: `contributionPhotoCount` (detection 0 or > 20), `formPhotoCount` (< 5 or > 10), `contributionDailyLimit` (with the reset time as `ErrorArgs`).

- [ ] **Step 1: Write the failing tests** (`TestEnvironment.Root/data/contributions` is the store)

```csharp
[Fact] public async Task DetectionPhotosLandInThePhasePool()      // 3 photos → 3 files in {phase}/detection, 3 rows, mine.detectionPhotos == 3
[Fact] public async Task DetectionNeeds1To20Photos()             // 0 and 21 → 400 "contributionPhotoCount"
[Fact] public async Task FormNeeds5To10Photos()                  // 4 and 11 → 400 "formPhotoCount"
[Fact] public async Task FormLandsInItsOwnFolder()               // 6 photos → {phase}/classification/{formId}/ has 6 files; mine.classificationForms == 1
[Fact] public async Task BadPhotoInFormStoresNothing()           // 6 good + 1 text file → 400; no rows, no form folder, .tmp empty
[Fact] public async Task DailyLimitCountsBothKinds()             // 295 seeded rows today + 6-photo form → 400 "contributionDailyLimit"; next UTC day → OK
[Fact] public async Task UploadToVotePhaseIsRefused()            // → 400 "contributionWrongPhase"
[Fact] public async Task UploadAfterEndIsRefused()               // clock == EndsAt → 409 "contributionClosed", no files
[Fact] public async Task StoredPhotosAreWidthCappedAndClean()    // 2000 px JPEG with GPS → stored 800 wide, no EXIF
[Fact] public async Task UploadsRecordOneActivityEach()          // detection of 3 → one "contribution.photosUploaded" {count:3}; form of 6 → one "contribution.formCompleted" {count:6}
```

- [ ] **Step 2: Run and see them fail** — FAIL.
- [ ] **Step 3: Implement.** Order for both kinds: guard → count / daily-limit checks → prepare every file into
  memory (any failure throws before anything is written) → write to `TempDir()` → DB rows + activity in one
  `SaveChanges` → move the temp folder's files into place (`Directory.Move` for a form folder; per-file `File.Move` into
  `detection/`) → on any exception delete the temp folder and rethrow. File names `{uploadId}.jpg`.
- [ ] **Step 4: Run the tests** — `--filter "FullyQualifiedName~Contribution"` PASS; full suite PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(contribution): detection uploads and classification forms in the trainer's folder layout"`

---

### Task 6: Example gallery, account deletion, storage mounts, docs

**Files:**
- Modify: `ContributionService.cs`, `ContributionController.cs`, `Coffer.BusinessLogic/Account/AccountDeletionService.cs:79`, `src/docker-compose.dev.yml`, `src/docker-compose.prod.yml`, `README.md`
- Test: `Coffer.Tests/Contribution/ContributionMiscTests.cs`

**Interfaces:**
- Produces: `GET api/Contribution/Examples` → `ExamplesDto(List<string> Detection, List<string> Classification)`;
  `GET api/Contribution/Examples/{form}/{fileName}` → the file (`form` ∈ detection|classification, name
  `^[A-Za-z0-9._-]{1,100}\.(jpg|jpeg|png|webp)$`, `nosniff`, `Cache-Control: public, max-age=3600`, 404 otherwise).
  Folder listing cached 1 minute (`IMemoryCache`), sorted ordinal by file name.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public async Task ExamplesListsImagesInFileNameOrder()   // 02_b.jpg, 01_a.png, notes.txt → ["01_a.png","02_b.jpg"]
[Fact] public async Task ExampleFileNamesAreStrict()            // "../x.jpg", "a.exe" → 404
[Fact] public async Task MissingExamplesFolderGivesEmptyLists()
[Fact] public async Task DeletingAnAccountRemovesItsContributions() // votes, forms, uploads rows and files gone; other users' kept; closed phase keeps WinnerCandidateId
```

- [ ] **Step 2: Run and see them fail** — FAIL.
- [ ] **Step 3: Implement** the two routes and the deletion step (delete the user's upload files, form folders, then
  rows, inside the existing deletion flow).
- [ ] **Step 4: Mounts and README.** Dev: `- E:\Homework\Programming\AI\szakdolgozat\data\contributions:/app/data/contributions`
  under `api`. Prod: `- contributions_data:/app/data/contributions` under `api` and `contributions_data:` under
  `volumes`. README: a "Shape What's Next" section — folder layout, where to drop example images (dev path and
  `docker cp <files> <api container>:/app/data/contributions/examples/detection/`), copying a phase out
  (`docker cp <api container>:/app/data/contributions/<phaseId> .`), the migration file to run.
- [ ] **Step 5: Run the tests** — full suite PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat(contribution): example gallery, account deletion cleanup, storage mounts and README"`

---

### Task 7: Manager client and pure helpers

**Files:**
- Create: `Coffer.Manager/contribution/__init__.py`, `contribution/logic.py`, `contribution/test_contribution.py`
- Modify: `Coffer.Manager/reports/api.py` (`AdminApi`)

**Interfaces:**
- Produces (`AdminApi`): `contribution_settings()`, `set_contribution_settings(enabled, reason, active_phase_id)`,
  `contribution_phases(kind=None, state=None)`, `contribution_phase(phase_id)`,
  `contribution_texts(phase_id, candidate_id=None, page=1)`, `create_contribution_phase(body)`,
  `update_contribution_phase(phase_id, body)`, `close_contribution_phase(phase_id, reason=None)`,
  `interrupt_contribution_phase(phase_id, reason=None)`, `pick_contribution_winner(phase_id, candidate_id)`,
  `delete_contribution_phase(phase_id)` — paths exactly as Task 3.
- Produces (`contribution/logic.py`):
  - `REASONS = [("justFinished", "One just finished"), ("communityTooSmall", "Community not big enough yet"), ("contributionFinished", "Contribution finished"), ("modelsInProgress", "New models in the works")]`
  - `parse_local(text: str) -> datetime` (`YYYY-MM-DD HH:MM`, local → aware UTC; `ValueError` with a readable message)
  - `format_local(iso: str | None) -> str`
  - `phase_label(phase: dict) -> str` (vote: `"Vote: A / B / C"`; photo: `"Photos: <subject>"`)
  - `state_label(phase: dict) -> str` (`"open (paused)"` when open and not active)
  - `winner_sources(phases: list[dict]) -> list[dict]` (closed votes with a winner, newest `closedAt` first)
  - `most_recent_source_id(phases) -> str | None`
  - `phone_preview(settings: dict, phase: dict | None, now: datetime) -> str` (Off → `"No contribution period right now — <reason>"`; On → `"<d> d <hh>:<mm> left — <label>"`)

- [ ] **Step 1: Write the failing tests** (`FakeSession` / `FakeResponse` as in `news/test_news.py`)

```python
def test_parse_local_round_trips(self): self.assertEqual(format_local(parse_local("2026-12-10 20:00").isoformat()), "2026-12-10 20:00")
def test_parse_local_rejects_garbage(self): self.assertRaises(ValueError, parse_local, "10/12/2026")
def test_paused_label(self): self.assertEqual(state_label({"state": "open", "active": False}), "open (paused)")
def test_winner_sources_newest_first_and_skip_ties(self): ...  # closed+winner only; ordered by closedAt desc
def test_most_recent_source(self): ...
def test_phone_preview_off_and_on(self): ...
def test_close_sends_reason(self):  # AdminApi.close_contribution_phase("p", "justFinished") → POST .../Phases/p/Close json {"reason": "justFinished"}
def test_settings_put(self): ...
```

- [ ] **Step 2: Run and see them fail**

Run (in `Coffer.Manager`): `venv\Scripts\python.exe -m unittest contribution.test_contribution -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** `logic.py` and the client methods.
- [ ] **Step 4: Run** — same command → PASS; `venv\Scripts\python.exe -m unittest discover -v` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(manager): contribution admin client and helpers"`

---

### Task 8: Manager Contribution tab

**Files:**
- Create: `Coffer.Manager/contribution/view.py`
- Modify: `Coffer.Manager/initialize.py:9-17` (`("Contribution", ContributionView)` after `News`)

**Interfaces:**
- Consumes: Task 7 client and helpers; `_AdminView` base as used by `news/view.py`.
- Produces: `class ContributionView(_AdminView)` with `refresh()` and `can_leave()` (unsaved draft edits guard).

- [ ] **Step 1: Build the view** following the spec's layout: switch panel (On/Off radio, active phase combobox of
  drafts + open phases, reason combobox shown when Off, phone preview line, Save); phase list (`ttk.Treeview`:
  kind, label, state, ends, totals; ★ on `most_recent_source_id`; filters); detail panel per kind — vote draft:
  three candidate rows (name, description, two JSON boxes with the item-types placeholder behaviour from
  `itemtypes/translations.py`), end date entry + "+1 day" / "+7 days"; vote open/closed/interrupted: candidate bars
  (Canvas), votes, %, tie banner with "Pick winner", texts list with candidate filter and paging; photo: source picker
  (only `winner_sources`, most recent preselected and marked, "used by N" suffix), end date, totals, folder path with a
  Copy button. Actions: Save, Close now, Interrupt… (confirmation; reason combobox when it is the active phase), Pick
  winner, Delete (drafts, confirmation). API errors shown in a message box with the server's message.
- [ ] **Step 2: Smoke test** — `venv\Scripts\python.exe -m unittest discover -v` PASS; `venv\Scripts\python.exe -c "import initialize"` exits 0.
- [ ] **Step 3: Manual check** against the dev API: create a vote draft, enable (opens), vote from the app or with a
  token, extend the end date, Close now, see counts and texts, create a photo phase (most recent preselected), pause,
  resume.
- [ ] **Step 4: Commit** — `git commit -m "feat(manager): Contribution tab — switch, phases, results, photo phases"`

---

### Task 9: App data layer, formatting and texts

**Files:**
- Create: `src/types/entities/contribution.ts`, `src/utils/contribution_api.ts`, `src/utils/contribution_format.ts`, `src/hooks/contribution.ts`, `tests/contribution_format.test.ts`
- Modify: `src/const/endpoints.ts` (`contribution: "api/Contribution"`), `src/i18n/locales/{en,hu}/community.json` (`shape.*`), `src/i18n/locales/{en,hu}/errors.json` (run `npm run gen:errors`, then Hungarian)

**Interfaces:**
- Produces:
  - Types mirroring Task 4/5/6 DTOs (`ContributionState`, `PhaseView`, `CandidateView`, `MyVote`, `Mine`, `Limits`, `LatestResult`, `Examples`).
  - `contributionApi = { state(), vote(input), uploadDetection(phaseId, assets), uploadClassification(phaseId, assets), examples(), exampleUrl(form, fileName) }` — multipart like `pendingApi.checkImage`, every asset passed through `resizeForUpload` (default 800 config) first, `timeout: 120000`.
  - Hooks: `useContribution()` (query key `["contribution", userId]`), `useVote()`, `useUploadDetection()`, `useUploadClassification()` (mutations invalidate `"contribution"`), `useContributionExamples()`.
  - `contribution_format.ts`: `clockOffset(serverNow: string, deviceNow: number): number`; `remaining(endsAt: string, offset: number, now: number): { days, hours, minutes, seconds, totalMs }` (never negative); `elapsedShare(openedAt, endsAt, offset, now): number` (0–1, clamped); `formState(count: number, min = 5, max = 10): "tooFew" | "ready" | "full"`; `shareLabel(share: number, lang: string): string` (`"41 %"` / `"41%"` per locale).
  - i18n keys under `community:shape`: `off.title`, `off.reasons.<four keys>` (spec texts), `latest.*`, `vote.*` (title, question, placeholder, send, edit, yourVote), `photo.title` ("Help us teach Coffer: {{subject}}"), `detection.*`, `classification.*`, `guidelines.detection.*`, `guidelines.classification.*` (spec texts, item wording, Hungarian in the same tone), `countdown.*` (`"{{d}} d"`, a11y label), `limits.*`, `discard.*`, `examples.*`.

- [ ] **Step 1: Write the failing tests**

```ts
test("countdownUsesServerOffset", () => {
  const off = clockOffset("2026-12-01T12:00:00Z", Date.parse("2026-12-01T12:05:00Z")); // phone 5 min fast
  const r = remaining("2026-12-01T13:00:00Z", off, Date.parse("2026-12-01T12:05:00Z"));
  assert.deepEqual([r.days, r.hours, r.minutes, r.seconds], [0, 1, 0, 0]);
});
test("countdownNeverNegative", () => { assert.equal(remaining("2026-12-01T12:00:00Z", 0, Date.parse("2026-12-02T00:00:00Z")).totalMs, 0); });
test("elapsedShareIsClamped", () => { /* before open → 0, halfway → 0.5, after end → 1 */ });
test("formStateRules", () => { assert.equal(formState(4), "tooFew"); assert.equal(formState(5), "ready"); assert.equal(formState(10), "full"); });
```

- [ ] **Step 2: Run and see them fail** — `npm run test:unit` → FAIL (module missing).
- [ ] **Step 3: Implement** the files above; add the texts; `npm run gen:errors` and translate the new backend codes in `hu/errors.json`.
- [ ] **Step 4: Verify** — `npm run test:unit && npm run check:i18n && npm run check:errors && npx tsc --noEmit` → all pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(app): contribution API, hooks, countdown helpers and texts"`

---

### Task 10: App — Shape What's Next hub (off, voting, photo phase)

**Files:**
- Replace: `src/app/community/shape.tsx`
- Create: `src/components/community/contribution/{countdown_card,off_panel,latest_result_card,vote_panel,photo_phase_panel}.tsx`

**Interfaces:**
- Consumes: Task 9 hooks and helpers.
- Produces: routes pushed from `photo_phase_panel`: `community/shape-detection`, `community/shape-classification`.

- [ ] **Step 1: Build** the hub as in the spec sketches: `Loading` / `ErrorState` with retry as in `stats.tsx`; pull to
  refresh; **Off** → icon, `off.title`, the reason, `LatestResultCard` (bars + "41 % · 52", winner marked with icon and
  text, not colour alone); **Vote** → `CountdownCard` (days + `hh:mm:ss` in tabular figures, ticking every second via
  one `setInterval`, progress bar with `accessibilityRole="progressbar"` and `accessibilityValue`, a single
  `accessibilityLabel` of the full remaining time, bar not animated when reduced motion is on; at zero → `refetch()`),
  radio list of candidates (48 dp rows, `accessibilityState.checked`), text box with counter `n/1000` and inline
  error below it, Send (loading state) → "Your vote" summary with Edit; **Photo** → `CountdownCard`, two cards with
  counts ("You uploaded N photos" / "You completed N forms"), Guidelines / Examples / Upload|New form buttons,
  "photos left today" line when `dailyLeft < 40`.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint && npm run check:i18n` pass; run on the device against the
  dev API in each state (off with each reason, vote open, voted, photo open, paused) in light and dark theme.
- [ ] **Step 3: Commit** — `git commit -m "feat(app): Shape What's Next hub — off reasons, voting with countdown, photo phase"`

---

### Task 11: App — detection and classification screens, example gallery

**Files:**
- Create: `src/app/community/shape-detection.tsx`, `src/app/community/shape-classification.tsx`, `src/components/community/contribution/{guidelines,example_gallery,photo_grid}.tsx`

**Interfaces:**
- Consumes: `pickImage` (`src/utils/data_access_utils.ts`), Task 9 hooks, `formState`.

- [ ] **Step 1: Build.** `Guidelines` — collapsible, open on first visit (remember per form in AsyncStorage), bold
  lead words. `ExampleGallery` — modal grid of `exampleUrl` images; tap → full-screen pager with close button and
  prev/next buttons (swipe optional, buttons required); hidden button when the list is empty. Detection — Camera /
  Gallery (`allowsMultipleSelection`, `selectionLimit` = remaining of 20), `PhotoGrid` with remove buttons, "Send N
  photos" with progress; success toast + count update; daily-limit error shows the reset time. Classification —
  `PhotoGrid` with 10 slots and "N of 5–10 photos", Complete enabled at `formState !== "tooFew"`, add buttons
  disabled at `"full"`; success → toast "Form completed" and a fresh form; leaving with photos (`beforeRemove`
  listener) → confirm "Discard this form?". Permission denied → the existing permission toast texts.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint && npm run check:i18n` pass; on the device: upload 3
  detection photos and a 6-photo form, check the files under `szakdolgozat\data\contributions\<phaseId>\`, open one
  and confirm 800 px wide and no GPS (`exiftool` or Windows Properties → Details).
- [ ] **Step 3: Commit** — `git commit -m "feat(app): detection uploads, classification forms and the example gallery"`

---

### Task 12: App — contributions in My activity

**Files:**
- Modify: `src/types/entities/activity.ts:2`, `src/utils/activity_format.ts`, `src/utils/open_activity.ts`, `src/i18n/locales/{en,hu}/activity.json`, `tests/activity_format.test.ts`

**Interfaces:**
- Consumes: backend kinds from Task 4 (details `{ phaseId, candidate, previousCandidate?, subject?, count? }`).

- [ ] **Step 1: Write the failing tests** — sentences for the four kinds in `en` ("You voted for Stamps", "You changed
  your vote to Stamps (was Coins)", "You uploaded 12 photos for Stamps", "You completed a 7-photo form for Stamps"),
  and `openActivity` for a contribution entry targets `community/shape`.
- [ ] **Step 2: Run and see them fail** — `npm run test:unit` → FAIL.
- [ ] **Step 3: Implement** — add `"contribution"` to `ACTIVITY_CATEGORIES`, category title "Shape What's Next" /
  "Alakítsd a jövőt" (match the tile's existing Hungarian title in `community.json`), sentences, routing.
- [ ] **Step 4: Verify** — `npm run test:unit && npm run check:i18n && npx tsc --noEmit` pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(app): contributions in My activity"`

---

### Task 13: End-to-end check

- [ ] **Step 1:** Backend full suite `dotnet test Coffer/Coffer.Tests/Coffer.Tests.csproj` (from `src`) → PASS.
- [ ] **Step 2:** Manager `venv\Scripts\python.exe -m unittest discover -v` → PASS.
- [ ] **Step 3:** App `npm run test:unit && npm run check:i18n && npm run check:errors && npm run lint && npx tsc --noEmit` → PASS.
- [ ] **Step 4:** Run `src/startup/contribution_migration.sql` on the dev database, restart the API, and walk one full
  round on the device: vote phase (enable → vote → extend → close by date → winner), photo phase from it (most
  recent preselected) → uploads → pause/resume → close; Stats & facts shows the contributor as active this week; My
  activity lists the entries.
- [ ] **Step 5:** Commit any fixes found, one commit per fix.
