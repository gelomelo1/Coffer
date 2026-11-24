![Build Status](https://github.com/gelomelo1/Coffer/actions/workflows/build.yml/badge.svg)

# Coffer

Collector app: users catalogue their collections (bottle caps, stamps, …), an AI service recognises items on photos,
collectors follow and comment on each other's items and trade on the built-in marketplace. Admins moderate reports and
accounts in **Coffer.Manager**.

| Part | Path | Tech |
|---|---|---|
| Backend API | `src/Coffer/Coffer.ASPNET` (+ `BusinessLogic`, `DataAccess`, `Domain`, `Infrastructure`) | ASP.NET Core 8, EF Core 9, PostgreSQL |
| AI service | `src/Coffer/Coffer.PythonService` | FastAPI, YOLO detection + CNN embeddings, ChromaDB |
| Mobile app | `src/Coffer/Coffer.ReactNative` | Expo / React Native, TanStack Query |
| Admin tool | `src/Coffer/Coffer.Manager` | Python Tkinter |
| Tests | `src/Coffer/Coffer.Tests`, `src/Coffer/Coffer.Manager/reports/test_reports.py` | xUnit (SQLite), unittest |
| Schema scripts | `src/startup/*.sql` | hand-written, idempotent where possible |

---

## Environment configuration

Three places have their own env files, each with the same three files:

| Folder | What it configures |
|---|---|
| `src/` | backend API, AI service, PostgreSQL (development) |
| `src/Coffer/Coffer.ReactNative/` | the mobile app (backend URL, sign-in ids, URL scheme) |
| `src/Coffer/Coffer.Manager/` | the admin tool (backend URL) |

| File | In Git? | Purpose |
|---|---|---|
| `.env` | **no** | the real values, used for development |
| `.env.enc` | **yes** | the encrypted copy of `.env` — the only form of the real values that is committed |
| `.env.example` | yes | the same keys with safe placeholders — copy it to `.env` and fill it in |

Every key is required. A missing value stops the API (or the app) at startup with the name of the variable.

### Encrypted `.env` workflow

Decrypt (run in the folder of the file):

```
openssl enc -aes-256-cbc -d -salt -pbkdf2 -in .env.enc -out .env
```

After modifying `.env`, encrypt it again:

```
openssl enc -aes-256-cbc -salt -pbkdf2 -in .env -out .env.enc
```

* The decrypted `.env` file must **never** be committed (`.gitignore` excludes `.env` and `.env.*`, and explicitly
  allows `.env.enc` and `.env.example`).
* OpenSSL asks for the encryption password on both commands.
* Anyone who needs to run the project gets the password through the team's established secure channel — never through
  the repository, an issue or a chat log.

### Which file is loaded

* `docker compose -f docker-compose.dev.yml up` — every service reads `src/.env`.
* Running the API directly (`dotnet run` in `Coffer.ASPNET`) in the Development environment — `../../.env`.
* Production — no file: every value comes from the process environment (GitHub secrets). Production needs
  `JWT_SECRET` (32+ bytes), `COFFER_CONNECTIONSTRING`, `COFFER_ROOT_PATH`, `FASTAPI_URL`, `POSTGRES_DB`, `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, `GOOGLE_CLIENT_IDS`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`,
  `FACEBOOK_GRAPH_VERSION`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REDIRECT_URI`, `REDDIT_USER_AGENT`,
  `TRUSTED_PROXIES` (the network nginx connects from, e.g. the Docker bridge `172.18.0.0/16`),
  `COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS`, optionally `COFFER_MANAGER_GITHUB_CLIENT_ID` and `INTERNAL_API_KEY`.

### Data folders

`COFFER_ROOT_PATH` (`/app` in Docker) is the only path setting. The API and the AI service both derive:
`data/images` (item, cover, listing, news and pending images), `data/icons` (item type icons), `data/vectors` (vector
store), `data/temp` (photo checks) and `models` (AI models per item type).

### Settings added for this version

| Variable | Where | Meaning |
|---|---|---|
| `COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS` | all environments | JSON array of **numeric GitHub user ids** allowed into Coffer.Manager, e.g. `'["12345678","87654321"]'` |
| `COFFER_MANAGER_GITHUB_CLIENT_ID` | optional | OAuth app for the Manager sign-in (defaults to `GITHUB_CLIENT_ID`, then the app's built-in id) |
| `DEV_SEED_ENABLED` | Development only | `true` = insert the development dataset on API start (skipped when the seed users already exist) |
| `DEV_RESET_DATABASE_ON_STARTUP` | Development only | `true` = empty the development database on API start, then seed |
| `DEV_SEED_DATA_JSON` | Development only | the dataset (single-quoted JSON, see below) |
| `DEV_SEED_IMAGE_DIR` | Development only | folder of raw example photos, as the API sees it (`/app/data/examples` in Docker) |
| `DEV_SEED_AI_WAIT_SECONDS` | Development only | how long the seed waits for the AI service (default 120) |
| `DEV_LOGIN_ENABLED` | Development only | `true` = the app's sign-in screen offers a dev login as any seeded user |
| `COFFER_API_URL` | `Coffer.Manager/.env` | backend URL the Manager talks to |

---

## Development environment

1. Create `src/.env`: decrypt `.env.enc` (above) or copy `.env.example` and fill it in.
2. Apply the schema scripts once, in order (each is safe to re-run):
   `startup/marketplace_migration.sql`, `startup/marketplace_migration_2.sql`, `startup/moderation_comments_migration.sql`
   ```
   docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/moderation_comments_migration.sql
   ```
3. `docker compose -f docker-compose.dev.yml up --build` (or `start.ps1`). The example photos are mounted read-only from
   `E:\app\data\examples` into the API container at `/app/data/examples`.

### Development seed data

`DEV_SEED_DATA_JSON` holds a realistic, interconnected dataset that matches the real domain model — change the data
without touching source code. Top-level sections: `users`, `collections`, `items` (attributes, tags, raw `image`
file), `follows`, `reactions`, `comments` (nested via `parentId`, `mentions` by user id, `edited`, `deleted`),
`cities`, `listings`, `conversations` (messages incl. price offers and meetup proposals), `deals`, `reviews`,
`reports` (optionally with a `resolution`) and `suspensions`. Ids are fixed GUIDs; times are offsets from now
(`daysAgo`, `hoursAgo`, …); enum values are the API's snake_case strings. Keep apostrophes out of the JSON (the value is
single-quoted).

The bundled dataset covers: 8 users (one empty collection, small and large collections, a suspended user, a user
with a revoked and one with an expired suspension), Cap collections only (the only type with an AI model), listings
that are active / reserved / sold / archived / removed, deals that are proposed / awaiting hand-off / awaiting shipment
/ shipped / completed (pickup and shipping) / disputed / cancelled, accepted / declined / withdrawn price offers and
counteroffers, published, pending and replied reviews, and reports of every target type and status (an item with
four reports, a comment with two, listing removal, message removal + suspension, no-violation outcomes, an open
report on a deleted comment, a frozen review).

Before anything is written the JSON is validated (syntax, unknown fields, required fields, duplicate ids, references
between records, enum values, states that must agree — e.g. a completed deal needs a sold listing); every problem is
reported with its JSON path and startup stops.

Reports in the dataset are filed through the real report service (so they carry real evidence snapshots) and resolved
through the real moderation workflow. Nobody gets an admin role from the seed.

**Dev login:** with `DEV_LOGIN_ENABLED=true` the app's sign-in screen (dev builds only) shows a red "DEV LOGIN" strip
with the users of `DEV_SEED_DATA_JSON`; one tap signs you in as that user — no Google/GitHub needed
(`GET api/auth/dev/users`, `POST api/auth/dev/login`). Only users defined in the seed can be used, suspended seed users
get no token, the endpoints answer 404 unless the API runs in Development with the flag on, and the API refuses to start
when the flag is set in any other environment.

**Your own account:** put your GitHub account in `users` with `"provider": "github"` and your numeric GitHub id as
`providerUserId` — you can then sign in to the app as that seeded user. If a seed user would duplicate an existing
login while reset is off, startup stops and says so.

### Database reset on startup

With `DEV_RESET_DATABASE_ON_STARTUP=true` the API, on start:

1. deletes every user-data row (users, collections, items, comments, listings, chats, deals, reviews, reports,
   suspensions, audit log) in foreign-key order, in one transaction — reference data (collection types, attributes,
   item options, cities) and the schema stay;
2. deletes the AI embeddings of the deleted collections and the image files that belonged to the deleted rows (nothing
   else in the data folders is touched);
3. inserts the seed data and imports the example images (below).

Safety:

* Reset and seed run **only in the Development environment**. If either flag is set anywhere else, the API refuses to
  start with an explicit error — it never touches a production or staging database.
* Only the API process does it (the Python service never seeds), under a PostgreSQL advisory lock so two API
  instances can't reset at the same time.
* Seed JSON is validated before the reset, so a typo can't leave you with an empty database.
* With `DEV_RESET_DATABASE_ON_STARTUP=false` the database is preserved.

Turn the flag back to `false` after a reset, otherwise every API restart (including `dotnet watch` reloads) resets again.

### Example images and the AI pipeline

`DEV_SEED_IMAGE_DIR` points at raw phone photos. Each seeded item's photo takes the same route as in the app: the raw
photo goes to the AI service (`/image_check/{type}/{collection}`: object detection + crop + embedding in the temp
folder), the crop becomes the item image and the embedding is saved under the item id (`/save_embeddings`). Nothing is
marked as processed by hand and no embeddings are invented. Listing photos reuse that crop (a raw phone photo can exceed
the app's 8 MB upload limit). If the folder is missing, or the AI service doesn't come up within
`DEV_SEED_AI_WAIT_SECONDS`, the seed logs a clear warning (items then keep the raw photo and have no embedding). Repeated
resets delete the previous seed files first, so no duplicates or orphans pile up.

---

## Coffer.Manager (administrators only)

Start it from `src/Coffer/Coffer.Manager`:

```
.\venv\Scripts\python.exe app.py
```

The backend URL comes from `COFFER_API_URL` in `Coffer.Manager/.env` (git-ignored; copy `.env.example`):

```
COFFER_API_URL=http://localhost:5141
```

The sign-in screen shows it; without it, sign-in tells you to set it.

### Sign-in: GitHub device flow

The Manager is a desktop app, so it uses GitHub's **device flow**, brokered by the backend:

1. "Sign in with GitHub" shows a code and opens `https://github.com/login/device`.
2. You enter the code and approve; the Manager polls the backend meanwhile.
3. The backend exchanges the code with GitHub, reads your **immutable numeric GitHub id**, and only if it is listed in
   `COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS` issues a Manager token (8 hours, kept in memory only). The GitHub
   token never reaches the Manager.

One-time GitHub setup: in the OAuth app (GitHub → Settings → Developer settings → OAuth Apps → the Coffer app) tick
**Enable Device Flow**. Without it the sign-in answers "Device sign-in is disabled for the GitHub OAuth app".

Find a GitHub user id: `https://api.github.com/users/<login>` → `"id"`. Usernames and e-mails are never used for
authorization.

### Administrator provisioning

* Development: set the ids in `src/.env`.
* Production: set `COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS` in the production environment (GitHub secrets) before the first start; the first
  administrator can sign in right away (no seed data is involved). There is no fallback admin account, and the first
  person who signs in does **not** become an admin.
* No (or an invalid) list = nobody gets in; the API logs "administrator provisioning required" at startup and the sign-in
  returns that message.
* Removing an id takes effect on the next request of that admin (checked on every call).

### Security model

* Every `api/Admin/*` endpoint requires the `ManagerAdmin` policy: a Manager token (separate JWT audience
  `coffer.manager`) whose GitHub id is still configured. Normal Coffer user tokens — even of users with the old
  in-app `Admin` role — get 401, and Manager tokens are not accepted by user endpoints.
* Every admin action (sign-in, resolution, suspension, revoke) is written to `admin_audit_log`.

### Views

* **Similarity Check Training** — the existing AI training tool, unchanged (now behind the sign-in).
* **Reported content** — one row per reported listing, collection item, comment, message or review: thumbnail, owner,
  number of reports, open count, reasons, reporters, statuses, last report. Open a row to see every report and the
  frozen evidence, then resolve all its open reports (or a selection) with one decision.
* **Individual reports** — the report list; Ctrl/Shift-select several to resolve them together.
* **Suspended users** — active / expired / revoked / all suspensions (reason, start, end, admin, status), revoke,
  per-user history, and "Suspend a user" by name.

Decisions: *Remove content*, *Remove content + suspend author*, *Suspend author (keep content)*, *No violation*.
One explanation field (at least 10 characters) is required for every decision; it is stored on every resolved report,
shown to reporters as the outcome and to the author as the statement of reasons (never naming the reporter), and is
the suspension reason. A removal also answers the other open reports on the same content. In a bulk decision each
author is suspended at most once, and not again when an existing suspension already lasts as long.

### Temporary suspensions

Stored in `user_suspensions` (start, end, reason, admin, source report, revoke data). The backend enforces them on
every request made with a user token — including tokens issued before the suspension, so signing in again doesn't
help (sign-in itself also refuses). Blocked requests get `403 { code: "account_suspended", reason, endsAt }`; the app
shows a "Your account is suspended" screen with the reason and end time. `GET api/Account/Suspension` stays reachable.
Expired suspensions stop applying automatically (checked by time, cached for at most 15 s).

---

## Reporting (users)

Users report listings, chat messages, reviews (only the reviewed person), **collection items** (anyone but the owner)
and **comments** (anyone but the author) against fixed content rules; each rule lists the content types it applies to.
Reports freeze an evidence snapshot. Settings › Reports shows *My reports* (with outcome and a link to the listing,
chat or item) and *About my content* (what was moderated and why, never who reported it).

## Comments on collection items

* Available on the item details page (own and other users' items) and from the comment button on every feed card —
  both use the same component and API (`api/Items/{itemId}/Comments`).
* Plain text with line breaks and emoji; no HTML or rich text.
* Replies at any depth (`parent_id`, `root_id`); the UI indents up to three levels and marks deeper replies with
  "↪ name".
* Mentions: type `@` for suggestions; mentions are stored by user id and only kept when `@Name` really appears in the
  text, so they can't be spoofed; deleted users drop out.
* An **OWNER** badge marks comments by the item's owner (computed by the backend from real ownership).
* Authors can edit and delete their own comments (enforced by the backend). A deleted comment that has replies or
  reports stays as a "[deleted comment]" placeholder; otherwise it is removed completely.
* Comments can be reported and moderated through the reporting workflow above.
* There is no notification system in Coffer, so mentions don't notify.

## Market filters

Browse › Filters includes **Seller nationality**: quick chips (🇭🇺 Hungarian, 🇬🇧 British, 🇺🇸 American, 🇩🇪 German,
🇦🇹 Austrian, 🇫🇷 French) and "+ Other country" for any country; several can be combined. It matches the seller's profile
country (`GET api/Listings?sellerCountry=HU,GB`, ISO two-letter codes), and every listing card shows the seller's flag.

## My Listings filters

Market › My Listings has **Active** (live or reserved by an open deal), **Sold** and **Archived** (archived by the owner
or removed by moderation) chips with counts; filtering happens on the server
(`GET api/Listings/Mine?filter=active|sold|archived`, `GET api/Listings/Mine/Counts`).

---

## Tests

```
cd src
dotnet test Coffer/Coffer.Tests/Coffer.Tests.csproj
cd Coffer/Coffer.Manager && .\venv\Scripts\python.exe -m unittest reports.test_reports -v
cd ../Coffer.ReactNative && npx tsc --noEmit && npx eslint src
```
