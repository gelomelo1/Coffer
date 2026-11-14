# Moderation v2, Manager GitHub login, comments, dev seed — design

Source: the user's `instructions.md` (2026-11-14), adjusted by their answers:
docs live in the repo root (README.md), no Orval (keep hand-written TanStack Query hooks), no migration
framework (keep hand-written SQL scripts in `src/startup/`), Manager login "as fits best", seed only Cap
collections (only Cap has an AI model), one trade (deal) and one report per use case, comments may be
recreated, the user commits at the end (no `Co-authored-by`, no branches, no push).

## 1. Environment

* `.gitignore` already ignores `.env` and `.env.*`; add `!.env.enc` and `!.env.development.example`.
* Env files live in `src/` (next to the compose files). `src/.env.development` = every key of `src/.env` +
  new keys below; `src/.env.development.example` has placeholders only.
* Backend (local run): Development loads `../../.env.development` when it exists, else `../../.env`
  (unchanged production path). Docker dev compose uses `env_file: .env.development`.
* README: encrypted env workflow (commands verbatim from the instructions, run from `src/`).

New keys: `DEV_SEED_ENABLED`, `DEV_RESET_DATABASE_ON_STARTUP`, `DEV_SEED_DATA_JSON`, `DEV_SEED_IMAGE_DIR`,
`COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS` (JSON array of strings), `COFFER_MANAGER_GITHUB_CLIENT_ID`
(optional, defaults to `GITHUB_CLIENT_ID`/built-in app id).

## 2. Development seed + reset

* `DevSeedService` (BusinessLogic) runs once from `Program` before the app serves requests, only in the API
  process (the Python service never seeds). Guarded by a Postgres advisory lock so parallel API instances
  cannot reset twice.
* Safety: if `DEV_RESET_DATABASE_ON_STARTUP=true` or `DEV_SEED_ENABLED=true` and the environment is not
  Development, startup fails with a clear error. Never runs in tests unless invoked directly.
* Reset = keep schema and reference data (`collection_types`, `attributes`, `item_options`, `cities`), delete
  every user-data row in FK order (EF `ExecuteDelete`, provider-agnostic, testable on SQLite), remove the
  vector embeddings of every deleted collection via the Python service, delete only seed-managed image files
  (deterministic `seed_` names). Unrelated files are never touched.
* Seed when `DEV_SEED_ENABLED=true`: if reset is off and the seed users already exist, skip (idempotent).
* Seed JSON (`DEV_SEED_DATA_JSON`): users, collections, items (attributes, tags, `image` = file in
  `DEV_SEED_IMAGE_DIR`), follows, reactions, comments (+mentions), listings (lines, images), conversations
  (messages incl. price offers/meetups), deals, reviews, reports, suspensions. Deterministic GUIDs; times as
  `daysAgo`/`hoursAgo` offsets. Validated before anything is written (duplicate ids, unknown references,
  enum values, required fields) → one error listing every problem with its JSON path.
* Images: each seeded item's raw photo goes through the normal AI pipeline: FastAPI `/image_check/1/{collection}`
  (YOLO crop) → crop copied to the item store under the item id → `/save_embeddings/{collection}`. Nothing is
  marked processed by hand, no fabricated embeddings. If the image dir is missing or FastAPI is unreachable,
  a clear warning is logged and the item keeps the raw photo without embeddings.
* Admin: the user's real GitHub account is a seeded user and its id is in the admin list (local file only);
  no seeded user is an admin by role.

## 3. Coffer.Manager GitHub login (my call: GitHub Device Flow, brokered by the backend)

* Manager (Tkinter) starts on a login screen. `POST api/Manager/Auth/Device` → backend asks GitHub for a
  device code (same OAuth app; Device Flow must be enabled on it) and returns user code + verification URL.
  Manager opens the browser, then polls `POST api/Manager/Auth/Device/Token`. Backend exchanges the code,
  reads the immutable GitHub `id`, and only if it is in `COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS` issues a
  Manager JWT (audience `coffer.manager`, 8 h). GitHub tokens never reach the Manager.
* `manager_admins` table (github id, login, last login) gives audit identity; it does not grant access.
* Policy `ManagerAdmin`: Manager-audience JWT + github id still in the configured list (checked per request,
  so removing an id revokes access). Normal user tokens are rejected (different audience) and vice versa.
  All `api/Admin/*` endpoints use it; the old role-based admin check is dropped.
* No ids configured → startup warning; login returns 503 "administrator provisioning required".
* Whole Manager UI (both views) stays behind the login screen; the similarity view itself is unchanged.

## 4. Moderation

* Report targets gain `item` (collection item, owner = collection owner) and `comment` (author).
* Reported content (grouped by target type + id): thumbnail, title, owner, report count, open count, rules,
  reporters, statuses, last report. Paged. Detail = all reports on the target + latest snapshot.
* Resolution input: `reportIds[]`, `decision` (`removed`, `no_violation`, `suspended` = keep content, suspend
  author), `rule`, `statement` (now required, ≥10 chars, the existing field, stored on every report),
  `suspensionDays` (with `removed` optional, with `suspended` required). One transaction; each target removed
  once; each owner suspended at most once per operation, and not again if an active suspension already
  covers the new end. Endpoints: bulk, all-open-for-target, and the existing single resolve (kept).
* Item removal = same as owner delete (row, image, embedding); comment removal = moderation flag.
* `user_suspensions`: user, reason, starts, ends, created by admin, revoked at/by/reason, source report.
  Active = not revoked and now < ends. Enforcement middleware after authentication: any user-token request
  of a suspended user → 403 `{code:"account_suspended", message, endsAt, reason}` (except
  `GET api/Account/Suspension`), login endpoints return the same; short cache invalidated on change.
  App shows a "suspended" screen.
* Admin: list suspensions (active/expired/revoked/all, paged), suspend user manually (search users), revoke,
  per-user history. `admin_audit_log` records login, resolve, suspend, revoke.
* Manager: tabs "Reported content", "Individual reports", "Suspended users".

## 5. My Listings filters

Chips Active / Sold / Archived with counts. Active = `active` + in-deal (`pending_pickup`,
`pending_shipment`), Sold = `sold`, Archived = `archived` + `removed` (moderation). Server-side filter
`GET api/Listings/Mine?filter=` and `GET api/Listings/Mine/Counts`.

## 6. Comments (recreated)

* Drop unused `item_messages` and its entity/repo/service. New `item_comments` (item, author, parent, root,
  body, created, edited, deleted, is_removed) and `item_comment_mentions` (comment, user).
* API under `api/Items/{itemId}/Comments`: list (paged root threads, all replies of those threads), create
  (optional `parentId`, same item enforced), edit/delete own (backend ownership), report via existing
  reports endpoint. Delete = tombstone (body cleared, kept while it has replies; snapshots in reports keep
  evidence). Body plain text 1..2000, line breaks/emoji preserved.
* Mentions: client sends `mentionUserIds` picked from `GET api/Users/Mentionable?query=`; server keeps only
  users whose `@Name` appears in the body; DTO returns `{userId, name}` from the DB. Deleted users drop out.
* `isOwner` computed from the item's collection owner. Count on feed cards.
* UI: one `CommentSection` used on item details (own and other users') and in a sheet opened from the feed
  card's comment button. Nesting indents up to 3 levels, deeper replies stay at level 3 with "↪ name".
* No notification system exists, so mentions are not notified.

## 7. Schema

`src/startup/moderation_comments_migration.sql` (idempotent, hand-written, same pattern as before).

## 8. Tests

xUnit (SQLite + ApiFactory) for seed validation/reset/guards/image import (fake AI), Manager auth (fake
GitHub), admin authorization, grouping, bulk resolve, suspension lifecycle + enforcement, listing filters,
comments. Manager Python unit tests. tsc/lint for the app; live check on emulator + Manager.

## 9. As built (2026-11-14)

Calls made while building, beyond the sections above:

* Listing photos in the seed reuse the AI crop of the same raw photo (raw phone photos are ~9 MB, above the app's 8 MB
  upload limit, and didn't render in the app).
* Seeding without reset refuses to duplicate an existing login (same provider + provider id) with a clear error.
* Several seeded items are acquired within the last 7 days, because the home feed only shows the last week.
* The owner's seeded account can keep an existing user id (generator argument), so an app session made before a
  reset keeps working.
* After "Check again" clears a suspension, the app's start screen retries sign-in.
* `Report.ResolvedBy` now points at `manager_admins`; old values were cleared by the schema script.
* Verification: 272 backend tests, 16 Manager tests, tsc (no new errors), eslint (0 errors), mutation checks on the
  suspension middleware, admin policy, comment ownership/mentions and the production guard; live run on the dev
  database, the real AI service, the Manager window (driven by script) and the Android emulator.
