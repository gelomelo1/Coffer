# Item Type Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Administrators manage item types, attributes, option sets, icons and AI models from Coffer.Manager, and publish / unpublish item types; unpublished types vanish from the app without anything being deleted.

**Architecture:** A new `Coffer.BusinessLogic/ItemTypes` area (admin services, translation validation, visibility guard, file store) behind `api/Admin/*` controllers on `ManagerControllerBase` (Manager token + admin re-check + `AdminAudit`). Hiding is explicit per read path ("type is published" via `collection_types.published`) plus a write guard, pinned by a route-sweep test over every API endpoint. Manager gets two Tkinter views and client methods; the app reads icons from a new endpoint.

**Tech Stack:** ASP.NET Core 8, EF Core (Npgsql / SQLite in tests), xUnit; SixLabors.ImageSharp (icon re-encode); Python 3 / Tkinter / requests / unittest (Manager); Expo app (icon URL, error texts).

**Spec:** `docs/superpowers/specs/2026-11-22-item-type-management-design.md`

## Global Constraints

- Every `api/Admin/*` controller derives from `ManagerControllerBase` (`[Authorize(Policy = ManagerTokens.Policy)]`); every change writes `AdminAudit.Add(db, adminId, action, targetType, targetId, details, now)` in the same save.
- Unpublished things answer **404** (never 403) on user endpoints; deals in progress and their chats keep working.
- Rule A: in-use things cannot be deleted or change meaning (see spec table); renames, translations, adding are always allowed. Option ids are never reused (`max + 1`).
- Translations: JSON object, keys `^[a-z]{2}$` except `en`, non-empty string values within the field limit; option label translations have exactly as many `;` parts as `option_labels`. Error code `invalidTranslations`.
- Limits: names 1–60, description ≤ 500, colour `^#[0-9A-Fa-f]{6}$`, option label 1–60 without `;`, ≤ 200 options per set, ≤ 30 attributes per type; icon ≤ 1 MB, ≤ 1024×1024, PNG/JPEG/WebP by magic bytes, re-encoded to PNG `{typeId}_{yyyyMMddHHmmss}.png`; model ≤ 300 MB, ZIP magic `PK\x03\x04`, `classCount` 2–100000.
- Files: icons in `ICONSTORE_PATH` (dev host `E:\Homework\Programming\AI\szakdolgozat\data\icons` → `/app/data/icons`); models in `MODELS_PATH` as `{id}_detection.pt`, `{id}_similarity_{classCount}.pt`. File names are always built from the type id, never taken from the client.
- Publish needs both model files, exactly one primary attribute and an icon (409 `itemTypeNeedsModels` / `itemTypeNeedsPrimaryAttribute` / `itemTypeNeedsIcon`).
- Rollout: Cap (id 1) published, Stamp (id 2) unpublished. Test helpers (`TestDb.AddCollectionType`, `AddCollection`) create **published** types so existing tests keep their meaning.
- Git: no branches, no pushes, no Co-authored-by trailers. Tests: `"/c/Program Files/dotnet/dotnet.exe" test src/Coffer/Coffer.Tests`; Manager `venv\Scripts\python.exe -m unittest discover -v` from `src/Coffer/Coffer.Manager`; app `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors`.

## Review Focus

1. **A hidden type leaking through a list that joins indirectly** (feed of followed collections, comment counts, tag stats, market badges, "my follows", activity log targets) — expected: nothing of the type appears. Covered by the route sweep (Task 6) with a seeded follow, comment, reaction and listing on the hidden type.
2. **Removing an option used only inside a Multi-select value** (`"1;4;"`, option 4) — expected: refused. Test `OptionUsedInsideMultiSelectValueCantBeRemoved` (Task 3).
3. **Unpublish while a deal is in progress** — expected: deal, chat, ship/confirm keep working; listing hidden from browse. Test `OpenDealKeepsWorkingWhenTypeIsHidden` (Task 6).
4. **Waiting items while hidden** — expected: not expired by the sweep, and their 30 days resume on republish. Tests `SweepSkipsHiddenTypes`, `RepublishShiftsWaitingClock` (Task 4).
5. **App token or former admin on any new admin route** — expected 401 / 403, never a change. Test `EveryItemTypeAdminRouteRejectsNonAdmins` (Task 2, extended in Tasks 3–4 to their routes).

---

### Task 1: Schema, translations, visibility guard

**Files:**
- Modify: `src/Coffer/Coffer.Domain/Entities/CollectionType.cs` (`Published`, `UnpublishedAt`, `DescriptionTranslations` [JsonIgnore]), `src/Coffer/Coffer.DataAccess/CofferDbContext.cs` (map them; `Translations<CollectionTypeProvided>(modelBuilder, t => t.DescriptionTranslations)`), `src/Coffer/Coffer.Tests/TestDb.cs` (helpers create `Published = true`)
- Create: `src/startup/item_type_management_migration.sql`, `src/Coffer/Coffer.BusinessLogic/ItemTypes/Translations.cs`, `src/Coffer/Coffer.DataAccess/Extensions/PublishedTypes.cs`, `src/Coffer/Coffer.BusinessLogic/ItemTypes/ItemTypeVisibility.cs`
- Test: `src/Coffer/Coffer.Tests/ItemTypes/TranslationsTests.cs`, `src/Coffer/Coffer.Tests/ItemTypes/ItemTypeVisibilityTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public static class Translations {
      // null / empty → empty dict; throws MarketplaceException.Validation("invalidTranslations", reason)
      public static Dictionary<string, string> Validate(Dictionary<string, string>? value, int maxLength, int? partCount = null);
  }
  public static class PublishedTypes {   // DataAccess, IQueryable filters joining collection_types.published
      public static IQueryable<CollectionProvided> WherePublished(this IQueryable<CollectionProvided> q, DbContext db);
      public static IQueryable<ItemProvided> WherePublished(this IQueryable<ItemProvided> q, DbContext db);
      public static IQueryable<Listing> WherePublished(this IQueryable<Listing> q, DbContext db);
  }
  public interface IItemTypeVisibility {   // scoped; each throws MarketplaceException.NotFound(...) when missing OR hidden
      Task EnsureTypeAsync(int typeId);          // code "itemTypeNotFound"
      Task EnsureCollectionAsync(Guid collectionId); // "collectionNotFound"
      Task EnsureItemAsync(Guid itemId);         // "itemNotFound"
      Task EnsureListingAsync(Guid listingId);   // "listingNotFound"
      Task<bool> IsPublishedAsync(int typeId);
  }
  ```
- Migration SQL: `ALTER TABLE collection_types ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS unpublished_at timestamptz NULL, ADD COLUMN IF NOT EXISTS description_translations jsonb NOT NULL DEFAULT '{}'; UPDATE collection_types SET published = true WHERE id = 1;` in a transaction, with the run command in the header comment like the other migrations.

- [ ] **Step 1: Failing tests** — `TranslationsTests`: `EmptyOrNullIsEmpty`, `AcceptsLanguageCodes` (`{"hu":"Kupak"}`), `RejectsEnglishKey`, `RejectsBadKey` (`"HU"`, `"hun"`), `RejectsEmptyOrTooLongValue`, `OptionLabelsMustMatchPartCount` (`{"hu":"A;B"}` with partCount 3 → invalid, `"A;;C"` → invalid). `ItemTypeVisibilityTests`: `HiddenTypeIsNotFound`, `CollectionOfHiddenTypeIsNotFound`, `ItemOfHiddenTypeIsNotFound`, `ListingOfHiddenTypeIsNotFound`, `PublishedPasses`, `WherePublishedDropsHiddenRows` (collections / items / listings).
- [ ] **Step 2: Run** `dotnet test --filter FullyQualifiedName~ItemTypes` → FAIL (types missing / assertions).
- [ ] **Step 3: Implement**; register `IItemTypeVisibility` in `ModerationRegistration.cs` (or a new `ItemTypeRegistration.cs` called from the same place).
- [ ] **Step 4: Run** the filter → PASS; full suite → PASS.
- [ ] **Step 5: Commit** `feat(api): item type publish flag, translations and visibility guard`

### Task 2: Admin API — item types and attributes

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/ItemTypes/ItemTypeAdminService.cs` (DTOs + service), `src/Coffer/Coffer.ASPNET/Controllers/Manager/ItemTypeAdminControllers.cs`
- Test: `src/Coffer/Coffer.Tests/ItemTypes/ItemTypeAdminTests.cs`

**Interfaces:**
- Consumes: `Translations.Validate`, `AdminAudit.Add`, `ManagerControllerBase.AdminId`.
- Produces:
  ```csharp
  public sealed record ItemTypeInput(string Name, Dictionary<string,string>? NameTranslations, string? Description,
      Dictionary<string,string>? DescriptionTranslations, string Color);
  public sealed record AttributeInput(string Name, Dictionary<string,string>? NameTranslations, AttributeType DataType,
      bool Primary, bool Required, int? OptionSetId);
  public sealed record AdminAttributeDto(int Id, string Name, Dictionary<string,string> NameTranslations, AttributeType DataType,
      bool Primary, bool Required, int? OptionSetId, int UsedByItems);
  public sealed record ModelFileDto(string FileName, long Bytes, DateTime UploadedAt, int? ClassCount);
  public sealed record AdminItemTypeDto(int Id, string Name, Dictionary<string,string> NameTranslations, string Description,
      Dictionary<string,string> DescriptionTranslations, string Color, string Icon, bool Published, DateTime? UnpublishedAt,
      ModelFileDto? Detection, ModelFileDto? Embedding, int Collections, int Listings, List<AdminAttributeDto> Attributes,
      List<string> PublishBlockers);   // e.g. ["itemTypeNeedsModels"]; empty = can publish
  public interface IItemTypeAdminService {
      Task<List<AdminItemTypeDto>> ListAsync();
      Task<AdminItemTypeDto> GetAsync(int id);
      Task<AdminItemTypeDto> CreateAsync(Guid adminId, ItemTypeInput input);
      Task<AdminItemTypeDto> UpdateAsync(Guid adminId, int id, ItemTypeInput input);
      Task DeleteAsync(Guid adminId, int id);
      Task<AdminAttributeDto> AddAttributeAsync(Guid adminId, int typeId, AttributeInput input);
      Task<AdminAttributeDto> UpdateAttributeAsync(Guid adminId, int attributeId, AttributeInput input);
      Task DeleteAttributeAsync(Guid adminId, int attributeId);
  }
  ```
  Model presence / publish blockers come from an `IItemTypeFiles` stub in this task (`Task 4` replaces it): `ModelFileDto? Detection(int id)`, `ModelFileDto? Embedding(int id)` reading `MODELS_PATH`.
- Routes: `GET/POST api/Admin/ItemTypes`, `GET/PUT/DELETE api/Admin/ItemTypes/{id:int}`, `POST api/Admin/ItemTypes/{id:int}/Attributes`, `PUT/DELETE api/Admin/Attributes/{id:int}`.
- Rules: create → `Published=false`, icon `""`; delete only when unpublished and no collection (incl. tombstoned) or listing uses it (409 `itemTypeInUse` with counts); attribute delete / data-type change / option-set change refused when `UsedByItems > 0` (409 `attributeInUse`); setting `Primary=true` clears `Primary` on the type's other attributes; Select / Multi_Select / Autocomplete need an existing option set, others must not have one (400 `optionSetRequired` / `optionSetNotAllowed`); names unique per type case-insensitive (409 `attributeNameTaken`); ≤ 30 attributes. Audit actions `itemType.create|update|delete`, `attribute.create|update|delete` with before/after details.

- [ ] **Step 1: Failing tests** — `CreateStartsUnpublished`, `UpdateChangesNamesAndTranslations`, `InvalidTranslationsAre400`, `InvalidColorIs400`, `DeleteUsedTypeIsRefused`, `DeleteUnusedUnpublishedType`, `AttributeInUseCantChangeTypeOrBeDeleted`, `RenamingAttributeInUseIsAllowed`, `SelectNeedsOptionSet`, `MakingPrimaryClearsTheOther`, `DuplicateAttributeNameIs409`, `ChangesAreAudited` (one `admin_audit_log` row per change with the admin id), `EveryItemTypeAdminRouteRejectsNonAdmins` (anonymous → 401; app user token, also one with `UserRole.Admin` → 401; former admin (not in the configured list) → 403; database unchanged).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (+ DI registration). **Step 4: Run** → PASS; full suite.
- [ ] **Step 5: Commit** `feat(api): admin item types and attributes`

### Task 3: Admin API — option sets

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/ItemTypes/OptionSetAdminService.cs`; add `AdminOptionSetsController` to `ItemTypeAdminControllers.cs`
- Test: `src/Coffer/Coffer.Tests/ItemTypes/OptionSetAdminTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public sealed record OptionInput(int? Id, string Label);   // Id null = new option
  public sealed record OptionSetInput(List<OptionInput> Options, Dictionary<string,string>? LabelTranslations);
  public sealed record AdminOptionDto(int Id, string Label, int UsedByItems);
  public sealed record AdminOptionSetDto(int Id, List<AdminOptionDto> Options, Dictionary<string,string> LabelTranslations,
      List<string> UsedBy);   // "Cap › Features"
  public interface IOptionSetAdminService {
      Task<List<AdminOptionSetDto>> ListAsync();
      Task<AdminOptionSetDto> CreateAsync(Guid adminId, OptionSetInput input);
      Task<AdminOptionSetDto> UpdateAsync(Guid adminId, int id, OptionSetInput input);
      Task DeleteAsync(Guid adminId, int id);
  }
  ```
- Routes: `GET/POST api/Admin/OptionSets`, `PUT/DELETE api/Admin/OptionSets/{id:int}`.
- Storage: `option_ids` / `option_labels` `;`-joined in input order; new ids `max(existing) + 1` (never reused, even after removal). Use count of an option: item values of attributes using the set whose `value_string` split on `;` contains the id (do the split in memory per set). Removing a used option → 409 `optionInUse`; deleting a set referenced by any attribute → 409 `optionSetInUse`; translations validated with `partCount = options.Count`. Audit `optionSet.create|update|delete`.

- [ ] **Step 1: Failing tests** — `CreateAssignsIds`, `AddOptionGetsNextId`, `RemovedIdIsNeverReused`, `RenameUsedOptionIsAllowed`, `OptionUsedBySelectValueCantBeRemoved`, `OptionUsedInsideMultiSelectValueCantBeRemoved` (`"1;4;"`), `LabelTranslationsMustMatchOptionCount`, `LabelWithSemicolonIs400`, `DeleteUsedSetIsRefused`, `ChangesAreAudited`; extend `EveryItemTypeAdminRouteRejectsNonAdmins` with these routes.
- [ ] **Step 2–4:** RED → implement → GREEN; full suite.
- [ ] **Step 5: Commit** `feat(api): admin option sets`

### Task 4: Icons, AI models, publishing

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/ItemTypes/ItemTypeFiles.cs` (real `IItemTypeFiles`), `src/Coffer/Coffer.BusinessLogic/ItemTypes/ItemTypePublishing.cs`
- Modify: `ItemTypeAdminControllers.cs` (Icon, Models, Publish routes), `CollectionTypesController.cs` (public `GET api/CollectionTypes/Icon/{fileName}`), `PendingItemService.cs` (`PendingExpirySweep` skips hidden types), `StartupExtension.cs` (`app.SeedItemTypeIcons()` copies `wwwroot/icons/*.png` into the store when missing), `Program.cs`, `Coffer.BusinessLogic.csproj` (SixLabors.ImageSharp, latest 3.1.x patch), `src/.env.development` + `.env.development.example` (`ICONSTORE_PATH=/app/data/icons`), `src/docker-compose.dev.yml` (api: `E:\Homework\Programming\AI\szakdolgozat\data\icons:/app/data/icons`), `src/docker-compose.prod.yml` (api: `icons_data:/app/data/icons`, `./models:/app/models`; volume `icons_data`), `src/Coffer/Coffer.Tests/TestEnvironment.cs` (temp `ICONSTORE_PATH`, `MODELS_PATH`)
- Test: `src/Coffer/Coffer.Tests/ItemTypes/ItemTypeFilesTests.cs`, `src/Coffer/Coffer.Tests/ItemTypes/PublishingTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public interface IItemTypeFiles {
      ModelFileDto? Detection(int typeId);
      ModelFileDto? Embedding(int typeId);            // classCount parsed from the file name
      Task<string> SaveIconAsync(int typeId, IFormFile file);   // returns new file name; old one deleted by caller after save
      Task<(ModelFileDto? Detection, ModelFileDto? Embedding, string? DetectionSha256, string? EmbeddingSha256)>
          SaveModelsAsync(int typeId, IFormFile? detection, IFormFile? embedding, int? classCount);
      (Stream Stream, string ContentType)? OpenIcon(string fileName);   // null when name invalid or missing
  }
  public interface IItemTypePublishing {
      Task<AdminItemTypeDto> SetPublishedAsync(Guid adminId, int typeId, bool published);
  }
  ```
- Routes: `POST api/Admin/ItemTypes/{id:int}/Icon` (multipart `file`, `[RequestSizeLimit(1_100_000)]`), `POST api/Admin/ItemTypes/{id:int}/Models` (multipart `detection`, `embedding`, `classCount`; `[RequestSizeLimit(620_000_000)]` + `RequestFormLimits`), `POST api/Admin/ItemTypes/{id:int}/Publish {published}`; public `GET api/CollectionTypes/Icon/{fileName}` (name regex `^([0-9]+_[0-9]{14}|[a-z0-9_-]{1,40})\.png$`, `image/png`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=86400`).
- Behaviour: icon re-encoded with ImageSharp (`Image.Load` with format detection limited to PNG/JPEG/WebP, size check, `SaveAsPng`); models streamed to `{name}.uploading` then `File.Move(overwrite)`, older `{id}_similarity_*` removed after the move; audit `itemType.icon` (old/new file), `itemType.models` (file names, sizes, SHA-256), `itemType.publish|unpublish`. Publish checks blockers (409 per missing piece). Unpublish sets `UnpublishedAt = now`; republish shifts `pending_items.created_at` of the type's collections by `now − UnpublishedAt` and clears `UnpublishedAt`.

- [ ] **Step 1: Failing tests** — files: `IconIsReencodedToPng` (a JPEG in → PNG out, new name pattern), `IconRejectsNonImage` (text file named .png), `IconRejectsTooLarge`, `IconNameIsValidatedOnRead` (`../x.png` → null), `ModelsAreStoredUnderTypeNames`, `ModelRejectsNonZip`, `ReplacingEmbeddingRemovesOldFile` (`3_similarity_10.pt` then `classCount 12` → only `3_similarity_12.pt`), `EmbeddingNeedsClassCount`. publishing: `PublishNeedsModelsPrimaryAndIcon` (each missing → its code), `PublishThenUnpublishFreely`, `UnpublishDeletesNothing`, `SweepSkipsHiddenTypes`, `RepublishShiftsWaitingClock`, `UploadsAndPublishAreAudited` (audit has SHA-256); API: `PublicIconEndpointServesStoredIcon`, extend `EveryItemTypeAdminRouteRejectsNonAdmins`.
- [ ] **Step 2–4:** RED → implement → GREEN; full suite.
- [ ] **Step 5: Commit** `feat(api): item type icons, AI model uploads and publishing`

### Task 5: Hide unpublished types — catalogue, collections, items, community, waiting list

**Files:**
- Modify (each read path adds `WherePublished` / a join on `published`; each write path calls `IItemTypeVisibility`): `CollectionTypesController` (+ repository: lists / by id only published), `AttributesRepository` (only attributes of published types), `CollectionsRepository` (generic lists via an override of the base query, grouped, search, by id, cover image), `ItemsRepository` (generic lists, page, feed, search, by id), `ItemTagsRepository`, `FollowsRepository` + `FollowsController`, `FeedController` paths (feed, tag stats, search users / collections / items, user follows), `ReactionsController`, `CommentsController` + `ItemCommentService` (list / post / edit / delete, counts, mentionable), `CollectionsController` (cover upload, image check, item tags, delete), `ItemsController` (PUT, Upsert, delete, cover image), `PendingItemService` (list, summary, image, add, delete) — reads of hidden → 404 / omitted, writes → 404.
- Test: `src/Coffer/Coffer.Tests/ItemTypes/HiddenTypeCommunityTests.cs`

**Interfaces:**
- Consumes: `PublishedTypes.WherePublished`, `IItemTypeVisibility`.

- [ ] **Step 1: Failing tests** (seed: published type P with a collection + item; hidden type H with owner's collection, item, follow by another user, reaction, comment, waiting item) — `CatalogueOmitsHiddenType` (`api/CollectionTypes`, `/{id}`, `api/Attributes?filter=…`), `OwnerCantSeeOrManageHiddenCollections` (grouped list, by id 404, PUT / DELETE 404, cover upload 404, image check 404), `ItemsOfHiddenTypeAreGone` (page, by id, PUT, Upsert, DELETE → 404), `FeedAndSearchOmitHiddenType`, `FollowsOmitAndRefuseHiddenType`, `ReactionsAndCommentsRefuseHiddenItems`, `WaitingListOmitsHiddenType` (summary, list, add / delete → 404), `PublishingAgainRestoresEverything`.
- [ ] **Step 2–4:** RED → implement → GREEN; full suite.
- [ ] **Step 5: Commit** `feat(api): unpublished item types disappear from collections, feed and community`

### Task 6: Hide unpublished types — marketplace, activity log, route sweep

**Files:**
- Modify: `ListingService` (search, mine, counts, get → 404, create / update / archive / reactivate → 404 / `itemTypeNotFound` for a hidden `CollectionTypeId`), `ListingConversationPolicy.EnsureCanStartAsync` (no new chat on hidden listing), `MarketController.Badges` (counts omit hidden), `ActivityQueryService` (targets in a hidden type → `available=false`); **not** `DealService`, `ConversationService` (existing chats), `ReviewService`, `ReportService` (decision 5)
- Create: `src/Coffer/Coffer.Tests/ItemTypes/RouteSweepTests.cs`, `src/Coffer/Coffer.Tests/ItemTypes/HiddenTypeMarketTests.cs`

**Interfaces:**
- Route sweep: enumerate `EndpointDataSource.Endpoints` (`RouteEndpoint.RoutePattern.RawText` + HTTP method) from `ApiFactory.Services`; three static sets in the test: `Checked` (each with a request built from the seeded hidden resources and the expected outcome: 404 or "absent from body"), `Exempt` (route → reason: deals, chats, reviews, reports, account, auth, dev login, health, cities, terms, activity list itself, Manager / admin, AI test endpoint), `NotTypeRelated`. Test `EveryRouteIsClassified` fails listing unclassified routes; `CheckedRoutesHideTheHiddenType` runs each checked request as the hidden collection's owner and as another user.

- [ ] **Step 1: Failing tests** — `BrowseAndMineOmitHiddenListings`, `HiddenListingDetailIs404`, `CantCreateOrEditListingOfHiddenType`, `NoNewChatOnHiddenListing`, `OpenDealKeepsWorkingWhenTypeIsHidden` (accept, ship, confirm receipt, chat messages, review), `ActivityEntriesOfHiddenTypeAreUnavailable`, `EveryRouteIsClassified`, `CheckedRoutesHideTheHiddenType`.
- [ ] **Step 2–4:** RED → implement → GREEN (fix whatever the sweep finds); full suite.
- [ ] **Step 5: Commit** `feat(api): unpublished item types disappear from the marketplace; route sweep`

### Task 7: App — icon endpoint and error texts

**Files:**
- Modify: `src/Coffer/Coffer.ReactNative/src/const/endpoints.ts` (`icons` → `${baseURL}/api/CollectionTypes/Icon`), every `endpoints.icons` use keeps working unchanged; run `node scripts/gen-backend-messages.mjs` and add hu texts for the new codes in `src/i18n/locales/hu/errors.json`
- Delete: `src/Coffer/Coffer.ASPNET/wwwroot/icons/` only after `SeedItemTypeIcons` (Task 4) is verified to copy them (Task 9) — keep it in this task.

- [ ] **Step 1:** change the endpoint; **Step 2:** regenerate error texts + hu; **Step 3: Run** `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors` → pass.
- [ ] **Step 4: Commit** `feat(app): item type icons from the icon store`

### Task 8: Manager — client, translations helper, Item types and Option sets views

**Files:**
- Modify: `src/Coffer/Coffer.Manager/reports/api.py` (`_request(..., files=None, data=None, timeout=None)`; item-type, attribute, option-set, icon, models, publish methods; uploads use a 600 s timeout), `src/Coffer/Coffer.Manager/initialize.py` (VIEWS: `("Item types", ItemTypesView)`, `("Option sets", OptionSetsView)`)
- Create: `src/Coffer/Coffer.Manager/itemtypes/__init__.py`, `itemtypes/translations.py`, `itemtypes/view.py`, `itemtypes/test_itemtypes.py`

**Interfaces:**
- `AdminApi`: `item_types()`, `item_type(id)`, `create_item_type(body)`, `update_item_type(id, body)`, `delete_item_type(id)`, `upload_icon(id, path)`, `upload_models(id, detection_path=None, embedding_path=None, class_count=None)`, `set_published(id, published)`, `add_attribute(type_id, body)`, `update_attribute(id, body)`, `delete_attribute(id)`, `option_sets()`, `create_option_set(body)`, `update_option_set(id, body)`, `delete_option_set(id)`, `icon(file_name)` (bytes, public endpoint).
- `itemtypes/translations.py` (pure):
  ```python
  def placeholder(field, labels=None) -> str     # field: "name" | "description" | "options"
      # name → '{"hu": "Kupak"}'; description → '{"hu": "Rövid leírás"}';
      # options → '{"hu": "' + ";".join(f"Opció {i+1}" for i in range(len(labels))) + '"}'
  def to_text(translations: dict) -> str         # '' for {} (box then shows the placeholder), else pretty JSON
  def parse(text: str, part_count=None) -> dict  # '' / placeholder → {}; raises ValueError(reason) mirroring the backend rules
  ```
- Views (Tkinter, `_AdminView` pattern): **ItemTypesView** — left `Treeview` (name, published, models, collections); right form: name, colour (+ swatch, `colorchooser`), description, two JSON `Text` boxes with grey placeholder (placeholder inserted with a `placeholder` tag in grey; cleared on focus-in when tagged; on save a box whose content is the placeholder saves `{}`; parse errors shown in a red label under the box), icon preview (PIL) + "Upload icon…" (`filedialog`), models line + "Upload models…" (dialog: detection file, embedding file, class count, and the warning "A model file can run code on the AI server: upload only models you trained yourself."), Publish checkbox with blockers text (disabled while blockers exist), attributes `Treeview` (name, type, primary, required, option set, used by) with Add / Edit / Delete (Delete disabled when used; dialog with name, JSON box, data type, primary, required, option set combobox), Save, New item type, Delete item type (only unused + unpublished). **OptionSetsView** — sets list (id, options, used by); editor rows (id, label, used by), Add option, Remove (disabled when used), label translations JSON box with options placeholder, Save, New set, Delete (disabled when used). All errors via `self.call` (shows the backend message).

- [ ] **Step 1: Failing tests** (`test_itemtypes.py`, no network / window): `test_placeholder_examples` (name / description / options with 3 labels → 3 parts), `test_empty_text_and_placeholder_parse_to_empty`, `test_parse_rejects_bad_json_and_keys` (`"en"`, `"HU"`, non-object), `test_parse_checks_option_part_count`, `test_to_text_roundtrip`, `test_upload_models_sends_multipart` (FakeSession sees `files` keys `detection` / `embedding`, `data` `classCount`, auth header, long timeout), `test_set_published_body`, `test_admin_errors_surface_message`.
- [ ] **Step 2: Run** `venv\Scripts\python.exe -m unittest discover -v` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (incl. the existing report tests).
- [ ] **Step 5: Commit** `feat(manager): item types and option sets`

### Task 9: Rollout check

- [ ] **Step 1:** create `E:\Homework\Programming\AI\szakdolgozat\data\icons`; apply `src/startup/item_type_management_migration.sql` to the dev db; `docker compose -f docker-compose.dev.yml up -d --force-recreate api` (new volume); confirm `cap.png` / `stamp.png` were copied into the icon store and `GET api/CollectionTypes/Icon/cap.png` answers 200.
- [ ] **Step 2:** emulator: Cap collections, items, feed and icons look as before; Stamp is gone from type pickers.
- [ ] **Step 3:** ask your human partner to start Coffer.Manager and sign in (GitHub device flow is theirs); walk through: open Cap, edit translations JSON, see placeholders on empty boxes, create a test type, see publish blocked, upload a test icon; delete the test type afterwards.
- [ ] **Step 4:** remove `src/Coffer/Coffer.ASPNET/wwwroot/icons/` once the store serves both icons; commit fixes found (failing test first where testable) and `chore: icons served from the icon store`.
