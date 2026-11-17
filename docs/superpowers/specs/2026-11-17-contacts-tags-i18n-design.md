# Remove contacts · tag popularity · translatable errors and reference names

User decisions (2026-11-17): remove UserContact everywhere and drop its table (no backup); tag counts across the whole
app; backend errors as **error codes** translated by the app (option A); reference names (collection types,
attribute names, item option labels) as **JSONB translations** resolved by `Accept-Language` (option A).

## 1. Remove UserContact
- Backend: entity `UserContact*`, `UserContactPlatform`, `User.Contacts`, DbContext set + mapping, controller,
  repository (+interface), permission service, DI registrations, dev-seed delete line.
- App: contacts tab/card, add-contact overlay, types, endpoint, `settings:contacts.*` keys. Settings › "Profile" shows
  only the profile card; **the reputation summary moves from the contacts tab onto the profile card**.
- DB: `src/startup/drop_user_contacts_migration.sql` (`DROP TABLE IF EXISTS user_contacts`), applied to dev.

## 2. Tag popularity (whole app)
- `GET api/Feed/TagStats?search=<partial>` → top 8 `{ tag, itemCount }` whose tag contains the text, most used first.
- `GET api/Feed/TagStats?tags=a,b,c` → `{ tag, itemCount }` for exactly those tags (0 when unused).
- Counts are distinct items, across all collections/types.
- Item tag editor (edit form + add-item flow): while a tag is being typed, a row of suggestion chips
  `#austria · 12` (tap completes the tag); under the field, every entered tag shows its count, or "new".

## 3. Error codes (option A)
- Every backend error carries a stable `code` (+ `params`) next to the English `message`:
  `{ "code": "listingNotFound", "params": { "p0": "…" }, "message": "Listing not found." }`.
  Codes reuse the current `errors:backend.<key>` slugs so existing translations keep working; params keep the
  `{{p0}}…` names already in the locale texts. Special codes (`terms_required`, `account_suspended`, …) unchanged.
- `MarketplaceException` gets a required code + optional args; controller `BadRequest("…")`-style results go
  through one helper that writes the same payload. A codemod inserts codes/args at the ~190 existing call sites.
- App: `mapApiError` uses `code` → `errors:backend.<code>` (or the special-code map); the English-text matching table
  (`backend_messages.ts`) is removed. `gen-backend-messages` becomes a generator/checker of the English `backend`
  section from the code/message pairs in C#, failing on a call site without a code.
- The English `message` stays in the payload for Coffer.Manager and other clients.

## 4. Translatable reference names (option A)
- New `jsonb` columns, default `'{}'`: `collection_types.name_translations`, `attributes.name_translations`,
  `item_options.option_labels_translations` (same delimiter as `option_labels`). **Ruling: the existing `name` /
  `option_labels` columns stay as the English value** — they are used in queries (dynamic filters, sorting, seed SQL);
  converting them in place would break those. JSON holds the other languages (`{"hu":"Kupak"}`), `en` optional.
- EF maps them as `Dictionary<string,string>` via a JSON value converter (works on Postgres jsonb and SQLite tests).
- `UseRequestLocalization` (en default; any language accepted) sets the request culture from `Accept-Language`;
  a System.Text.Json resolver modifier serializes `name` / `optionLabels` of these types as the translation for
  the request language, falling back to English — so every payload that nests them is localized, app unchanged.
- App sends `Accept-Language: <i18n.language>` on every request and refetches cached queries on language change.
- DB: `src/startup/i18n_reference_names_migration.sql`, applied to dev.

## Order
1 → 2 → 3 → 4, a commit each.
