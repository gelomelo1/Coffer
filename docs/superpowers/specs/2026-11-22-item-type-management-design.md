# Item type management (Coffer.Manager) — design

## Intent

Administrators can manage, from Coffer.Manager, everything that defines a kind of collectible ("item type", the
`collection_types` table): its names, colour, icon, its attributes, and the option sets attributes pick from. They can
create new item types, upload the two AI models a type needs for "add from photo", and publish or unpublish a type.
Today this reference data can only be changed by hand in the database, and the icons are baked into the API image.

The endpoints are as well protected as the report-management endpoints: Manager token (GitHub device sign-in),
administrator re-checked on every request, every change in the admin audit log.

## Goals

- A new Manager tab **Item types**: list of types (published state, models present, how many collections use it) and
  a detail panel: English + Hungarian name, description, colour, icon (upload + preview), attributes, AI models,
  publish switch.
- A new Manager tab **Option sets**: the lists a Select / Multi-select / Autocomplete attribute picks from (English +
  Hungarian labels).
- Admin API under `api/Admin/*` for all of it.
- **Publishing**: a new type starts unpublished. It can be published only when both AI models (object detection and
  embedding) are uploaded; after that it can be published and unpublished freely.
- **Unpublished = gone from the app** for every user, deleting nothing: not listed, not searchable, its collections,
  items and listings are hidden and refused, nobody can manage them — until it is published again.
- Icons stored in `ICONSTORE_PATH` and served by a separate endpoint.

## Non-goals

- Training models (the existing "Similarity Check Training" tab stays as it is).
- Deleting AI models (a wrong upload is replaced by uploading again).
- Translations beyond English + Hungarian (the two app languages).
- Reordering attributes (they keep their creation order, as today).

## Anti-goals

- An item value that silently loses its meaning (an option id or attribute that no longer exists, a date read as a
  number).
- A hidden type that leaks: shown in a list, search, feed, follow list, or editable through any endpoint.
- A trade stranded because its listing's type was unpublished.
- Anything deleted by unpublishing (including waiting-for-review items expiring meanwhile).
- An admin endpoint reachable with a normal app token (even a user whose in-app role is Admin).

## Constraints

- Backend ASP.NET Core 8 + EF Core; schema by hand-run SQL in `src/startup/`; xUnit on SQLite (+ API tests).
- Manager is Python/Tkinter (`src/Coffer/Coffer.Manager`), unittest; API client in `reports/api.py` style.
- App (Expo) changes only where the icon URL and the hidden-type behaviour need it; i18n en + hu.
- AI service loads models per request from `MODELS_PATH`: `{typeId}_detection.pt` and the first file containing
  `{typeId}_similarity`, whose name must end in `_{classCount}.pt`.
- Git: no branches, no pushes, no Co-authored-by trailers.

## Approaches

| | How unpublished types disappear | Trade-off |
|---|---|---|
| **1 — explicit checks + route sweep (chosen)** | Every user-facing read path filters "type is published", write paths go through one shared guard; a test enumerates every API route and fails for any route not in the checked list, and calls each listed route with an unpublished type's collection / item / listing. | Matches how deleted rows are hidden today; deals and chats are naturally exempt. A missed check leaks a hidden thing — the sweep catches new routes. |
| 2 — central EF query filter | One filter hides unpublished types everywhere. | Every place that needs hidden rows (deals, chats, reviews, reports, Manager, deletion, activity log, sweeps) must switch it off; one miss crashes a trade. |
| 3 — request-boundary middleware | Resolves the type of the route's resource and refuses it. | Covers single-resource routes only; lists still need approach 1. |

Your human partner picked **1**.

## Decided by your human partner

1. **Data items use is protected (A)**: anything items, collections or listings use cannot be deleted or have its
   meaning changed; renaming and adding are always allowed. The Manager shows what blocks it ("used by 20 items").
2. **Icons**: separate endpoint; files in `ICONSTORE_PATH`; dev folder
   `E:\Homework\Programming\AI\szakdolgozat\data\icons`.
3. **Publishing**: new types start unpublished and are fully manageable in the Manager; publishing needs both models;
   with models present publish toggles freely; unpublishing deletes nothing; the type disappears from the app
   completely and its endpoints refuse it.
4. **Model upload**: both models uploaded per type from the Manager.
5. **Open trades (A)**: deals in progress on a listing of an unpublished type, and their chats, keep working until
   finished; everything else of the type is hidden.
6. Approach 1.

## Design

### Data

- `collection_types`: add `published boolean NOT NULL DEFAULT false`, `unpublished_at timestamptz NULL`
  (when it was last hidden), `description_translations jsonb NOT NULL DEFAULT '{}'` (Hungarian description).
- Migration `src/startup/item_type_management_migration.sql`: adds the columns and sets `published = true` for every
  type whose two model files exist — decided at deploy as the explicit statement list for current data: Cap (id 1)
  published; Stamp (id 2) stays unpublished (no models, no collections — nobody loses anything).
- No new tables. Models and icons are files; their presence is read from disk.

### What "in use" means (rule A)

| Thing | In use when | Blocked while in use |
|---|---|---|
| Item type | any collection (incl. deleted placeholders) or listing references it | delete |
| Attribute | any item value exists for it | delete, change data type, change option set |
| Option set | any attribute references it | delete |
| One option of a set | any item value of any attribute using the set contains its id (Select: value = id; Multi-select / Autocomplete: `;`-separated ids, e.g. `"1;4;"`) | remove that option |

Always allowed: names / labels / translations, description, colour, icon, adding attributes, adding options,
`Required` flag, moving the primary flag (it does not change stored values). Option ids are never reused: a new
option gets `max(existing ids) + 1`.

Type-level invariants checked on save: attribute names unique per type (case-insensitive), exactly one primary
attribute before publishing, Select / Multi-select / Autocomplete attributes need an option set, other types must not
have one.

### Publishing

- `POST api/Admin/ItemTypes/{id}/Publish {published}`.
- Publish requires: both model files present, exactly one primary attribute, an icon. Missing → 409 with a code per
  missing piece (`itemTypeNeedsModels`, `itemTypeNeedsPrimaryAttribute`, `itemTypeNeedsIcon`).
- Unpublish: sets `published = false`, `unpublished_at = now`. Nothing is deleted.
- Republish: waiting-for-review items of that type get their clock moved: `created_at += now − unpublished_at`, so
  the hidden time doesn't count towards the 30 days. While unpublished the expiry sweep skips the type's items.
- Model presence is checked on disk each time (a type published and later missing a file on disk stays published;
  "add from photo" then fails as it does today — the Manager shows the missing file).

### What unpublished hides (users)

Hidden / refused (404 `itemTypeNotFound`-style "not found", never revealing it exists):
item-type, attribute and option-set lists of the app (`api/CollectionTypes`, `api/Attributes` of the type); collections
(lists, grouped, search, by id, cover image, followers); items (lists, page, search, by id, cover image, tags);
feed and search; follows (my follows list, follow / unfollow); reactions and comments on its items (read and write);
other users' collections of the type; waiting-for-review list, summary and photo check; marketplace browse, listing
details, "my listings", creating / editing listings of the type, opening a new chat on such a listing; activity log
entries pointing at hidden things show as "No longer available" (not tappable).

Kept working (decision 5): deals in progress, their chats, confirming steps, reviews of finished deals, the user's own
reports list, account deletion, the activity log itself, admin views.

The shared guard: `IItemTypeVisibility` (scoped) answers `IsPublished(typeId)` and exposes the hidden type ids for
queries; cached for the request. Every read path adds `published` to its query (join on the type); every write path
calls `EnsureVisible(typeId)` before acting.

**Route sweep test**: enumerates the API's endpoints (`EndpointDataSource`); every route must be in one of three lists
— *checked* (called in the test with an unpublished type's resource, must answer 404 / omit it), *exempt with reason*
(deals, chats, Manager, auth, health…), or *not type-related*. A new route in none of them fails the test.

### Admin API (all `ManagerControllerBase`: Manager token + admin re-check; every change → `AdminAudit`)

| Method | Route | |
|---|---|---|
| GET | `api/Admin/ItemTypes` | list: id, names, colour, icon, published, models present, collections / listings count |
| GET | `api/Admin/ItemTypes/{id}` | detail incl. attributes with "in use" counts, model files (name, size, uploaded at) |
| POST | `api/Admin/ItemTypes` | create (unpublished) |
| PUT | `api/Admin/ItemTypes/{id}` | names, translations, description, colour |
| DELETE | `api/Admin/ItemTypes/{id}` | only unused and unpublished |
| POST | `api/Admin/ItemTypes/{id}/Icon` | multipart image |
| POST | `api/Admin/ItemTypes/{id}/Models` | multipart `detection` and / or `embedding` file + `classCount` (required with `embedding`) |
| POST | `api/Admin/ItemTypes/{id}/Publish` | `{ published }` |
| POST | `api/Admin/ItemTypes/{id}/Attributes` | create |
| PUT / DELETE | `api/Admin/Attributes/{id}` | edit / delete under rule A |
| GET / POST | `api/Admin/OptionSets` | list (with "used by" attributes and per-option use counts) / create |
| PUT / DELETE | `api/Admin/OptionSets/{id}` | edit labels, add / remove options under rule A / delete when unused |

Errors use the existing `{ code, message, params }` payload; Manager shows the message. Validation limits: names
1–60 chars, description ≤ 500, colour `#RRGGBB`, option labels 1–60 chars and no `;`, ≤ 200 options per set,
≤ 30 attributes per type.

### Files and security

- **Icons**: `ICONSTORE_PATH` (dev `E:\Homework\Programming\AI\szakdolgozat\data\icons` mounted at `/app/data/icons`;
  prod a named volume). Upload: PNG / JPEG / WebP by magic bytes, ≤ 1 MB, ≤ 1024×1024, **re-encoded to PNG** (drops
  anything hidden in the file), saved as `{typeId}_{yyyyMMddHHmmss}.png`; the old icon file is deleted after the save.
  Served by `GET api/CollectionTypes/Icon/{fileName}` (anonymous like today's `/icons`, file name validated against
  `^[0-9]+_[0-9]{14}\.png$` or the legacy names, `Content-Type: image/png`, `X-Content-Type-Options: nosniff`,
  cache header). Startup copies `cap.png` / `stamp.png` from `wwwroot/icons` into the store when missing, then the
  app reads every icon from the new endpoint; `wwwroot/icons` is removed.
- **Models**: written to `MODELS_PATH` (the API container needs it mounted in production too — compose change).
  `.pt` files are ZIP archives: checked by magic bytes (`PK\x03\x04`), ≤ 300 MB per file (request limit raised on that
  endpoint only), `classCount` 2–100 000. Written to a temp name, then moved into place: `{id}_detection.pt`,
  `{id}_similarity_{classCount}.pt`; any older `{id}_similarity_*` file is removed (the AI service picks the first
  match). **A `.pt` file can run code when the AI service loads it**: only administrators can upload, each upload is
  audited with the file's SHA-256, and the Manager warns to upload only models you trained yourself.
- Manager endpoints never accept paths or file names from the client; names are built from the type id.

### Manager UI (Tkinter, same look as the report views)

```
[Item types ▾]                                              Signed in as … · Sign out
┌ Types ───────────────┐ ┌ Cap ─────────────────────────────────────────────────────┐
│ ● Cap      published │ │ Name [Cap      ]  Hungarian [Kupak   ]  Colour [#84A98C]■ │
│ ○ Stamp    hidden    │ │ Description [..............................] HU [.....]   │
│ ○ Coin     hidden    │ │ Icon [img] (Upload icon…)                                 │
│ (New item type)      │ │ AI models: detection ✓ 6.2 MB · embedding ✓ 45 MB (60)    │
└──────────────────────┘ │            (Upload models…)                               │
                         │ Published [on/off]  — needs: models ✓ primary ✓ icon ✓     │
                         │ Attributes                                                │
                         │  Brand     Text         primary  required   used by 20 items│
                         │  Features  Multi-select options: Features  used by 14       │
                         │  (Add) (Edit) (Delete — disabled: in use)                 │
                         │ (Save)                                                    │
                         └───────────────────────────────────────────────────────────┘
```

Option sets tab: list of sets ("used by: Cap › Features, Stamp › Features") and an editor of rows (id, English
label, Hungarian label, "used by N items"); remove is disabled for used options.

### App changes

- Icon URLs → `api/CollectionTypes/Icon/{icon}`.
- Hidden types simply don't arrive; a screen holding a hidden collection / item / listing (opened before it was
  unpublished) gets 404 and shows the existing "not found / no longer available" state.
- New error codes get en + hu texts.

## Calls made while writing this up (your human partner can overturn them)

1. Rollout: Cap published, Stamp unpublished (no models, no collections).
2. Publishing also needs exactly one primary attribute and an icon (the app needs both to show items).
3. Hidden time doesn't count towards waiting items' 30 days.
4. No model delete; re-upload replaces. Old embedding files of the type are removed on replace.
5. A Hungarian description is added (the app shows descriptions in both languages).
6. Unpublished things answer 404, not 403, so their existence isn't revealed.
7. Anonymous icon endpoint (as today) with strict file-name validation; unpublished types' icons are fetchable by exact
   name only (names are not listed anywhere public).

## Left to the builder

- Exact Tkinter widget layout, colour picker widget.
- How each read path joins the published flag (per repository / service).
- Exact error codes and texts beyond the ones named here.
