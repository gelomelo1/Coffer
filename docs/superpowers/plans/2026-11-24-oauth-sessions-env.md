# OAuth (Google, Facebook, Reddit), server-side sessions, env cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace GitHub app sign-in with Facebook + Reddit next to Google, add rotating server-side sessions, collapse
the env files and data paths, and ship an OAuth/session security audit.

**Architecture:** Backend-held OAuth transactions (state, nonce, PKCE verifier never leave the API) for the browser
providers; native Google ID token verified on the API. Every sign-in ends in `ISessionService.IssueAsync`, which
creates an `auth_sessions` row + hashed refresh token and a 15-minute access JWT carrying `sid`. A guard middleware
rejects tokens of revoked/expired sessions. The app keeps both tokens in SecureStore and refreshes single-flight.

**Tech Stack:** ASP.NET Core 8, EF Core 9 (PostgreSQL; SQLite in tests), xUnit, DotNetEnv,
System.IdentityModel.Tokens.Jwt 8.14, Google.Apis.Auth; FastAPI (Python); Expo 54 / React Native, expo-auth-session,
expo-web-browser, expo-crypto, expo-secure-store, axios, TanStack Query, node:test.

**Spec:** `docs/superpowers/specs/2026-11-24-oauth-sessions-env-design.md`

## Global Constraints

- Git: commit on the current branch (`development`), never push, never create a branch, **no `Co-Authored-By` or
  other AI trailers**, one commit per task.
- No new NuGet/npm packages unless a task says so (none does).
- Providers allowed in the app's sign-in: `google`, `facebook`, `reddit`. `github` users may only come from the
  `.env` dev seed. Coffer.Manager GitHub sign-in is untouched.
- Every env value is required (strict). Missing → `InvalidOperationException("<NAME> environmental variable is not set")`
  on the backend; `Error("Missing <NAME> in Coffer.ReactNative/.env")` in the app.
- Access JWT 15 min, HS256 only, `iss`=`aud`=`coffer.backend`, claims `sub`, `sid`, `jti`, `iat`, `nbf`, `exp`;
  `ClockSkew` 30 s; `JWT_SECRET` ≥ 32 bytes (UTF-8).
- Refresh token = 32 random bytes base64url; DB stores lowercase hex SHA-256 only; idle 14 days; session absolute 60
  days.
- Random handles (transaction id, state, nonce, PKCE verifier, registration id): 32 bytes from
  `RandomNumberGenerator`, base64url. Pending transactions/registrations: 10-minute TTL, single use.
- Never log or return provider tokens, codes, secrets, refresh tokens or raw provider bodies.
- New error codes go through `MarketplaceException.<Kind>("code", "Message")` or `this.ApiError(status, "code", "Message")`
  so `npm run gen:errors` picks them up; run it (and `npm run check:errors`) whenever codes change.
- Comments/README in the existing tone (plain English, short).

## Review Focus

1. **The app comes back after 15+ minutes idle** → the first request gets 401, a single refresh runs, the request is
   retried and succeeds; 5 parallel requests cause exactly one refresh (Task 10 test `single_flight_refresh`).
2. **A refresh response is lost on the network** (server rotated, app kept the old token) → next refresh is treated as
   reuse and the session is revoked; the app lands on sign-in, not in a loop (Task 4 test
   `Reuse_of_consumed_token_revokes_session`, Task 10 test `refresh_failure_signs_out_once`).
3. **User cancels the Facebook/Reddit page or the provider returns `error=access_denied`** → no backend call, no error
   toast beyond "cancelled", no pending state left that breaks the next attempt (Task 11 test
   `parse_auth_result_handles_error_and_cancel`).
4. **Registration form submitted twice** (double tap) → one user created, the second call fails cleanly with
   `invalidRegistrationSession`, not a 500 (Task 5 test `Register_handle_is_single_use`).
5. **Provider outage / malformed provider JSON** → `providerSignInFailed` 400/502-style error, nothing persisted, no
   transaction left reusable (Task 6 test `Malformed_token_response_fails_cleanly`, Task 7 test
   `Reddit_me_failure_fails_cleanly`).

---

## File structure

Backend (new):
- `Coffer.BusinessLogic/Configuration/AppPaths.cs` — derives data folders from `COFFER_ROOT_PATH`.
- `Coffer.BusinessLogic/Auth/AuthOptions.cs` — strict auth config (JWT secret, Google, Facebook, Reddit).
- `Coffer.BusinessLogic/Auth/Sessions/AccessTokenIssuer.cs`, `SessionService.cs`, `SessionGuardCache.cs`.
- `Coffer.BusinessLogic/Auth/OAuth/SecureRandom.cs`, `OAuthTransactionStore.cs`, `PendingRegistrationStore.cs`,
  `ProviderIdentity.cs`, `SignInService.cs`, `GoogleIdTokenValidator.cs`, `FacebookOAuthClient.cs`,
  `RedditOAuthClient.cs`.
- `Coffer.Domain/Auth/AuthSession.cs`, `AuthRefreshToken.cs`.
- `Coffer.DataAccess/AuthModel.cs` — EF mapping.
- `src/startup/oauth_sessions_migration.sql`.
- `Coffer.ASPNET/Extensions/AuthRateLimits.cs`, `ForwardedHeadersSetup.cs`.
- `Coffer.PythonService/paths.py`.

Backend (removed): `Services/GithubService.cs`, `Services.Interfaces/IGithubService.cs`, `Services/TempTokenService.cs`,
`Services.Interfaces/ITempTokenService.cs`, `Services/JwtService.cs`, `Services.Interfaces/IJwtService.cs`,
`Coffer.ASPNET/Extensions/AuthSettings.cs`.

App (new): `src/const/env.ts`, `src/utils/env_check.ts`, `src/utils/refresh_gate.ts`, `src/utils/auth_redirect.ts`,
`src/utils/session.ts`, `app.config.ts`, `plugins/with_network_security.js`, `.env`, `.env.example`,
`tests/env_check.test.ts`, `tests/refresh_gate.test.ts`, `tests/auth_redirect.test.ts`. Removed: `app.json`.

Tests (new): `Coffer.Tests/Auth/AppPathsTests.cs`, `AuthOptionsTests.cs`, `SessionServiceTests.cs`,
`SessionApiTests.cs`, `GoogleSignInTests.cs`, `FacebookSignInTests.cs`, `RedditSignInTests.cs`, `FakeHttp.cs`,
`TestJwks.cs`; `Coffer.PythonService/tests/test_paths.py`.

---

### Task 1: One root path (`COFFER_ROOT_PATH`) for backend and Python service

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Configuration/AppPaths.cs`, `src/Coffer/Coffer.PythonService/paths.py`,
  `src/Coffer/Coffer.Tests/Auth/AppPathsTests.cs`, `src/Coffer/Coffer.PythonService/tests/test_paths.py`
- Modify: every reader of `IMAGESTORE_PATH`, `IMAGECHECK_TEMP_PATH`, `MODELS_PATH`, `ICONSTORE_PATH`,
  `VECTORSTORE_PATH` (C#: `CollectionsController.cs:27,29`, `ItemsController.cs:23-24`,
  `ContentTombstoneService.cs:66`, `DevSeedRunner.cs:185`, `DevSeeder.cs:395-396`, `ItemTypeFiles.cs:63-64`,
  `NewsImages.cs:33`, `PendingItemService.cs:266-267`, `MarketplaceRegistration.cs:23`; Python: `app.py:36,57,67,129,149,226,262,267`,
  `pending.py:16`), `Coffer.Tests/ApiFactory.cs:39-45` and Python tests that set the old variables
  (`test_coffer_models.py`, `test_pending.py`, `test_reembed.py`).

**Interfaces:**
- Produces: `public static class AppPaths { string Root; string Images; string Icons; string Vectors; string Temp; string Models; }`
  (namespace `Coffer.BusinessLogic.Configuration`), each a property computed on access from
  `Env.GetString("COFFER_ROOT_PATH")`: `Images = {root}/data/images`, `Icons = {root}/data/icons`,
  `Vectors = {root}/data/vectors`, `Temp = {root}/data/temp`, `Models = {root}/models` (`Path.Combine`).
  Python: `paths.root()`, `paths.images()`, `paths.icons()`, `paths.vectors()`, `paths.temp()`, `paths.models()` —
  raise `RuntimeError("COFFER_ROOT_PATH environmental variable is not set")` when unset/empty.

- [ ] **Step 1: Write failing tests**

```csharp
public class AppPathsTests
{
    [Fact] public void Derives_every_folder_from_the_root() {
        var root = Environment.GetEnvironmentVariable("COFFER_ROOT_PATH")!;
        Assert.Equal(Path.Combine(root, "data", "images"), AppPaths.Images);
        Assert.Equal(Path.Combine(root, "data", "icons"), AppPaths.Icons);
        Assert.Equal(Path.Combine(root, "data", "vectors"), AppPaths.Vectors);
        Assert.Equal(Path.Combine(root, "data", "temp"), AppPaths.Temp);
        Assert.Equal(Path.Combine(root, "models"), AppPaths.Models);
    }
}
```
(The "missing root throws" case is tested in Python only — changing a process-wide variable mid-run would break
parallel xUnit tests.)

```python
class PathsTest(unittest.TestCase):
    def test_derives_from_root(self):  # env COFFER_ROOT_PATH=/x
        self.assertEqual(paths.images(), os.path.join("/x", "data", "images"))
        self.assertEqual(paths.models(), os.path.join("/x", "models"))
    def test_missing_root_raises(self):  # env without COFFER_ROOT_PATH
        with self.assertRaisesRegex(RuntimeError, "COFFER_ROOT_PATH"): paths.images()
```

- [ ] **Step 2: Run, expect failure** — `dotnet test src/Coffer/Coffer.Tests --filter AppPathsTests` (compile error:
  `AppPaths` missing); `cd src/Coffer/Coffer.PythonService; python -m unittest tests.test_paths -v` (ImportError).
- [ ] **Step 3: Implement `AppPaths` and `paths.py`; replace every old read** with the matching property/function
  (`IMAGESTORE_PATH` → `Images`, `IMAGECHECK_TEMP_PATH` → `Temp`, `MODELS_PATH` → `Models`, `ICONSTORE_PATH` → `Icons`,
  `VECTORSTORE_PATH` → `Vectors`). Update doc comments that name the old variables. `TestEnvironment` sets only
  `COFFER_ROOT_PATH = Root` and keeps its helper properties, now rooted the same way (`ItemImages =
  Root/data/images/items`, `Temp = Root/data/temp`, `Models = Root/models`, `Icons = Root/data/icons`, …). Python
  tests set `COFFER_ROOT_PATH` to a temp dir laid out the same way.
- [ ] **Step 4: Run** `dotnet test src/Coffer/Coffer.Tests` (all pass) and
  `cd src/Coffer/Coffer.PythonService; python -m unittest discover -s tests -v` (every test that could run before
  still passes — tests needing ML packages missing from the local interpreter were already skipped/failing; record
  the before/after counts). `Grep` for the five old
  names in `src/Coffer` (excluding docs) returns nothing.
- [ ] **Step 5: Commit** — `refactor(config): derive every data folder from COFFER_ROOT_PATH`

### Task 2: Env files, loading, forwarded headers

**Files:**
- Create: `src/.env` (from current `src/.env.development`), `src/.env.example`
  (from `src/.env.development.example`), `src/Coffer/Coffer.ASPNET/Extensions/ForwardedHeadersSetup.cs`
- Delete: `src/.env.development`, `src/.env.development.enc`, `src/.env.development.example`, old `src/.env.enc`
  (the old prod-style `src/.env` is replaced by the new one)
- Modify: `.gitignore:41-44`, `src/docker-compose.dev.yml:11,45,56`, `src/Coffer/Coffer.ASPNET/Extensions/StartupExtension.cs:31-63,77-90`,
  `README.md` "Environment configuration" + "Which file is loaded" + seed/admin mentions of `.env.development`,
  comments in `DevSeedData.cs:8`, `DevSeedRunner.cs:10`, `DevSeedValidator.cs:33`, `StartupExtension.cs:122`.
- Test: `src/Coffer/Coffer.Tests/Auth/ForwardedHeadersTests.cs`

**Interfaces:**
- Produces: `ForwardedHeadersSetup.Options(string? trustedProxies) -> ForwardedHeadersOptions` (XForwardedFor |
  XForwardedProto; `KnownProxies`/`KnownNetworks` cleared, then filled from the comma list — entries with `/` are
  CIDR networks, others IPs; unparsable entry → `InvalidOperationException("TRUSTED_PROXIES has an invalid entry: …")`;
  `ForwardLimit = 1`). `SetupMiddleware` calls `app.UseForwardedHeaders(ForwardedHeadersSetup.Options(Env TRUSTED_PROXIES))`
  first.

- [ ] **Step 1: Write failing tests** — `Options(null)` has empty `KnownProxies` and `KnownNetworks`;
  `Options("172.18.0.0/16, 10.0.0.5")` has one network (prefix 172.18.0.0/16) and one proxy (10.0.0.5);
  `Options("nope")` throws with "TRUSTED_PROXIES".
- [ ] **Step 2: Run** `dotnet test --filter ForwardedHeadersTests` → compile failure.
- [ ] **Step 3: Implement** `ForwardedHeadersSetup`; in `StartupExtension.SetupServices` replace the env block with:
  Development → `Env.Load("../../.env")` only `if (File.Exists("../../.env"))`; any other environment → no file
  (process environment only). Log which happened. Remove the `/var/www/coffer/.env.production` load.
- [ ] **Step 4: Build the env files.**
  - New `src/.env` = current `.env.development` content with: the five path keys replaced by `COFFER_ROOT_PATH=/app`;
    `GITHUB_CLIENT_SECRET` removed (keep the Manager keys); auth keys added in Task 3 (placeholder block now:
    `GOOGLE_CLIENT_IDS=652829495328-7n61l38u1h20q7bnl469pr1i0s68khrv.apps.googleusercontent.com`,
    `FACEBOOK_APP_ID=change-me`, `FACEBOOK_APP_SECRET=change-me`, `FACEBOOK_REDIRECT_URI=fbchange-me://authorize`,
    `FACEBOOK_GRAPH_VERSION=v21.0`, `REDDIT_CLIENT_ID=change-me`, `REDDIT_CLIENT_SECRET=change-me`,
    `REDDIT_REDIRECT_URI=com.gelomelo.coffer://oauth/reddit`, `REDDIT_USER_AGENT=android:com.gelomelo.coffer:1.0.0 (by /u/change-me)`),
    `TRUSTED_PROXIES=` commented out with a note (unset in dev).
  - `src/.env.example` = same keys, safe placeholders, a one-line comment above each auth key saying where to get it
    (Google Cloud console web client id; Facebook app dashboard; Reddit prefs/apps "web app"), header comment
    "Copy to .env and fill in real values; encrypt with openssl (see README)".
  - Delete the files listed above. `.gitignore`: allow-list only `!.env.enc` and `!.env.example`.
  - Compose: `env_file: .env` for all three services.
- [ ] **Step 5: Verify** — `cd src; docker compose -f docker-compose.dev.yml config --quiet` exits 0;
  `git status` shows the old `.enc`/`.example` deletions and no `.env` staged; `dotnet test` passes.
- [ ] **Step 6: README** — rewrite the env tables/workflow for `src/.env` + `.env.example` + `.env.enc` and the app's
  three files (Task 9 fills the app keys), keep the openssl commands, state production reads the process environment
  (GitHub secrets) and list the production variables (COFFER_ROOT_PATH, JWT_SECRET, COFFER_CONNECTIONSTRING,
  FASTAPI_URL, POSTGRES_*, GOOGLE_CLIENT_IDS, FACEBOOK_*, REDDIT_*, TRUSTED_PROXIES, Manager keys, INTERNAL_API_KEY).
- [ ] **Step 7: Commit** — `build(env): single .env/.env.example/.env.enc in src, forwarded headers from TRUSTED_PROXIES`

### Task 3: Strict auth configuration

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Auth/AuthOptions.cs`, `src/Coffer/Coffer.Tests/Auth/AuthOptionsTests.cs`
- Delete: `src/Coffer/Coffer.ASPNET/Extensions/AuthSettings.cs`
- Modify: `Coffer.Infrastructure/DependencyInjection.cs` (register `AuthOptions` singleton from env),
  `Coffer.ASPNET/Extensions/StartupExtension.cs` (resolve it once at startup so a missing key stops the app),
  `Coffer.Tests/ApiFactory.cs` (`TestEnvironment` sets fake values for every key)

**Interfaces:**
- Produces:
```csharp
public sealed record GoogleAuthOptions(IReadOnlyList<string> ClientIds);
public sealed record FacebookAuthOptions(string AppId, string AppSecret, string RedirectUri, string GraphVersion);
public sealed record RedditAuthOptions(string ClientId, string ClientSecret, string RedirectUri, string UserAgent);
public sealed record AuthOptions(byte[] JwtKey, GoogleAuthOptions Google, FacebookAuthOptions Facebook, RedditAuthOptions Reddit)
{
    public static AuthOptions FromEnvironment(Func<string, string?> read); // read = Environment.GetEnvironmentVariable
}
```
  `FromEnvironment` collects **all** missing names and throws one `InvalidOperationException` listing them
  (`"Missing auth settings: FACEBOOK_APP_ID, REDDIT_CLIENT_SECRET"`); `JWT_SECRET` under 32 UTF-8 bytes →
  `"JWT_SECRET must be at least 32 bytes"`; `GOOGLE_CLIENT_IDS` split on commas, trimmed, empty → missing.
  Keys: `JWT_SECRET, GOOGLE_CLIENT_IDS, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI,
  FACEBOOK_GRAPH_VERSION, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI, REDDIT_USER_AGENT`.

- [ ] **Step 1: Write failing tests** — `All_values_present_loads` (fake dictionary reader, asserts each field);
  `Missing_values_are_all_listed` (two keys missing → message contains both names);
  `Short_jwt_secret_is_rejected` (31-byte secret); `Google_ids_are_split_and_trimmed` (`"a, b"` → `["a","b"]`).
- [ ] **Step 2: Run** `dotnet test --filter AuthOptionsTests` → compile failure.
- [ ] **Step 3: Implement**; register `services.AddSingleton(_ => AuthOptions.FromEnvironment(Environment.GetEnvironmentVariable))`;
  `SetupMiddleware` resolves `AuthOptions` before mapping controllers (fail fast). Set fake values in
  `TestEnvironment` (Facebook redirect `fb123://authorize`, Reddit redirect `com.gelomelo.coffer://oauth/reddit`).
- [ ] **Step 4: Run** full `dotnet test` → pass.
- [ ] **Step 5: Commit** — `feat(auth): strict auth configuration loaded at startup`

### Task 4: Session model (tables, issuer, service, guard)

**Files:**
- Create: `Coffer.Domain/Auth/AuthSession.cs`, `Coffer.Domain/Auth/AuthRefreshToken.cs`, `Coffer.DataAccess/AuthModel.cs`,
  `Coffer.BusinessLogic/Auth/Sessions/AccessTokenIssuer.cs`, `.../SessionService.cs`, `.../SessionGuardCache.cs`,
  `Coffer.BusinessLogic/Auth/OAuth/SecureRandom.cs`, `src/startup/oauth_sessions_migration.sql`,
  `Coffer.Tests/Auth/SessionServiceTests.cs`
- Modify: `Coffer.DataAccess/CofferDbContext.cs` (DbSets + `AuthModel.Configure(modelBuilder)`),
  `Coffer.Infrastructure/DependencyInjection.cs:28-42,78` (JWT validation hardening, register services, drop
  `IJwtService`), `Coffer.ASPNET/Extensions/SuspensionEnforcementMiddleware.cs` (session check),
  `Coffer.Tests/ApiFactory.cs:115-124` (`ClientFor` issues a real session), `Coffer.Tests/TestDb.cs`
  (helper `AddSession(User)`), `DevLoginService.cs` (temporarily `IssueAsync` → returns access token only; full shape in Task 5)
- Delete: `Services/JwtService.cs`, `Services.Interfaces/IJwtService.cs`

**Interfaces:**
- Entities (snake_case tables `auth_sessions`, `auth_refresh_tokens`):
```csharp
public class AuthSession { Guid Id; Guid UserId; DateTime CreatedAt; DateTime LastUsedAt; DateTime ExpiresAt; DateTime? RevokedAt; string? RevokeReason; }
public class AuthRefreshToken { Guid Id; Guid SessionId; string TokenHash; DateTime CreatedAt; DateTime ExpiresAt; DateTime? ConsumedAt; }
```
  FK `user_id` → users (cascade), `session_id` → auth_sessions (cascade); unique index on `token_hash`; index on
  `user_id`.
- `SecureRandom.Token() -> string` (32 bytes base64url), `SecureRandom.Sha256Hex(string) -> string`.
- `AccessTokenIssuer(AuthOptions, IClock)`: `Issue(Guid userId, Guid sessionId) -> (string Token, DateTime ExpiresAt)`;
  `public static TokenValidationParameters ValidationParameters(byte[] key)` used by the JwtBearer setup
  (ValidAlgorithms `[HS256]`, RequireExpirationTime, RequireSignedTokens, ClockSkew 30 s, issuer/audience
  `coffer.backend`, `NameClaimType`/map so `ClaimTypes.NameIdentifier` still carries `sub` as today).
- `public sealed record SessionTokens(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken);`
- `ISessionService`:
  - `Task<SessionTokens> IssueAsync(Guid userId)`
  - `Task<SessionTokens> RefreshAsync(string refreshToken)` — throws `MarketplaceException.Unauthorized("invalidRefreshToken", "Your session has ended. Sign in again.")` for every failure
  - `Task RevokeByRefreshTokenAsync(string refreshToken, string reason)` (no-op when unknown)
  - `Task RevokeAsync(Guid sessionId, string reason)`
  - `Task RevokeAllForUserAsync(Guid userId, string reason)`
  - `Task<bool> IsActiveAsync(Guid sessionId)`
- `SessionGuardCache` (singleton over `IMemoryCache`): `bool? Get(Guid sid)`, `Set(Guid sid, bool active)` (10 s),
  `Evict(Guid sid)`; `RevokeAsync`/`RevokeAllForUserAsync`/reuse evict.
- Middleware: authenticated user token without a parseable `sid`, or `!IsActiveAsync(sid)` → 401
  `{ message: "Your session has ended. Sign in again.", code: "sessionRevoked" }` (checked before the deleted/suspended checks).
- `RefreshAsync` algorithm (pinned):
  1. hash; load token + session + user (`AsNoTracking`).
  2. none → fail. `ConsumedAt != null` → `RevokeAsync(session, "reuse")`, log warning `"Refresh token reuse on session {SessionId}"`, fail.
  3. session revoked, `session.ExpiresAt <= now`, `token.ExpiresAt <= now`, or user `DeletedAt != null` → fail.
  4. `ExecuteUpdateAsync(t => t.Id == id && t.ConsumedAt == null, set ConsumedAt = now)`; 0 rows → same as step 2.
  5. insert new token (expires `min(now + 14 d, session.ExpiresAt)`), set `session.LastUsedAt = now`, delete this
     session's consumed tokens older than 1 day, return new pair.
- Migration SQL (idempotent, in a transaction): drop/re-add `users_provider_check` as
  `CHECK (provider IN ('google','facebook','reddit','github'))`; `CREATE TABLE IF NOT EXISTS auth_sessions(...)`,
  `auth_refresh_tokens(...)` with the FKs/indexes above, `timestamp without time zone` like other tables.

- [ ] **Step 1: Write failing tests** (`SessionServiceTests`, using `TestDb` + fixed `IClock` fake from
  `TestServices.cs` if present, else a local one):
  - `Issue_stores_only_the_hash` — DB `token_hash == Sha256Hex(refresh)` and no column equals the raw token.
  - `Refresh_rotates_and_old_token_stops_working` — refresh(A) → B; refresh(A) fails.
  - `Reuse_of_consumed_token_revokes_session` — refresh(A) → B; refresh(A) fails; refresh(B) fails;
    `IsActiveAsync(sid) == false`; `RevokeReason == "reuse"`.
  - `Second_consume_loses_the_race` — two contexts both read A, both call refresh: exactly one returns tokens, the
    other throws, session revoked.
  - `Idle_expiry` (clock +15 d) and `Absolute_expiry` (refresh every 10 d until day 61) fail.
  - `Deleted_user_cannot_refresh`.
  - `Revoke_all_for_user_revokes_every_session`.
  - API-level (in the same file, `ApiFactory`): `Token_without_sid_is_rejected` (hand-made HS256 token, valid
    signature, no `sid` → 401 `sessionRevoked`), `Revoked_session_token_is_rejected`,
    `Token_signed_with_other_algorithm_is_rejected` (HS512 with same key → 401), `Expired_access_token_is_rejected`.
- [ ] **Step 2: Run** `dotnet test --filter SessionServiceTests` → compile failure.
- [ ] **Step 3: Implement** entities, mapping, migration, `SecureRandom`, issuer, service, cache, middleware change,
  DI (`ISessionService` scoped, `AccessTokenIssuer` singleton, `SessionGuardCache` singleton), JwtBearer uses
  `AccessTokenIssuer.ValidationParameters(options.JwtKey)`. `ApiFactory.ClientFor(user)` = `IssueAsync` through a
  scope of `Services` → bearer = access token. Manager JWT (`ManagerTokens`) unchanged.
- [ ] **Step 4: Run** full `dotnet test` → all pass (existing API tests now go through real sessions).
- [ ] **Step 5: Commit** — `feat(auth): server-side sessions with rotating hashed refresh tokens`

### Task 5: Refresh/logout endpoints, shared registration, Google, GitHub removal, rate limits

**Files:**
- Create: `Coffer.BusinessLogic/Auth/OAuth/PendingRegistrationStore.cs`, `ProviderIdentity.cs`, `SignInService.cs`,
  `GoogleIdTokenValidator.cs`, `Coffer.ASPNET/Extensions/AuthRateLimits.cs`, `Coffer.Tests/Auth/GoogleSignInTests.cs`,
  `Coffer.Tests/Auth/SessionApiTests.cs`
- Modify: `Coffer.ASPNET/Controllers/AuthController.cs` (rewrite), `Coffer.Infrastructure/DependencyInjection.cs`,
  `Coffer.ASPNET/Extensions/StartupExtension.cs` (`AddRateLimiter`, `UseRateLimiter` after forwarded headers),
  `AccountDeletionService.cs:142-147` (revoke all sessions inside the transaction, reason `account_deleted`),
  `DevLoginService.cs` (returns `SessionTokens`), `Coffer.ASPNET` dev-login controller response,
  `Coffer.Tests/UnitSecurityTests.cs:~113` (GitHub secret test removed), `DevLoginAndCountryFilterTests.cs`
  (token shape)
- Delete: `Services/GithubService.cs`, `Services.Interfaces/IGithubService.cs`, `Services/TempTokenService.cs`,
  `Services.Interfaces/ITempTokenService.cs`

**Interfaces:**
- `public sealed record ProviderIdentity(string Provider, string Subject, string? Email, string? DisplayName, string? AvatarUrl);`
- `PendingRegistrationStore` (singleton, `IMemoryCache` + lock): `string Put(ProviderIdentity)` (returns
  `SecureRandom.Token()`, TTL 10 min), `ProviderIdentity? Take(string id)` (atomic get+remove).
- `IGoogleIdTokenValidator.ValidateAsync(string idToken) -> Task<ProviderIdentity>` — wraps
  `GoogleJsonWebSignature.ValidateAsync` with `Audience = options.Google.ClientIds`; rejects `IssuedAtTimeSeconds`
  older than 10 minutes (via `IClock`); `Email` only when `EmailVerified`; throws `ProviderSignInException` on any failure.
- `public sealed class ProviderSignInException : Exception` (message is internal/loggable, never returned).
- `public sealed record SignInResult(string Status, SessionTokens? Tokens, string? RegistrationId);` —
  `Status` is `"signedIn"` or `"registrationRequired"`.
- `ISignInService`:
  - `Task<SignInResult> CompleteAsync(ProviderIdentity identity)` — existing non-deleted user → suspended?
    throw `MarketplaceException(Forbidden, SuspensionService.SuspendedCode, ...)` (same body as today) : `IssueAsync`;
    else `Put` → `registrationRequired`.
  - `Task<SessionTokens> RegisterAsync(string registrationId, string username, string country)` — `Take` first
    (null → `MarketplaceException.Validation("invalidRegistrationSession", "Your sign-in expired. Sign in again.")`);
    insert via `IUsersRepository.InsertUserAsync(new UserRequired(identity.Provider, identity.Subject, username,
    identity.Email ?? "", country, identity.AvatarUrl, UserRole.User))`; unique violation (`DbUpdateException`) →
    `MarketplaceException.Conflict("userAlreadyExists", "This account is already registered. Sign in instead.")`;
    keep whatever username/country validation `InsertUserAsync`/`UserRequired` already does.
- Controller (all `[AllowAnonymous]`, `[EnableRateLimiting(...)]`):
  - `POST api/auth/google/validate { idToken }` → `SignInResult` JSON (`status`, `accessToken`,
    `accessTokenExpiresAt`, `refreshToken`, `registrationId`, nulls omitted); validator failure →
    `ApiError(400, "providerSignInFailed", "Sign-in failed. Try again.")`.
  - `POST api/auth/register { registrationId, username, country }` → `SessionTokens`.
  - `POST api/auth/refresh { refreshToken }` → `SessionTokens` (401 on failure).
  - `POST api/auth/logout { refreshToken? }` → 204; revokes by refresh token if given and by the caller's `sid` if a
    valid access token is present (reason `logout`).
  - `GET api/auth/currentUser` unchanged.
  - GitHub endpoints and `google/register` removed.
- Rate limits (`AuthRateLimits.Add(services)`): policy `"auth"` fixed window 20/min, policy `"auth-refresh"` 60/min,
  both partitioned by `HttpContext.Connection.RemoteIpAddress`; rejection 429 JSON
  `{ message: "Too many sign-in attempts. Wait a minute and try again.", code: "tooManyAuthRequests" }`.
  Tests need a way to lift limits: limits read from `AuthRateLimits.PermitPerMinute` static settable in tests or the
  factory overrides the options — implementer's choice, but the rate-limit test must run with the real numbers.

- [ ] **Step 1: Write failing tests**
  - `GoogleSignInTests` (fake `IGoogleIdTokenValidator` via `ApiFactory.Overrides`):
    `Existing_user_gets_tokens`, `New_identity_gets_registration_id`, `Register_creates_user_and_tokens`,
    `Register_handle_is_single_use` (second call → 400 `invalidRegistrationSession`, one user in DB),
    `Suspended_user_gets_403_and_no_tokens`, `Invalid_token_is_providerSignInFailed`,
    `Deleted_user_identity_registers_fresh` (deleted row has tag subject, so lookup misses),
    `Registration_never_matches_by_email` (existing user with same e-mail, different subject → registrationRequired).
  - Validator unit tests with Google library seam not possible offline → test the `iat` rule and `email_verified`
    rule on a small pure helper `GoogleIdTokenValidator.Accept(GoogleJsonWebSignature.Payload, DateTime now)`.
  - `SessionApiTests`: `Refresh_endpoint_rotates`, `Logout_revokes_session_and_access_token_stops_working`,
    `Logout_with_unknown_token_is_204`, `Account_deletion_revokes_sessions`, `Github_endpoints_are_gone` (404),
    `Auth_endpoints_are_rate_limited` (21st `google/validate` within a minute from one client → 429
    `tooManyAuthRequests`), `Dev_login_returns_session_tokens`.
- [ ] **Step 2: Run** `dotnet test --filter "GoogleSignInTests|SessionApiTests"` → failures.
- [ ] **Step 3: Implement** the above; delete GitHub app login and temp-token code; DI registrations.
- [ ] **Step 4: Run** full `dotnet test` → pass. `cd src/Coffer/Coffer.ReactNative; npm run gen:errors; npm run check:errors` → clean.
- [ ] **Step 5: Commit** — `feat(auth): shared sign-in/registration flow, refresh/logout, rate limits; drop GitHub app login`

### Task 6: Facebook (OIDC code flow + PKCE + nonce)

**Files:**
- Create: `Coffer.BusinessLogic/Auth/OAuth/OAuthTransactionStore.cs`, `FacebookOAuthClient.cs`,
  `Coffer.Tests/Auth/FakeHttp.cs`, `Coffer.Tests/Auth/TestJwks.cs`, `Coffer.Tests/Auth/FacebookSignInTests.cs`
- Modify: `AuthController.cs`, `DependencyInjection.cs` (`AddHttpClient<IFacebookOAuthClient, FacebookOAuthClient>(c => c.Timeout = 15 s)`)

**Interfaces:**
- `public sealed record OAuthTransaction(string Id, string Provider, string State, string? Nonce, string? CodeVerifier, DateTime CreatedAt);`
- `OAuthTransactionStore` (singleton): `OAuthTransaction Create(string provider, bool withNonceAndPkce)`,
  `OAuthTransaction? Take(string id)` (atomic, 10-minute TTL).
- `public sealed record OAuthStart(string TransactionId, string AuthorizeUrl, string RedirectUri);`
- `IFacebookOAuthClient`:
  - `string AuthorizeUrl(OAuthTransaction t)` → `https://www.facebook.com/{ver}/dialog/oauth?client_id=…&redirect_uri=…&response_type=code&scope=openid%20email%20public_profile&state=…&nonce=…&code_challenge=…&code_challenge_method=S256`
    (challenge = base64url(SHA-256(ASCII verifier)), all values URL-encoded).
  - `Task<ProviderIdentity> CompleteAsync(OAuthTransaction t, string code)` — POST form to
    `https://graph.facebook.com/{ver}/oauth/access_token` (`client_id`, `client_secret`, `redirect_uri` from config,
    `code_verifier`, `code`); read `id_token`; validate with `JsonWebTokenHandler.ValidateTokenAsync`:
    `ValidIssuer "https://www.facebook.com"`, `ValidAudience AppId`, `ValidAlgorithms [RS256]`, keys from JWKS
    `https://www.facebook.com/.well-known/oauth/openid/jwks/` (cached 24 h; on unknown `kid` refetch at most once per
    5 min), lifetime with 2-min skew, then `nonce` claim must equal `t.Nonce` (ordinal). Identity: `sub`, `email`
    (as given), `name`, `picture`. Any failure → `ProviderSignInException`.
- Controller: `POST api/auth/facebook/start` → `OAuthStart`; `POST api/auth/facebook/complete { transactionId, code, state }`
  → `Take` (null → 400 `providerSignInFailed`); provider mismatch or `CryptographicOperations.FixedTimeEquals` state
  mismatch → 400 `providerSignInFailed`; else `SignInService.CompleteAsync` → `SignInResult`.

- [ ] **Step 1: Write failing tests** (fake handler answers token endpoint + JWKS; `TestJwks` makes an RSA key,
  its JWKS JSON and signs ID tokens with chosen claims):
  `Start_builds_url_from_server_config` (asserts every query parameter, `code_challenge == S256(verifier)`, redirect
  equals config), `Happy_path_new_user_needs_registration`, `Token_request_carries_verifier_and_configured_redirect`,
  `Wrong_nonce_fails`, `Wrong_audience_fails`, `Wrong_issuer_fails`, `Expired_token_fails`,
  `Hs256_token_signed_with_public_key_bytes_fails` (alg confusion), `Unknown_kid_fails_after_one_refetch`,
  `State_mismatch_fails_and_consumes_transaction`, `Replayed_transaction_fails`,
  `Transaction_from_other_provider_fails`, `Malformed_token_response_fails_cleanly`,
  `Logs_never_contain_code_or_tokens` (capture `ILogger` output; assert the code / id_token strings absent).
- [ ] **Step 2: Run** `dotnet test --filter FacebookSignInTests` → failures.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** full `dotnet test` → pass; `npm run check:errors` clean.
- [ ] **Step 5: Commit** — `feat(auth): Facebook sign-in (OIDC code flow, PKCE S256, nonce, JWKS verification)`

### Task 7: Reddit (authorization code + state, confidential client)

**Files:**
- Create: `Coffer.BusinessLogic/Auth/OAuth/RedditOAuthClient.cs`, `Coffer.Tests/Auth/RedditSignInTests.cs`
- Modify: `AuthController.cs`, `DependencyInjection.cs` (`AddHttpClient<IRedditOAuthClient, RedditOAuthClient>(c => c.Timeout = 15 s)`)

**Interfaces:**
- `IRedditOAuthClient`:
  - `string AuthorizeUrl(OAuthTransaction t)` → `https://www.reddit.com/api/v1/authorize.compact?client_id=…&response_type=code&state=…&redirect_uri=…&duration=temporary&scope=identity`
  - `Task<ProviderIdentity> CompleteAsync(string code)` — POST `https://www.reddit.com/api/v1/access_token`
    (Basic `client_id:client_secret`, form `grant_type=authorization_code`, `code`, configured `redirect_uri`,
    header `User-Agent`), then GET `https://oauth.reddit.com/api/v1/me` (bearer + UA) → `id` (required, non-empty),
    `name` → DisplayName, `icon_img` (strip query) → Avatar, Email null; then best-effort POST
    `https://www.reddit.com/api/v1/revoke_token` (`token`, `token_type_hint=access_token`, Basic auth), failures
    ignored. Any other failure → `ProviderSignInException`.
- Controller: `POST api/auth/reddit/start`, `POST api/auth/reddit/complete` — same shape/rules as Facebook.

- [ ] **Step 1: Write failing tests:** `Start_builds_url_from_server_config`, `Happy_path_existing_user_signed_in`
  (identity subject = Reddit `id`, not `name`), `Token_request_uses_basic_auth_configured_redirect_and_user_agent`,
  `Access_token_is_revoked_after_use`, `State_mismatch_fails`, `Replayed_transaction_fails`,
  `Reddit_error_response_fails_cleanly` (`{"error":"invalid_grant"}`), `Reddit_me_failure_fails_cleanly` (500),
  `Missing_id_fails`.
- [ ] **Step 2: Run** `dotnet test --filter RedditSignInTests` → failures.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** full `dotnet test` → pass.
- [ ] **Step 5: Commit** — `feat(auth): Reddit sign-in (authorization code, state, confidential client)`

### Task 8: Dev seed providers

**Files:**
- Modify: `DevSeedValidator.cs:60`, `DevSeedData.cs:41-42`, `src/.env` + `src/.env.example` seed users,
  `Coffer.Tests/DevSeed/DevSeedTests.cs`, README dev-seed "Your own account" paragraph.

- [ ] **Step 1: Write failing test** `Seed_accepts_google_facebook_reddit_github_and_rejects_others`
  (`"twitter"` → problem `users[0].provider must be one of "google", "facebook", "reddit", "github".`).
- [ ] **Step 2: Run** `dotnet test --filter DevSeedTests` → fail.
- [ ] **Step 3: Implement**; `DevSeedData.Provider` default becomes `"google"`, doc comment lists the four. `.env.example` placeholder users: mix of `google`, `facebook`, `reddit`, `github`
  (the admin-like first user stays `github` with `YOUR_GITHUB_USER_ID`). Real `src/.env` seed data unchanged except
  the placeholder `seed-github-*` users of others may stay (github is allowed from the seed).
- [ ] **Step 4: Run** full `dotnet test` → pass.
- [ ] **Step 5: Commit** — `feat(devseed): seed users may use google, facebook, reddit or github`

### Task 9: App env, app.config.ts, HTTPS-only Android

**Files:**
- Create: `Coffer.ReactNative/src/utils/env_check.ts`, `src/const/env.ts`, `app.config.ts`,
  `plugins/with_network_security.js`, `.env`, `.env.example`, `tests/env_check.test.ts`
- Delete: `Coffer.ReactNative/app.json`
- Modify: `src/const/authAccessConfiguration.ts` (re-export from env: `webGoogleClientId`, `facebookAppId`,
  `authScheme`; drop the Android ids and `githubClientId`), `src/const/backendAccessConfiguration.ts:10-12`

**Interfaces:**
- `env_check.ts`: `export type AppEnv = { backendUrl: string; googleWebClientId: string; facebookAppId: string; authScheme: string };`
  `export function checkEnv(raw: Record<keyof AppEnvKeys, string | undefined>, isDev: boolean): AppEnv` where the keys
  are `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_FACEBOOK_APP_ID`,
  `EXPO_PUBLIC_AUTH_SCHEME`. Empty/whitespace → `throw new Error("Missing EXPO_PUBLIC_X in Coffer.ReactNative/.env")`
  (first missing name, in that order). `!isDev` and backend URL not `https://` →
  `Error("EXPO_PUBLIC_BACKEND_URL must use https:// outside development")`. Backend URL normalised to end with `/`.
- `env.ts`: `export const env = checkEnv({ EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL, ... }, __DEV__);`
  (literal accesses — required for inlining).
- `app.config.ts`: exports the former `app.json` object, `scheme` = `EXPO_PUBLIC_AUTH_SCHEME`, Android
  `intentFilters` data `[{ scheme: AUTH_SCHEME }, { scheme: "fb" + FACEBOOK_APP_ID }]`, plugin
  `"./plugins/with_network_security.js"` appended; throws `Missing EXPO_PUBLIC_… in Coffer.ReactNative/.env` for the
  two values it uses.
- `with_network_security.js` (`withAndroidManifest` + `withDangerousMod` from `expo/config-plugins`):
  main manifest `<application android:usesCleartextTraffic="false" android:networkSecurityConfig="@xml/network_security_config">`;
  writes `android/app/src/main/res/xml/network_security_config.xml`:
  `<network-security-config><base-config cleartextTrafficPermitted="false"/></network-security-config>` and
  `android/app/src/debug/res/xml/network_security_config.xml`:
  base-config cleartext false + `<domain-config cleartextTrafficPermitted="true">` for `10.0.2.2`, `localhost`,
  `127.0.0.1`; also removes `usesCleartextTraffic="true"` from `android/app/src/debug/AndroidManifest.xml` if prebuild
  put it there (the debug XML grants exactly those hosts).
- `.env`: `EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:5141`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=652829495328-7n61l38u1h20q7bnl469pr1i0s68khrv.apps.googleusercontent.com`,
  `EXPO_PUBLIC_FACEBOOK_APP_ID=change-me`, `EXPO_PUBLIC_AUTH_SCHEME=com.gelomelo.coffer`. `.env.example`: same keys,
  placeholders + one comment each.

- [ ] **Step 1: Write failing tests** (`tests/env_check.test.ts`): all present → normalised object; each missing key
  → error naming it; whitespace counts as missing; `http://` allowed when `isDev`, rejected when not; `https://`
  accepted when not dev.
- [ ] **Step 2: Run** `npm run test:unit` → fails (module missing).
- [ ] **Step 3: Implement** the files above; `backendAxios` `baseURL: env.backendUrl`.
- [ ] **Step 4: Verify** `npm run test:unit` pass; `npx tsc --noEmit` clean; `npx expo config --type public` prints
  the scheme and both intent-filter schemes; with `EXPO_PUBLIC_FACEBOOK_APP_ID` blanked
  (`$env:EXPO_PUBLIC_FACEBOOK_APP_ID=" "; npx expo config`) it fails naming the variable;
  `npx expo prebuild --platform android --no-install --clean` then the two XML files exist with the content above and
  the main manifest has `usesCleartextTraffic="false"` (prebuild regenerates the git-ignored `android/` folder —
  expected).
- [ ] **Step 5: Commit** — `feat(app): required env config, app.config.ts, HTTPS-only Android network policy`

### Task 10: App sessions (storage, single-flight refresh, logout)

**Files:**
- Create: `src/utils/refresh_gate.ts`, `src/utils/session.ts`, `tests/refresh_gate.test.ts`
- Modify: `src/utils/token_store.ts` (rewrite), `src/const/backendAccessConfiguration.ts` (interceptors),
  `src/const/endpoints.ts` (`authRefresh: "api/auth/refresh"`, `authLogout: "api/auth/logout"`, `authRegister:
  "api/auth/register"`, `facebookStart/Complete`, `redditStart/Complete`; remove GitHub + `googleRegister`),
  `src/app/settings/index.tsx:44-60`, `src/components/account/suspended_screen.tsx:42-46`,
  `src/utils/account_deleted.ts`, `src/components/login/dev_login.tsx:45`, `src/hooks/token_storage.ts`,
  `src/hooks/startup.tsx` (export the `QueryClient` through a module singleton `src/utils/query_client.ts` so logout
  can `clear()` it — create that file)

**Interfaces:**
- `token_store.ts`: `type StoredSession = { accessToken: string; refreshToken: string; accessTokenExpiresAt: string }`;
  `getAccessToken(): Promise<string | null>`, `getRefreshToken(): Promise<string | null>`,
  `saveSession(s: StoredSession): Promise<void>`, `clearSession(): Promise<void>` (also deletes legacy
  `coffer_jwt` and the AsyncStorage `jwt` key). SecureStore only; no AsyncStorage fallback. `getToken` callers switch
  to `getAccessToken`.
- `refresh_gate.ts`: `export function createRefreshGate(refresh: () => Promise<string>): () => Promise<string>` —
  concurrent callers share one in-flight promise; after it settles the next call starts a new refresh.
- `session.ts`: `signInWith(tokens)` = `saveSession` + update `useUserStore.setToken`; `signOut({ callServer })` =
  best-effort `POST authLogout { refreshToken }` (no interceptor retry), `clearSession`, `queryClient.clear()`,
  Google `signOut` (ignore errors), `useUserStore.setToken(null)`. Used by settings logout, suspended screen,
  account deleted, refresh failure.
- Interceptor: request → `Authorization: Bearer <access>`; response 401 where `config._retried` not set and URL not in
  `{authRefresh, authLogout, *validate, *complete, *start, authRegister}` → `await gate()` (gate calls
  `POST authRefresh` with a bare axios instance, saves the new session, returns access token) → retry once with
  `_retried = true`. Gate rejection → `signOut({ callServer: false })` once (guard flag like `signOutDeletedAccount`),
  navigate to `/`, reject original error. Existing 401 `accountDeleted` and 403 suspension handling stay first.

- [ ] **Step 1: Write failing tests** (`tests/refresh_gate.test.ts`): `single_flight_refresh` (5 concurrent calls,
  refresh function called once, all get the same token); `next_call_after_settle_refreshes_again`;
  `refresh_failure_signs_out_once` — gate rejection propagates to all 5 waiters and the injected `onFail` callback
  (add optional second param `onFail?: () => void` to `createRefreshGate`) runs exactly once.
- [ ] **Step 2: Run** `npm run test:unit` → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** `npm run test:unit`, `npx tsc --noEmit`, `npx eslint src` clean; `Grep` for `getToken(`,
  `removeToken(`, `setToken(` from `token_store` in `src/` returns nothing.
- [ ] **Step 5: Commit** — `feat(app): access/refresh session storage, single-flight refresh, server logout`

### Task 11: App sign-in UI (Google, Facebook, Reddit)

**Files:**
- Create: `src/utils/auth_redirect.ts`, `tests/auth_redirect.test.ts`
- Modify: `src/hooks/auth.ts` (rewrite), `src/app/login.tsx`, `src/components/settings/user_info_card.tsx:52-53,121`,
  `src/i18n/locales/{en,hu}/auth.json` (`facebook`, `reddit`, remove `github`; `login.cancelled`, `login.failed`),
  `src/i18n/locales/{en,hu}/settings.json` (`profile.provider.facebook/reddit`; keep `github` for seeded users),
  `src/components/login/dev_login.tsx` comment, `README.md` (Coffer.ReactNative env + provider setup section)

**Interfaces:**
- `auth_redirect.ts`: `export type AuthRedirect = { kind: "code"; code: string; state: string } | { kind: "cancelled" } | { kind: "error"; error: string };`
  `export function parseAuthResult(result: { type: string; url?: string }, expectedState: string, redirectUri: string): AuthRedirect`
  — non-`success` → cancelled; URL not starting with `redirectUri` → error `"redirect_mismatch"`; `error` param →
  `access_denied` → cancelled, others → error; `state` ≠ expected → error `"state_mismatch"`; missing code → error.
  `expectedState` = the `state` query parameter of the `authorizeUrl` the backend returned.
- `hooks/auth.ts`: `useSignIn({ onRegistrationRequired(provider), onSignedIn() })` returning
  `{ google(): Promise<void>; facebook(): Promise<void>; reddit(): Promise<void>; register(username, country): Promise<void>; cancelRegistration(): Promise<void>; busy: boolean }`.
  Browser providers: `POST {provider}Start` → `WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri)` →
  `parseAuthResult` → `POST {provider}Complete { transactionId, code, state }`. Validate/complete answer
  `signedIn` → `signInWith(tokens)`, toast, `navigate(ROUTES.ROOT)`; `registrationRequired` → keep
  `registrationId`, open the form. `register` → `POST authRegister`. Errors: toast with `apiErrorText`, no
  `console.error` of objects (short string only). `GoogleSignin.configure` called once at module load with
  `env.googleWebClientId`.
- `login.tsx`: three outline buttons (Google image as today; `FontAwesome name="facebook-official"`;
  `FontAwesome name="reddit"`), disabled while `busy`.

- [ ] **Step 1: Write failing tests** (`tests/auth_redirect.test.ts`): `parse_auth_result_handles_error_and_cancel`
  (dismiss → cancelled; `error=access_denied` → cancelled; `error=server_error` → error), `state_mismatch`,
  `redirect_mismatch`, `happy_path_returns_code_and_state`, `missing_code_is_error`.
- [ ] **Step 2: Run** `npm run test:unit` → fails.
- [ ] **Step 3: Implement**; remove `useGitHubAuth`, GitHub button, `githubsignin.png` usage on login (keep the
  asset for the profile card of seeded GitHub users).
- [ ] **Step 4: Verify** `npm run test:unit`, `npx tsc --noEmit`, `npx eslint src`, `npm run check:i18n`,
  `npm run check:errors` all clean.
- [ ] **Step 5: Commit** — `feat(app): sign in with Google, Facebook or Reddit; GitHub removed`

### Task 12: Security audit report and final verification

**Files:**
- Create: `docs/security/2026-11-24-oauth-audit.md`
- Modify: `README.md` (link to the report; "Settings added for this version" table updated), `SECURITY_AUDIT_REPORT.md`
  (one line at the top pointing to the new report for OAuth/sessions)

- [ ] **Step 1: Re-read the final code** of `AuthController`, `SignInService`, session service, middleware,
  provider clients, `UsersController`/`UserPermissionService` (mass-assignment of `Provider`, `ProviderUserId`,
  `Email`, `Role` — if a user can change them, add a failing test in `SessionApiTests` or `ApiSecurityTests`, fix,
  commit as its own step), CORS (`StartupExtension.cs:19-29`), error filter for stack traces in Production, app auth
  code.
- [ ] **Step 2: Write the report** in the style of `SECURITY_AUDIT_REPORT.md`:
  1. *Actions for your human partner* (Facebook app setup and redirect, Reddit approval + web app + redirect,
     production GitHub secrets list incl. `TRUSTED_PROXIES`, run `oauth_sessions_migration.sql`, encrypt both
     `.env` files with openssl, `npx expo prebuild --clean`, everyone signs in again, existing GitHub app users
     locked out).
  2. *Findings and fixes* table (severity 🔴🟠🟡🔵, finding, fix, test name).
  3. *Checklist answers*: every item of the pasted sections 2–12 verbatim as a row, answer (Yes / No → fixed /
     N/A with reason / Accepted risk with reason), evidence (file:line or test name). Native-app N/A reasoning for
     cookies, CSRF, browser tabs/back navigation stated once and referenced.
  4. *Residual risks* (Google no nonce → 10-min `iat` window; in-memory transactions = single API instance;
     Reddit no PKCE → confidential client + state + backend-held transaction; lost refresh response → forced re-login;
     Android Custom Tabs keep provider cookies).
- [ ] **Step 3: Final verification** — `cd src; dotnet test Coffer/Coffer.Tests/Coffer.Tests.csproj` (all pass);
  `cd Coffer/Coffer.PythonService; python -m unittest discover -s tests`; `cd ../Coffer.ReactNative; npx tsc --noEmit;
  npx eslint src; npm run test:unit; npm run check:i18n; npm run check:errors`. Paste the summary lines into the
  report's header.
- [ ] **Step 4: Commit** — `docs(security): OAuth and session audit report`
