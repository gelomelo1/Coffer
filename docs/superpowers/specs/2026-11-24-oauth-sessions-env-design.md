# Facebook + Reddit sign-in, server-side sessions, env cleanup, OAuth security audit

## Why

- **Env cleanup.** The configuration files have piled up: a production-style `src/.env` and `.env.enc`, a dev
  `.env.development` with its `.enc` and `.example`, and five data paths that all sit under one root. Your human
  partner wants a single development file set and one root path. The mobile app needs its own env files too. Today
  its backend URL silently falls back to a hard-coded LAN IP, and its OAuth ids are hard-coded constants.
- **Providers.** App sign-in moves to **Google, Facebook and Reddit**. GitHub leaves the app. Coffer.Manager keeps
  GitHub device-flow sign-in for administrators, unchanged (your human partner's decision).
- **Security.** The three OAuth flows must meet a high standard on both the backend and the app. The full checklist
  is the one your human partner pasted: OAuth flow, OIDC validation, account linking, tokens, sessions, API, frontend,
  CORS/CSRF, errors, races and attack scenarios. Findings are fixed in code, and an audit report lists every item
  and its outcome.
- **Sessions.** Today's app token is a JWT that lives **one year** and cannot be revoked. Log out only deletes it on
  the phone. Your human partner chose a full session model: short access tokens, rotating refresh tokens with
  reuse detection, and server-side revocation. ASP.NET Core Identity was considered and dropped (see Approaches).

## Goals

1. `src/.env`, `src/.env.example`, `src/.env.enc` are the only env files in `src/`; there is no `.env.development*`
   and no production-style `.env`. A single `COFFER_ROOT_PATH` replaces `IMAGESTORE_PATH`, `ICONSTORE_PATH`,
   `VECTORSTORE_PATH`, `MODELS_PATH` and `IMAGECHECK_TEMP_PATH` in the backend **and** the Python service.
2. `Coffer.ReactNative/.env`, `.env.example`, `.env.enc`: backend URL, OAuth ids, scheme. The app **fails at start**
   with a clear error naming the missing variable — no defaults, no fallback URL.
3. Sign in / register with Google, Facebook, Reddit through the same validate → (login | register) flow the app
   uses for Google today. GitHub app sign-in is gone everywhere (backend endpoints, service, app UI, i18n, seed,
   DB allow-list); Manager GitHub sign-in is untouched.
4. Session model: 15-minute access JWT bound to a server-side session; rotating, hashed, single-use refresh tokens;
   reuse detection; revocation on logout, account deletion and refresh-token reuse.
5. Every checklist item answered in an audit report (`docs/security/2026-11-24-oauth-audit.md`), each finding either
   fixed (with a test) or explained (not applicable / accepted risk / needs your human partner).

## Non-goals

- Linking several providers to one Coffer account. Today one account = one provider identity; that stays. (So there
  is no linking/unlinking endpoint, and "remove your only login method" cannot happen.)
- Migrating existing GitHub-registered users to another provider. Their rows stay; they can no longer sign in (see
  Consequences).
- Changing Coffer.Manager's sign-in or its `.env` files.
- Production deployment changes and any `.env.production` file: your human partner supplies production values through
  GitHub secrets. The code reads them from the process environment (see §1). The deploy workflow is not touched; the
  hand-over lists every variable production now needs.
- iOS-specific work beyond what the shared code gives (the project builds Android).
- Cookies/CSRF machinery: the app is a native client using bearer tokens, no cookies (stated and justified in the
  report rather than built).

## Anti-goals (a failure even if it "works")

- Any account matched or merged **by e-mail**. Identity is `(provider, provider subject)` only.
- Any OAuth parameter (redirect URI, scopes, client id) that the app can influence on the backend token exchange.
- Refresh tokens or provider tokens stored in plain text in the DB, written to logs, or returned in error bodies.
- A path where a revoked session, a deleted account, or a reused refresh token still gets a working access token.
- The app silently starting with a missing env value.
- The development seed or dev login breaking (they keep working, with the new providers).

## Constraints

- Backend: ASP.NET Core 8, EF Core 9 on PostgreSQL, hand-written SQL migrations in `src/startup/`, tests on SQLite
  (`Coffer.Tests`). Built-in `Microsoft.AspNetCore.RateLimiting` is available (no new package).
- App: Expo 54 dev-client builds, `expo-auth-session` / `expo-web-browser` / `expo-crypto` / `expo-secure-store`
  already installed. Google uses `@react-native-google-signin/google-signin` (native; its free API has **no nonce**).
- `EXPO_PUBLIC_*` values are inlined at bundle time only when accessed literally (`process.env.EXPO_PUBLIC_X`).
- `users.provider` has a DB CHECK constraint (`google`, `github`) and a UNIQUE `(provider, provider_user_id)`.
- **Reddit** closed self-service API keys in Nov 2025: a new app needs approval under the Responsible Builder Policy.
  Reddit has **no PKCE**, no OIDC, no e-mail. The code ships regardless; your human partner applies for access.
- **Facebook** supports the OIDC authorization-code flow with **PKCE S256 + nonce**, returning a signed ID token
  (JWKS `https://www.facebook.com/.well-known/oauth/openid/jwks/`, issuer `https://www.facebook.com`). Facebook does
  not assert e-mail verification.
- `.env.enc` files are OpenSSL-encrypted with a password only your human partner has — the builder cannot create
  them; your human partner runs the encrypt command.
- Git rules: no branches, no pushes, milestone commits, no AI co-author trailers.

## Approaches (session model)

1. **Custom session service on the existing JWT bearer setup — chosen.** Short access JWT with a `sid` claim; a
   `auth_sessions` + `auth_refresh_tokens` table pair; atomic rotation via a conditional update; reuse revokes the
   session; middleware rejects tokens of revoked sessions. Trade-off: our code, so it needs thorough tests.
2. **ASP.NET Core Identity + `MapIdentityApi`.** Built for local password accounts; we have none. Would move
   `users` onto `AspNetUsers` in the hand-written schema, still needs hand-written external-login glue, and its
   refresh tokens are not stored, so no reuse detection or per-session revoke. Dropped.
3. **OpenIddict (embedded OAuth server).** Standard and has rotation, but a heavy framework and many new tables for
   one native client. Dropped.

Provider flows (builder's calls, stated to your human partner without objection):

- **Google:** keep the native SDK + backend ID-token verification.
- **Facebook:** in-app browser, OIDC code flow + PKCE S256 + state + nonce, backend exchanges the code and verifies the
  ID token against Facebook's JWKS. (Native Facebook SDK rejected: on Android it yields only a classic access token,
  no verifiable ID token, and adds a native module.)
- **Reddit:** in-app browser, authorization code + state, registered as a **web app** so the secret stays on the
  backend; scope `identity` only.

## Design

### 1. Backend env (`src/`)

- Files: `src/.env` (git-ignored, real values), `src/.env.example` (placeholders, committed), `src/.env.enc`
  (encrypted `.env`, committed). Delete `src/.env.development`, `.env.development.enc`, `.env.development.example`,
  and the old production-style `src/.env` / `.env.enc` — the current `.env.development` content becomes the new
  `.env` (most up-to-date values), with the changes below. `.gitignore` allow-list becomes `!.env.enc` and
  `!.env.example` only.
- `COFFER_ROOT_PATH=/app` replaces the five paths. A single static resolver in `Coffer.BusinessLogic`
  (e.g. `AppPaths`) derives: images `{root}/data/images`, icons `{root}/data/icons`, vectors `{root}/data/vectors`,
  temp `{root}/data/temp`, models `{root}/models`. Every `Env.GetString("IMAGESTORE_PATH")`-style read goes through
  it; a missing root throws the same style of `InvalidOperationException` as today. The Python service gets the same
  derivation (one helper module). `DEV_SEED_IMAGE_DIR` stays separate (it's a dev input folder, not app data; it may
  default to `{root}/data/examples` when unset — builder's call, keep it explicit in `.env`).
- `docker-compose.dev.yml`: `env_file: .env`. `StartupExtension`: Development loads `../../.env` when it exists
  (in Docker the values already come from `env_file`). Production loads no file: the values come from the process
  environment (GitHub secrets). The old `/var/www/coffer/.env.production` load goes. The existing behaviour
  "missing value → `InvalidOperationException`" is what catches a missing secret.
- **Strict configuration (your human partner's decision):** every auth key is required for **every** provider. A
  missing value stops startup. Until real Facebook/Reddit credentials exist, your human partner puts placeholder
  values in `.env`; that provider's sign-in then fails with the generic `providerSignInFailed`. No per-provider
  enable switches.
- `TRUSTED_PROXIES` (optional, comma-separated IPs/CIDRs, e.g. the Docker bridge network nginx connects from):
  `UseForwardedHeaders` (X-Forwarded-For/Proto) trusts only these. Unset = no forwarded headers are believed and the
  socket IP is the client IP (dev). Production sets it, because nginx sits in front.
- New backend keys (in `.env` and `.env.example`, with comments saying where each value comes from):
  `GOOGLE_CLIENT_IDS` (now **required**, the hard-coded default goes), `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`,
  `FACEBOOK_REDIRECT_URI` (`fb{APP_ID}://authorize`), `FACEBOOK_GRAPH_VERSION` (e.g. `v21.0`), `REDDIT_CLIENT_ID`,
  `REDDIT_CLIENT_SECRET`, `REDDIT_REDIRECT_URI` (`com.gelomelo.coffer://oauth/reddit`), `REDDIT_USER_AGENT`.
  `GITHUB_CLIENT_SECRET` leaves the app login; the Manager keeps `GITHUB_CLIENT_ID` / `COFFER_MANAGER_GITHUB_CLIENT_ID`
  / `COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS`.
- Startup validation: an `AuthOptions` loaded once at startup that throws with the list of missing auth keys
  (fail closed, like the dev-seed guard). Tests set fake values.
- README "Environment configuration" section rewritten for the new files.

### 2. App env (`Coffer.ReactNative/`)

- Files `.env`, `.env.example`, `.env.enc` (same OpenSSL commands; `.env` is git-ignored by the root rules).
- Keys: `EXPO_PUBLIC_BACKEND_URL` (dev: `http://10.0.2.2:5141`), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  `EXPO_PUBLIC_FACEBOOK_APP_ID`, `EXPO_PUBLIC_AUTH_SCHEME` (`com.gelomelo.coffer`). All required.
- `src/const/env.ts` reads each value with a literal `process.env.EXPO_PUBLIC_…` access and throws
  `Error("Missing EXPO_PUBLIC_… in Coffer.ReactNative/.env")` on empty. `authAccessConfiguration.ts` and
  `backendAccessConfiguration.ts` read from it; no fallback URL.
- `app.json` becomes `app.config.ts` (same content) so the scheme and the Facebook redirect scheme
  `fb{EXPO_PUBLIC_FACEBOOK_APP_ID}` come from env and land in the Android intent filters; it also throws on a
  missing value, so a build can't be produced without them.
- **HTTPS only (your human partner's decision).** Release builds allow no cleartext traffic at all. Debug builds
  (the dev client with the Metro dev server on the emulator) may use plain HTTP **only** to the emulator's host:
  `10.0.2.2`, `localhost`, `127.0.0.1`. A local config plugin (`plugins/with_network_security.js`, using
  `expo/config-plugins`, no new package) writes it:
  - main manifest: `usesCleartextTraffic="false"`, `networkSecurityConfig` → `cleartextTrafficPermitted="false"`;
  - debug source set (`src/debug/res/xml/network_security_config.xml`, overriding the main one): cleartext permitted
    for those three hosts only.
  The hand-edited `usesCleartextTraffic="true"` in today's git-ignored `android/` folder disappears with
  `npx expo prebuild --clean`. `env.ts` also refuses an `http://` backend URL outside `__DEV__`. A physical phone
  on the LAN can no longer reach a plain-HTTP dev backend; that's intended.
- The unused `androidGoogleClientId` / `androidBuildGoogleClientId` constants go (Google matches Android clients by
  package + SHA-1; the app only passes the web client id). Reddit's client id is **not** in the app: the backend
  builds the authorize URL (below), so the app never needs it. Your human partner asked for "every auth id" in the app
  env; this is the builder's call — only ids the app actually uses — and is called out in the hand-over.

### 3. Provider sign-in

Common shape (all three end in the same place):

```
validate → { status: "signedIn", accessToken, refreshToken, accessTokenExpiresAt }
         | { status: "registrationRequired", registrationId }
register { registrationId, username, country } → { accessToken, refreshToken, accessTokenExpiresAt }
```

- **Pending registration**: after a provider identity is verified and no user exists, the backend stores the
  **verified identity** (provider, subject, e-mail, e-mail-verified flag, avatar URL, display name) — never the raw
  provider token — under a 256-bit `RandomNumberGenerator` handle, 10-minute TTL, **single use**: `register` removes
  it atomically before doing anything else (a second call with the same handle fails). Replaces `TempTokenService`.
- **Identity**: `(provider, subject)` only. E-mail is stored for display/contact only; Google's is stored only when
  `email_verified` is true, Facebook/Reddit e-mails are stored as given (Reddit: none — empty string, as GitHub
  without public mail was). No lookup or merge by e-mail anywhere. Profile data from the provider is used only at
  registration; later sign-ins never overwrite local profile fields.
- **Existing-user path**: deleted users are already excluded by `GetUserByLogin`; suspended users get the existing
  403 body and no tokens.
- Concurrent registration of the same identity: the UNIQUE `(provider, provider_user_id)` constraint decides; the
  loser gets `userAlreadyExists` (mapped from the unique-violation, not a generic 400).

**Google** (`POST api/auth/google/validate { idToken }`): `GoogleJsonWebSignature.ValidateAsync` with audience
= `GOOGLE_CLIENT_IDS` (signature, `iss`, `aud`, `exp` checked by the library), plus: reject tokens issued more than
10 minutes ago (`iat`) to shrink the replay window, since the native SDK can't carry a nonce.

**Facebook and Reddit** — backend-held authorization transactions:

1. `POST api/auth/{facebook|reddit}/start` (anonymous, rate-limited) → backend creates a transaction: `transactionId`
   (256-bit), `state` (256-bit, different value), for Facebook also `nonce` and a PKCE `code_verifier` (kept on the
   server; only the S256 `code_challenge` goes out). Stored in memory, 10-minute TTL. Response:
   `{ transactionId, authorizeUrl, redirectUri }`, where `authorizeUrl` is built entirely from server config
   (client id, exact redirect URI, scopes `openid email public_profile` / `identity`, `state`, `nonce`,
   `code_challenge`, `code_challenge_method=S256`; Reddit `duration=temporary`).
2. App opens `authorizeUrl` with `WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri)`, parses the result URL,
   **checks the returned `state` equals the one in the URL it opened**, handles `error=` results (cancel/denied) as
   a normal cancellation.
3. `POST api/auth/{provider}/complete { transactionId, code, state }` → backend **takes** the transaction (atomic
   remove — single use, replay of the same callback fails), compares `state` in constant time, then:
   - Facebook: exchange `code` at `https://graph.facebook.com/{ver}/oauth/access_token` with `client_id`,
     `client_secret`, configured `redirect_uri`, `code_verifier`; verify the returned `id_token`: RS256 only,
     signature against Facebook JWKS (cached via `ConfigurationManager<OpenIdConnectConfiguration>` from
     `https://www.facebook.com/.well-known/openid-configuration/`, auto-refresh on unknown `kid`), `iss`, `aud`
     = app id, `exp`/`iat` with ≤ 2 min skew, `nonce` = the transaction's nonce. Identity = `sub`.
   - Reddit: exchange `code` at `https://www.reddit.com/api/v1/access_token` (HTTP Basic client id:secret,
     configured `redirect_uri`, `User-Agent` = `REDDIT_USER_AGENT`), then `GET https://oauth.reddit.com/api/v1/me`;
     identity = Reddit's immutable account `id` (never the username); then revoke the Reddit access token
     (`/api/v1/revoke_token`) — Coffer doesn't need it afterwards.
   - The `transactionId` never appears in a URL, so an app that intercepts the redirect (custom-scheme hijack) gets
     `code` + `state` but cannot complete the transaction.
4. Same validate result shape as Google; `register` is shared (`POST api/auth/register`), the provider comes from the
   pending registration, not from the request.

Provider HTTP calls go through `IHttpClientFactory` named clients with timeouts; provider errors are logged by type /
error code only (never tokens, codes, secrets or raw bodies) and answered with a generic
`providerSignInFailed` error.

**Removed**: `api/auth/github/*`, `GithubService`, `IGithubService`, `GITHUB_CLIENT_SECRET` for the app, app GitHub
button/hook/endpoints/i18n strings/assets reference. Manager `GithubDeviceFlowClient` stays.

**DB**: migration `src/startup/oauth_sessions_migration.sql` — replace `users_provider_check` with
`provider IN ('google','facebook','reddit','github')` (`github` stays allowed so existing rows and Manager-adjacent
data don't violate it; the app can no longer create such users), plus the session tables below.

### 4. Sessions

Tables (migration + EF entities + `CofferDbContext` mapping; SQLite-compatible for tests):

- `auth_sessions`: `id` (uuid, = JWT `sid`), `user_id` (FK users), `created_at`, `last_used_at`, `expires_at`
  (absolute: created + 60 days), `revoked_at`, `revoke_reason` (`logout`, `reuse`, `account_deleted`, `expired`).
- `auth_refresh_tokens`: `id`, `session_id` (FK), `token_hash` (SHA-256 hex of the raw token, UNIQUE), `created_at`,
  `expires_at` (idle: created + 14 days, capped by the session's absolute expiry), `consumed_at`.

Tokens:

- Access JWT: HS256, `iss`/`aud` `coffer.backend`, `sub` = user id, `sid` = session id, `jti`, `iat`/`nbf`, `exp`
  = 15 minutes. No e-mail or provider claims. Validation: `ValidAlgorithms = [HS256]`, `RequireExpirationTime`,
  `RequireSignedTokens`, `ClockSkew` 30 s; startup refuses a `JWT_SECRET` shorter than 32 bytes.
- Refresh token: 32 random bytes, base64url, returned once; only its hash is stored.

Flows:

- **Issue** (login/register/dev login): new session + first refresh token, in one transaction.
- **Refresh** `POST api/auth/refresh { refreshToken }` (anonymous, rate-limited): hash → find row. Not found →
  401 `invalidRefreshToken`. Found and `consumed_at` set → **reuse**: revoke the session (`reuse`), log a warning
  with the session id, 401. Session revoked/expired, token expired, or user deleted → 401. Otherwise mark consumed
  with a **conditional update** (`WHERE id = @id AND consumed_at IS NULL`; 0 rows = lost a race = treated as reuse),
  insert the next token, bump `last_used_at`, return a new pair. Suspended users may refresh (the suspension
  middleware still blocks every endpoint except the suspension status, so the "Your account is suspended" screen
  keeps working).
- **Logout** `POST api/auth/logout { refreshToken }` (anonymous allowed): revoke the token's session. Also revokes
  the `sid` session when called with a valid access token. Always 204 (no oracle).
- **Account deletion**: revokes all the user's sessions in the same transaction.
- **Enforcement**: the existing `SuspensionEnforcementMiddleware` (renamed or extended to a session/account guard)
  rejects a user token whose `sid` is missing, unknown, revoked or expired with 401 `sessionRevoked`. The lookup is
  cached in memory ≤ 10 s; revocations evict the cache entry in-process.
- Expired rows: deleted opportunistically on refresh/issue for that user (no background job needed).

### 5. App session handling

- `token_store.ts` keeps access token, refresh token and expiry in SecureStore only. The AsyncStorage fallback and
  the legacy-JWT migration go (old one-year tokens have no `sid` and would be rejected anyway); legacy keys are
  deleted.
- `backendAccessConfiguration.ts` interceptor: on 401, if the request wasn't already retried and isn't an auth
  endpoint, run a **single-flight** refresh (one shared promise for all concurrent 401s), retry the request once
  with the new token. Refresh fails → clear tokens, clear the React Query cache, go to sign-in. Never loops.
- Logout (settings, suspended screen, deleted account): call `api/auth/logout` best-effort, clear tokens, clear the
  React Query cache, Google sign-out as today.
- `index.tsx` keeps its "has token → load current user" check; it now goes through the interceptor.
- No token is logged: remove the `console.error` calls that print provider responses/errors objects in auth code
  (log a short message only).

### 6. Rate limiting

`Microsoft.AspNetCore.RateLimiting` fixed-window per client IP on `api/auth/*` (e.g. 20/min for start/complete/
validate/register, 60/min for refresh) → 429 with the usual error body. Dev endpoints unaffected (dev only). The
client IP is `RemoteIpAddress` after `UseForwardedHeaders` with `TRUSTED_PROXIES` (§1), so behind nginx each user
gets their own bucket and a spoofed `X-Forwarded-For` from anywhere else is ignored.

### 7. Dev seed and dev login

- Seed users may use `google`, `facebook`, `reddit` **and `github`**. Your human partner approved this explicitly:
  creating users from the `.env` seed is the only place a `github` user may still be created (the app's sign-in
  can't). Seeded GitHub users sign in through the dev login. The validator rejects any other provider.
  `.env.example` placeholders show a mix of providers.
- Dev login issues tokens through the session service.

### 8. Audit

The checklist is the one your human partner pasted into the conversation (sections 2–12: OAuth flow, OIDC, account
registration/linking, tokens, sessions, backend API, frontend, CORS/CSRF/browser, errors, concurrency, attack
scenarios). The report reproduces every item with its answer, so it doubles as the stored copy of the checklist.

After implementation, go through the pasted checklist section by section against the final code (backend + app),
try the attack scenarios as tests where possible (code replay, state mismatch, nonce mismatch, wrong `aud`/`iss`,
alg confusion, refresh reuse, concurrent refresh, revoked session, deleted account, registration-handle replay,
IDOR on user update), and write `docs/security/2026-11-24-oauth-audit.md`: actions for your human partner, findings
table (severity, finding, fix/status, test), and a per-checklist-item answer table. Anything outside OAuth/session
scope that turns up is listed, not fixed.

## Consequences your human partner should know

- Existing GitHub app users can't sign in any more (rows kept). Your own seed account needs a Google/Facebook/Reddit id.
- Everyone signs in again once (old one-year tokens are rejected).
- A new dev build is needed: `npx expo prebuild --clean`, then `npm run android` (intent filter for the Facebook
  scheme, HTTPS-only network config). The dev backend URL becomes `http://10.0.2.2:5141` (emulator only). EAS cloud
  builds don't see the git-ignored `.env`; the `EXPO_PUBLIC_*` values then have to be EAS environment variables.
- Production (GitHub secrets) needs: `COFFER_ROOT_PATH` instead of the five paths, `GOOGLE_CLIENT_IDS`, the Facebook
  and Reddit keys, `TRUSTED_PROXIES`. `GITHUB_CLIENT_SECRET` can go. Run `oauth_sessions_migration.sql` on the
  production DB before deploying.
- Provider consoles: Facebook app (Facebook Login, valid redirect `fb{APP_ID}://authorize`, PKCE allowed); Reddit
  app approval + "web app" with redirect `com.gelomelo.coffer://oauth/reddit`.
- You run the two `openssl enc` commands for `src/.env.enc` and `Coffer.ReactNative/.env.enc`.

## Left to the builder

Class/file names, exact rate-limit numbers, cache implementation, test layout, and whether pending transactions and
registrations share one in-memory store (single API instance assumed — noted in the audit as a scaling limit).

## Addendum (2026-11-25): Discord replaces Reddit, GitHub returns for every user

**Why.** Reddit stopped accepting new Data API access requests on 31 Oct 2026 and ends public API access in March 2027
(secondary sources; Reddit's own post not found), so Reddit sign-in can never work for Coffer. Your human partner chose
Discord instead, and GitHub sign-in back for every user (not only Coffer.Manager administrators).

**Design (approved).** Both use the existing backend-held browser flow (start → in-app browser → complete):

- **Discord**: authorization code + PKCE S256 + state, confidential client (secret on the backend), scopes
  `identify email`. Identity = Discord user id (never the username); e-mail kept only when Discord says `verified`.
  Redirect `discord-<APP_ID>:/authorize/callback` (Discord's mobile guide). The Discord token is revoked after use.
- **GitHub**: authorization code + PKCE S256 + state, confidential client, scope `user:email` only (narrowed on 2026-11-25: every provider asks only for name, e-mail and avatar). Identity =
  numeric GitHub id (never the login); e-mail kept only when it is the primary verified address. Redirect
  `com.gelomelo.coffer://oauth/github`. Only that token is deleted after use (the grant stays, so no new consent each
  time). The Manager's device flow is unchanged and may use the same OAuth app. Existing GitHub users sign in again.
- **Reddit removed everywhere** (client, endpoints, button, env keys, tests). DB provider check:
  `google`, `facebook`, `discord`, `github` (the not-yet-run migration is edited in place). Seed providers likewise.
- **Env**: backend `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` (all required); app `EXPO_PUBLIC_DISCORD_APP_ID` (intent filter scheme
  `discord-<id>`). The audit report, README and redirect deep-link handling are updated.

## Addendum (2026-11-25, 2): Google through a backend callback

**Why.** The native SDK the app used (`@react-native-google-signin`, free "Original" module) wraps Google's deprecated
legacy Android Sign-In and can't send a nonce. Your human partner chose Google through the same backend-held browser
flow as the other providers. Google disables custom-URI-scheme redirects for Android OAuth clients by default (Oct 2023),
so Google redirects to the **backend**, not the app.

**Design (approved).**
- Google Cloud "Web application" client. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (the API's
  `/api/auth/google/callback`; https, or http only on localhost — dev uses `adb reverse tcp:5141 tcp:5141`),
  `GOOGLE_APP_REDIRECT_URI` (e.g. `com.gelomelo.coffer://oauth/google`). `GOOGLE_CLIENT_IDS` goes.
- `POST google/start` → transaction (state, nonce, PKCE verifier); authorize URL
  `https://accounts.google.com/o/oauth2/v2/auth` (scope `openid email profile`, S256, `prompt=select_account`).
- `GET google/callback?state&code|error` → takes the transaction by state (single use), exchanges the code at
  `https://oauth2.googleapis.com/token` (client secret + verifier), verifies the ID token (RS256, Google JWKS
  `https://www.googleapis.com/oauth2/v3/certs`, iss `https://accounts.google.com`/`accounts.google.com`, aud, exp,
  nonce), keeps only the verified identity (e-mail only if `email_verified`) for 10 minutes, then 302 to
  `GOOGLE_APP_REDIRECT_URI?state=…` (`&error=…` on denial or failure). No code or token reaches the app.
- `POST google/complete {transactionId, state}` → takes the stored identity (single use, state compared) →
  `SignInService.CompleteAsync`. Sessions are created only here.
- Removed: `google/validate`, `GoogleIdTokenValidator` (and the 10-minute `iat` rule, replaced by the nonce), the app's
  `@react-native-google-signin` package and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Same Google Cloud project = same `sub`,
  so existing Google users keep their accounts. Development switches Google off with a warning when unset, like the rest.

**Amendment (review, 2026-11-25).** The callback also creates a one-time handle and redirects with `?state=…&handle=…`;
`google/complete` requires it. Without it, whoever started a sign-in (and so knew the transaction id and the state)
could collect the sign-in of anyone who finished the forwarded Google link. `GOOGLE_APP_REDIRECT_URI` must be an app
scheme without `?`/`#`.
