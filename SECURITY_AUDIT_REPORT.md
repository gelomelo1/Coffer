# Coffer – Security Audit Report

Date: 2026-11-12 · Branch: `development` (uncommitted working-tree changes)
Scope: `Coffer.ASPNET`, `Coffer.BusinessLogic`, `Coffer.DataAccess`, `Coffer.Domain`, `Coffer.Infrastructure`, `Coffer.PythonService`, `Coffer.ReactNative`, Docker / CI setup. `Coffer.Manager` was skipped as requested.

Rule followed: **business logic unchanged**. Every fix only blocks something that the app's own UI never does (acting on other users' records, path tricks, hidden fields, etc.). Each fix was written test-first: a failing test was written, watched fail for the right reason, and then the fix made it pass.

---

## 1. Actions you must take (cannot be done in code)

| #   | Action                                                                                                                                                                                                                                                                                    | Why                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Revoke and regenerate the GitHub OAuth client secret** (GitHub → Settings → Developer settings → OAuth Apps).                                                                                                                                                                           | It was hard-coded in `GithubService.cs` and is in git history. Removing it from the code does not un-leak it.                     |
| A2  | Add `GITHUB_CLIENT_SECRET=<new secret>` to `src/.env` **and** `.env.production` (R2 zip).                                                                                                                                                                                                 | GitHub login now reads the secret from the environment and **fails closed (login error) until it is set**.                        |
| A3  | Check whether the production `JWT_SECRET` is still the one committed in commit `d3671d7` (`src/.env.production`, deleted later but still in history). If yes, **rotate it** (all users will need to log in again). Also rotate the DB password if that connection string is still in use. | Anyone with repo access can forge JWTs for any user with the old secret.                                                          |
| A4  | _(Optional, recommended)_ Add the same random `INTERNAL_API_KEY=<long random>` to the env of both the API and the Python service.                                                                                                                                                         | Enables the new shared-secret check between the backend and the Python service. When it is not set, the previous behaviour stays. |
| A5  | Make a **new development/production build** of the mobile app (`expo-secure-store` is a new native module).                                                                                                                                                                               | Until then the app keeps working but falls back to the old AsyncStorage storage.                                                  |
| A6  | Review and commit the changes (nothing has been committed).                                                                                                                                                                                                                               | —                                                                                                                                 |

---

## 2. Findings and fixes

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low

### Authorization / RBAC on users' records

| Sev | Finding                                                                                                                                                                                                                                                 | Fix                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴  | **Trades, Offers and TradeReviews used `AllowAllPermissionService`.** Any logged-in user could create/update/delete any trade, offer or review, impersonate other users (`userId` in the body) and put **other users' items** into their trades/offers. | New `TradePermissionService`, `OfferPermissionService`, `TradeReviewPermissionService`. Owner (or Admin) may create/update; owner, Admin or Moderator may delete, the same pattern as the existing services. Trade/offer items must belong to the acting user. A review may only be written by one party of a _traded_ trade about the other party (the same pairing `TradeReviewsRepository` already uses to read reviews). |
| 🔴  | `TradesController.Update` (authenticated, no permission check), `OffersController.Update` and **`OffersController.ChangeStatus` (no `[Authorize]` at all)**: anyone could accept/trade/reject any offer anonymously.                                    | `[Authorize]`, user-id check and permission check added. `ChangeStatus` is allowed for the trade creator or the offerer (Admin too), and only with the 6 statuses the app uses.                                                                                                                                                                                                                                              |
| 🔴  | DI registration bug: `IPermissionService<Guid, OfferProvided>` was registered, but `OffersController` asks for `IPermissionService<Guid, OfferRequired>`. The controller could not be constructed, so every Offers endpoint failed with a server error. | Fixed registration (test `OfferPermissionService_IsResolvable_ForOffersController`).                                                                                                                                                                                                                                                                                                                                         |
| 🟠  | `FollowPermissionService` checked `UserRole.User` where every other service checks `UserRole.Admin`. **Every normal user** could follow/unfollow on behalf of others, follow their own collection and delete anyone's follow.                           | `User` → `Admin` (3 places).                                                                                                                                                                                                                                                                                                                                                                                                 |
| 🟡  | `TradeReviews/Trade/{id}`, `TradeReviews/User/{id}` and `Trades/Search/{userId}` were reachable without login.                                                                                                                                          | `[Authorize]` added (the app always sends the token).                                                                                                                                                                                                                                                                                                                                                                        |

### Data exposure

| Sev | Finding                                                                                                                                                                                                                                                      | Fix                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟠  | `Item.PrivateNote` (shown only on the owner's item page) was returned to **every user** by all item, feed, search, trade, offer and reaction endpoints.                                                                                                      | New global `SensitiveDataRedactionFilter`: the note is kept only for the owner of the item's collection.                                                                                                             |
| 🟠  | Every user's **e-mail address** was returned to all logged-in users (`GET api/Users` lists everyone). The app never reads `email`.                                                                                                                           | Same filter: `email` is kept only for the user themself (e.g. `currentUser`).                                                                                                                                        |
| 🟡  | `User.ProviderUserId` (Google `sub` / GitHub id) was serialized in trades, offers, reviews and `currentUser`.                                                                                                                                                | `[JsonIgnore]`.                                                                                                                                                                                                      |
| 🟠  | The generic `filter` / `orderBy` query strings go straight into System.Linq.Dynamic.Core, so hidden fields could still be extracted character by character, e.g. `api/Users?filter=Email.StartsWith("a")` or `api/Items?filter=PrivateNote.StartsWith("a")`. | `DynamicQueryGuard`: `PrivateNote`, `Email` and `ProviderUserId` are rejected with 400 in `filter`/`orderBy`. Text inside string literals (user search text) is ignored. None of the app's filters use these fields. |

### Login handling and tokens

| Sev | Finding                                                                                                                                                                                                            | Fix                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴  | **Google ID tokens were validated without an audience check.** A Google ID token issued for _any other app_ (e.g. a malicious site the victim signs into) was accepted, so an attacker could log in as the victim. | `ValidationSettings.Audience` = the app's web client id (override with `GOOGLE_CLIENT_IDS`).                                                                                                   |
| 🔴  | GitHub OAuth `client_secret` hard-coded in source; the raw token-exchange response (containing the access token) was written to the log.                                                                           | Secret read from `GITHUB_CLIENT_SECRET` (fails closed if missing); log removed. **See A1/A2.**                                                                                                 |
| 🟡  | Google payload, JWT claim and full exception text were logged / returned to the client (`BadRequest(e.Message)`).                                                                                                  | Generic error messages; logging reduced.                                                                                                                                                       |
| 🟡  | Frontend kept the (1-year) JWT in **plaintext AsyncStorage**, which Android includes in backups. `app/index.tsx` printed the token to the console.                                                                 | New `utils/token_store.ts` uses `expo-secure-store` (Keystore/Keychain), migrates an existing token once, and falls back to AsyncStorage if the native module is missing. Console log removed. |

### Files, images and transactions

| Sev | Finding                                                                                                                                                                                                                                                                                                               | Fix                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴  | **Path traversal → arbitrary file read/delete/write.** `ImageService` used `Path.Combine(folder, fileName)`, and `item.Image` is client-controlled (`POST api/Items`). An item with `image = "/var/www/coffer/.env.production"` or `"../../x"` and then `DELETE api/Items/{id}` deleted that file (verified by test). | All paths are resolved and confined to their folder; non-plain names are rejected (GET → 404).                                                                             |
| 🟠  | Deleting an item/collection deleted **whatever file its `Image` named**, including another user's image.                                                                                                                                                                                                              | Files are deleted only if they belong to the entity (`{entityId}_…`, the naming the service itself uses).                                                                  |
| 🟠  | **Image + DB + vector-DB not consistent.** Item and collection delete removed the image files _before_ the DB transaction, then tried to restore them on failure. They also read every image first, so **a missing image file made the item/collection impossible to delete** (500).                                  | DB delete and Python call run inside the transaction. Files are removed only **after a successful commit** (best-effort, an orphan file is harmless). No pre-read backups. |
| 🟠  | The Python service answers **HTTP 200 with `{"status":"error"}`** on failure, and the backend only checked the status code. A failed embedding save/delete still **committed** the DB transaction (items without embeddings / orphaned embeddings).                                                                   | Backend checks both the status code and the body (`PythonServiceResponse.IsOkAsync`). Python's state-changing endpoints now return HTTP 500 on error.                      |
| 🟡  | `PUT api/Items/{id}` with `quantity = 0` (how the app deletes an item from the edit form) called the _base_ delete: image deleted outside the transaction, **embedding never deleted**.                                                                                                                               | Routed to the same delete as `DELETE api/Items/{id}`.                                                                                                                      |

### Backend ↔ Python service

| Sev | Finding                                                                                                                                                                                  | Fix                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡  | No authentication between the backend and FastAPI. In production it is internal-only (good). In dev, port 8000 was open on all interfaces, so anyone on the LAN could delete embeddings. | Optional `INTERNAL_API_KEY` shared secret (constant-time compare). The backend sends it **only** to `FASTAPI_URL`. Dev ports bound to `127.0.0.1`. |
| 🟡  | Path parameters were untyped strings. `collection_type_id` is used to build model file paths that are loaded with `torch.load`/YOLO.                                                     | `collection_type_id: int`, ids are `UUID` (422 otherwise). The values passed on are identical to before.                                           |
| 🔵  | `POST api/Collections/ImageCheck/Test` (ML debug endpoint writing to a hard-coded Windows path) was available to every user in production. The app does not use it.                      | Only available in the Development environment.                                                                                                     |

### Stored HTML (XSS-style)

| Sev | Finding                                                                                                                                                                                                                                               | Fix                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡  | `HtmlSafetyChecker` built a sanitized string but never used it. `<img src=x onerror=…>`, `<p onclick=…>`, `<iframe>` and unquoted `href=intent://…` all passed. **Collection descriptions** (rich HTML shown to other users) were not checked at all. | Parser-based check (AngleSharp, already shipped with HtmlSanitizer): rejects `on*` handlers, script/embed elements and non-http(s) URLs. Accepts all TenTap editor output (headings, lists, links, code, colors, task lists, pasted images). Collection create/update now uses it too, like user `Summary`. |

### Docker / CI

| Sev | Finding                                                                                                                       | Fix                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 🟠  | No `.dockerignore` rule for `.env*`. `COPY . .` would bake secrets into images pushed to GHCR when built from a working copy. | `**/.env`, `**/.env.*`, `UserTokens.txt` (and tests) excluded in both `.dockerignore` files. |
| 🔵  | Deploy job ran `docker login -p <token>` (token visible in the process list).                                                 | `--password-stdin`.                                                                          |
| 🔵  | Dev Postgres (5432) exposed on all interfaces.                                                                                | Bound to `127.0.0.1`.                                                                        |

---

## 3. Found but **not changed** (would change business logic or needs your decision)

1. 🟠 **Offer status workflow is enforced only in the app.** Both parties can set any of the 6 statuses, so e.g. an offerer could set their own offer to `accepted`/`traded` with a crafted request. Fix: a server-side state machine (who may move from which status to which).
2. 🟡 **JWT lifetime is 1 year**, with no refresh or revocation. Recommend short-lived tokens plus a refresh token.
3. 🟡 **Cleartext HTTP**: the app uses `http://…:5141` and `usesCleartextTraffic=true`, and the production API container listens on HTTP. Make sure production goes through an HTTPS reverse proxy and the app uses an `https://` base URL in release builds.
4. 🟡 **One `.env.production` for all containers**: Postgres and the Python service also receive `JWT_SECRET`, the GitHub secret, etc. Split it per service. Containers run as **root**: add `USER app` (`aspnet:8.0` has a built-in `app` user) and a non-root user in the Python image. Fix the volume ownership first.
5. 🟡 **CI/CD**: `prod-build.yml` pushes `:latest` images on _pull_request_ (before review), and deploy pulls `:latest` and connects as `root`. Recommend building on push to `main`, deploying by commit SHA, using a non-root deploy user, and pinning actions by SHA. Consider adding `dotnet test` to CI.
6. 🔵 **Bug (functional, not security):** `ReactionPermissionService.CanUpdate` looks up a _reaction_ by `data.ItemId` (should be the item), so **non-admin users can never update an existing reaction** (e.g. set rarity after a like). Left unchanged because it alters behaviour; it's a one-line fix if you want it.
7. 🔵 Rare transaction gaps that remain: if the DB **commit itself** fails _after_ Python succeeded, embeddings can be orphaned (upsert) or missing (delete). `Upsert` tags embeddings with the first item's collection id. Only the owner's own data is affected.
8. 🔵 Dynamic LINQ is still open-ended (complex/expensive queries possible). Long term, consider an allow-list of filterable fields.
9. 🔵 `GET api/Users/UserExists/{name}` is anonymous (username enumeration). It's needed for registration, so it's acceptable.
10. 🔵 `POST api/Items` (generic create) is unused by the app and accepts any `image` value. It's harmless now, but could be removed.
11. 🔵 One review per party per trade is not enforced server-side.
12. 🔵 `.cursor/mcp.json` with a local MCP nonce is committed (local only, low risk). Add it to `.gitignore`.

---

## 4. Behaviour differences you may notice

- GitHub login needs `GITHUB_CLIENT_SECRET` (A2).
- API responses: other users' `email` is `null`, `providerUserId` is gone, `privateNote` is `null` for non-owners.
- Filters on `Email` / `PrivateNote` / `ProviderUserId` → 400.
- Python's state-changing endpoints return 500 (not 200) on errors, and 422 on malformed ids. `image_check` responses are unchanged.
- Delete endpoints no longer include exception text in the error body. `Upsert` returns 502 if the Python service reports an error.
- Deleting an item via `quantity = 0` now also removes its embedding.

---

## 5. Verification (fresh runs)

| Check                                                                                                     | Result                                                               |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `dotnet build src/Coffer.sln`                                                                             | Build succeeded, 0 errors                                            |
| `dotnet test src/Coffer.sln` (new `Coffer.Tests`, xUnit, real `Program` pipeline on SQLite + fake Python) | **90 passed, 0 failed**                                              |
| Python `unittest` (`Coffer.PythonService/tests`, FastAPI TestClient)                                      | **11 passed**                                                        |
| `python -m compileall` (CI step)                                                                          | OK                                                                   |
| Frontend `tsc --noEmit`                                                                                   | 25 errors before, 25 after, none in changed files (all pre-existing) |
| Frontend `eslint` on changed files                                                                        | 0 errors (2 pre-existing warnings)                                   |

Not verified: Docker image builds, running the mobile app on a device, and real Google/GitHub sign-in (needs credentials and devices).

Run tests:

```
dotnet test src/Coffer.sln
cd src/Coffer/Coffer.PythonService && venv\Scripts\python.exe -m unittest discover -s tests
```

## 6. Changed / added files

**Backend:**

- **Controllers:** `AuthController`, `CollectionsController`, `FeedController`, `ItemsController`, `OffersController`, `TradesController`, `TradeReviewsController`, `Generic/ReadOnlyGenericController`
- **`Coffer.ASPNET/Extensions`:** `StartupExtension`, and new `AuthSettings`, `InternalApiKeyHandler`, `PythonServiceResponse`, `SensitiveDataRedactionFilter`
- **`Coffer.BusinessLogic`:** `HtmlSafetyChecker`, `ImageService`, `IImageService`, `GithubService`, `CollectionPermissionService`, `FollowPermissionService`, and new `OfferPermissionService`, `IOfferPermissionService`, `TradePermissionService`, `TradeReviewPermissionService`, `ItemOwnershipChecker`
- **Other:** new `DataAccess/Extensions/DynamicQueryGuard`, `Domain/Entities/User`, `Infrastructure/DependencyInjection`

**Python:** `app.py`, `.dockerignore`, new `tests/test_app_security.py`

**Frontend:** new `utils/token_store.ts`; `app/index.tsx`, `app/settings/index.tsx`, `app/settings/developer.tsx`, `const/backendAccessConfiguration.ts`, `hooks/auth.ts`, `hooks/token_storage.ts`, `app.json`, `package.json`, `package-lock.json`

**Infra:** `src/.dockerignore`, `src/docker-compose.dev.yml`, `.github/workflows/deploy.yml`

**Tests:** new `src/Coffer/Coffer.Tests/` (added to `Coffer.sln`)
