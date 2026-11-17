# Contacts removal, tag popularity, error codes, translatable names — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four parts of the spec, each independently shippable.
**Spec:** `docs/superpowers/specs/2026-11-17-contacts-tags-i18n-design.md`
**Tech:** ASP.NET Core 8 + EF Core (Npgsql; SQLite in tests, xUnit), React Native/Expo app (node:test, check-i18n).

## Global Constraints
- Schema changes are hand-written SQL in `src/startup/`, applied to dev with `docker exec -i src-db-1 psql`.
- Backend tests: `dotnet test Coffer.Tests` all green; app: `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`.
- No Co-authored-by trailers; never push; one commit per task.

## Review Focus
1. Hidden callers of removed contact code (Manager, seed JSON, DevSeed validator).
2. Interpolated error messages with format specifiers or ternaries inside `{…}` — params must still match `{{pN}}`.
3. Errors thrown outside MarketplaceException/controller helpers (generic controllers, auth) still map to a key.
4. Tag text casing/whitespace — counts must match how tags are stored (lowercase, no `#`).
5. Localization resolver must not change English output when no translation exists.

### Task 1: Remove UserContact
Files: backend entity/enum/User.Contacts/DbContext/controller/repo/interface/permission service/DI/DevSeedRunner; app
settings_user_card, user_contact_card, add_contact_overlay, types, endpoint, locale keys; `drop_user_contacts_migration.sql`.
- [ ] grep every reference (`UserContact`, `contacts`, `Contacts`) in backend, Manager, seed JSON, app.
- [ ] delete/trim; move ReputationSummary onto UserInfoCard; Settings "Profile" without tabs.
- [ ] build + `dotnet test` green; app tsc/i18n/unit green; apply SQL to dev; device check Settings › Profile.
- [ ] commit `refactor: remove user contacts (frontend, backend, database)`.

### Task 2: Tag popularity
Interfaces: `IItemTagsRepository.GetTagStatsAsync(string? search, IReadOnlyCollection<string>? tags) : List<TagStat>`;
`record TagStat(string Tag, int ItemCount)`; `GET api/Feed/TagStats`; app `useTagStats(search, tags)`.
- [ ] tests (xUnit, TestDb): counts distinct items across collections/users; search orders by count desc then tag;
      exact-tags lookup returns 0 for unused; tags normalized (trim, lowercase, strip `#`). Watch fail.
- [ ] implement repository + endpoint; tests green.
- [ ] app: pure `currentTagToken(text)` helper (node test first), suggestion chips + per-tag counts in ItemEditTags.
- [ ] device check edit form + add-item flow; commit `feat: tag popularity counts while tagging items`.

### Task 3: Error codes
- [ ] tests: MarketplaceExceptionFilter payload has code/params/message; controller helper payload; app mapApiError
      uses `code` → key with params (node test). Watch fail.
- [ ] MarketplaceException(code, message, args); `ErrorArgs.Of(...)`; `this.ApiError(status, code, message, args)`.
- [ ] codemod all call sites (code = existing slug, args = interpolation expressions p0..pn); hand-fix leftovers.
- [ ] generator → emits en `backend` section from C# code/message pairs, fails on missing code; delete backend_messages.ts.
- [ ] `dotnet test` + app checks green; device: trigger a known error (e.g. review too short) shows translated text.
- [ ] commit `feat: stable error codes from the API, translated in the app`.

### Task 4: Translatable reference names
- [ ] tests: resolver serializes `name` from translations for `hu`, falls back to English for `de`/missing; nested
      in item/feed payloads. Watch fail.
- [ ] entities + converter + migration SQL; RequestLocalization; JSON resolver modifier; app Accept-Language header
      + invalidate queries on language change.
- [ ] apply SQL to dev, rebuild API, check `curl -H "Accept-Language: hu"` after setting one translation, then revert it.
- [ ] commit `feat: translatable collection type, attribute and option names`.
