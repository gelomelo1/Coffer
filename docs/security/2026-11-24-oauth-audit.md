# Coffer – OAuth 2.0 / OIDC and session security audit

Date: 2026-11-24 · Branch: `development` · Scope: app sign-in (Google, Facebook, Reddit), registration, sessions and
tokens, in the backend (`Coffer.ASPNET`, `Coffer.BusinessLogic`, `Coffer.DataAccess`, `Coffer.Infrastructure`) and the
mobile app (`Coffer.ReactNative`). Coffer.Manager's GitHub device-flow sign-in for administrators was kept unchanged by
decision and is only mentioned where it shares code (JWT secret, middleware).

Method: code review against the checklist below (sections 2–12), then each finding was fixed test-first: a failing
test reproducing it, then the fix. Attack scenarios were reproduced as automated tests against the real API
(in-process test server, SQLite, fake provider endpoints with real RSA-signed ID tokens), not against live providers.

Final verification (all green):

| Suite | Result |
|---|---|
| `dotnet test src/Coffer/Coffer.Tests` | 633 passed, 0 failed |
| `python -m unittest discover -s tests` (Coffer.PythonService) | 43 passed |
| `npm run test:unit` (Coffer.ReactNative) | 164 passed |
| `npx tsc --noEmit` | no errors |
| `npx eslint src` | 0 errors (47 warnings, all pre-existing) |
| `npm run check:i18n`, `npm run check:errors` | passed / up to date |

---

## 1. Actions you must take (cannot be done in code)

| # | Action | Why |
|---|---|---|
| A1 | **Facebook**: create the Facebook app, enable Facebook Login, add the redirect `fb<APP_ID>://authorize`, then put `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` / `FACEBOOK_REDIRECT_URI` into `src/.env` and `EXPO_PUBLIC_FACEBOOK_APP_ID` into `Coffer.ReactNative/.env`. | Placeholders (`change-me`) are in the files; Facebook sign-in answers "Sign-in failed" until then. |
| A2 | **Reddit**: apply for API access (Responsible Builder Policy, required for new apps since Nov 2025), then create a **web app** with the redirect `com.gelomelo.coffer://oauth/reddit`; set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` and your username in `REDDIT_USER_AGENT`. | Reddit sign-in can't work before approval. |
| A3 | **Encrypt both env files**: `openssl enc -aes-256-cbc -salt -pbkdf2 -in .env -out .env.enc` in `src/` and in `src/Coffer/Coffer.ReactNative/`, then commit the two `.env.enc`. | The encryption password is yours; the old `src/.env.enc` was removed with the old files. |
| A4 | **Run** `src/startup/oauth_sessions_migration.sql` on the development database, and on production before the next deploy. | New tables `auth_sessions`, `auth_refresh_tokens`; provider check now allows `facebook`/`reddit`. |
| A5 | **Production (GitHub secrets)**: add `COFFER_ROOT_PATH=/app`, `GOOGLE_CLIENT_IDS`, the four `FACEBOOK_*` and four `REDDIT_*` values, `TRUSTED_PROXIES` (the network nginx connects from, e.g. `172.18.0.0/16`); remove `IMAGESTORE_PATH`, `ICONSTORE_PATH`, `VECTORSTORE_PATH`, `MODELS_PATH`, `IMAGECHECK_TEMP_PATH` and `GITHUB_CLIENT_SECRET` (the Manager keeps `GITHUB_CLIENT_ID` / `COFFER_MANAGER_*`). Production no longer reads `/var/www/coffer/.env.production`; `deploy.yml` still downloads `.env.production.zip` — switch it to the secrets. | Every auth value is required: the API refuses to start without them. |
| A6 | **New app build**: `npx expo prebuild --clean`, then `npm run android`. The dev backend URL is `http://10.0.2.2:5141` (emulator only). EAS cloud builds need the `EXPO_PUBLIC_*` values as EAS environment variables. | New intent filter (`fb<id>`), HTTPS-only network policy; the hand-edited `usesCleartextTraffic="true"` in the git-ignored `android/` folder disappears. |
| A7 | Tell users: everyone signs in again once; accounts registered with GitHub can no longer sign in to the app (their data stays; GitHub users can still come from the dev seed). | Old one-year tokens have no session and are rejected; GitHub app sign-in was removed. |
| A8 | Move or delete the local backup of the old env files (its location was given with this report; it is outside the repository). | It holds the previous `src/.env`, `src/.env.development` and `src/.env.enc` (secrets), in a temporary folder that may be cleared. |

---

## 2. Findings and fixes

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low

| Sev | Finding (before) | Fix (after) | Proving tests |
|---|---|---|---|
| 🔴 | App JWTs lived **one year**, carried e-mail and provider, and could not be revoked: logout only deleted the token on the phone; a copied token worked for a year. | 15-minute HS256 access token with a session id (`sid`); server-side `auth_sessions` checked on every request; rotating, hashed, single-use refresh tokens (14 days idle, 60 days absolute); reuse of a consumed refresh token revokes the session; logout and account deletion revoke on the server. | `SessionServiceTests.*`, `SessionGuardApiTests.*`, `SessionApiTests.Logout_*`, `SessionApiTests.Account_deletion_revokes_sessions` |
| 🔴 | `POST api/Users` let an in-app `Admin` create an account bound to **any** provider identity (pre-hijacking: the victim's next sign-in lands in it); `PUT api/Users/{id}` let an `Admin` move any account to another identity (takeover). | Generic user create removed (accounts are created only by signing in); provider and provider id can't change through the API for anyone. | `AccountIdentityTests.*` |
| 🟠 | GitHub flow: the backend never checked `state` (only the client did) and accepted any client-supplied `code` + `code_verifier` → login CSRF / code injection possible; GitHub sign-in is removed now. Facebook/Reddit got a backend-held transaction instead. | `api/auth/{provider}/start` creates a transaction (256-bit id, state, nonce, PKCE verifier) kept on the server; `complete` takes it atomically (single use), checks provider and state (constant time). The id never appears in a URL. | `FacebookSignInTests.State_mismatch_*`, `Replayed_transaction_fails`, `Transaction_from_other_provider_fails`, `RedditSignInTests.*` |
| 🟠 | Pending registration kept the **raw provider token** (Google ID token / GitHub access token) under a GUID for 10 minutes; the handle was removed only after success (double submit raced). | Only the verified identity is kept, under a 256-bit single-use id, taken atomically. | `GoogleSignInTests.Register_handle_is_single_use`, `Unknown_registration_id_fails` |
| 🟠 | Registration had **no server-side validation** of username or country (only the app checked). | Username `^[a-zA-Z0-9._-]{1,40}$` and unique, country two capital letters; checked before the registration is used up. | `GoogleSignInTests.Invalid_input_is_rejected_without_consuming_the_handle`, `Taken_username_is_rejected` |
| 🟠 | No rate limiting on any sign-in endpoint. | Per-IP fixed windows: 20/min for sign-in steps, 60/min for refresh/logout → 429 `tooManyAuthRequests`. Behind nginx the real IP comes from `X-Forwarded-For`, trusted only from `TRUSTED_PROXIES`. | `SessionApiTests.Auth_endpoints_are_rate_limited`, `Refresh_has_its_own_larger_limit`, `ForwardedHeadersTests.*` |
| 🟡 | Google ID tokens: e-mail stored without checking `email_verified`; no bound on token age; audience fell back to a hard-coded client id when unset. | Signature/issuer/audience/expiry by Google's library, plus: `iat` within the last 10 minutes, e-mail kept only when verified, audience strictly from `GOOGLE_CLIENT_IDS` (required). | `GoogleIdTokenRulesTests.*`, `AuthOptionsTests.*` |
| 🟡 | User-token validation did not restrict algorithms; default 5-minute clock skew. | `ValidAlgorithms = [HS256]`, signed tokens and expiry required, 30 s skew, key ≥ 32 bytes enforced at startup. | `SessionGuardApiTests.Unsigned_token_is_rejected`, `Token_signed_with_other_algorithm_is_rejected`, `Expired_access_token_is_rejected`, `AuthOptionsTests.Short_jwt_secret_is_rejected` |
| 🟡 | App: backend URL silently fell back to a hard-coded LAN address; OAuth ids hard-coded; Android allowed plain HTTP everywhere, release builds included. | Required `.env` values (the app and the build stop with the variable's name); `https://` required outside development; release builds allow no cleartext, debug builds only to `10.0.2.2`/`localhost`/`127.0.0.1`. | `env_check.test.ts`; prebuild output checked (main: cleartext false; debug: three hosts only) |
| 🟡 | Tokens could fall back to **AsyncStorage** (unencrypted, included in Android backups). | SecureStore only; legacy keys deleted. | code review (`src/utils/token_store.ts`) |
| 🟡 | Auth responses had no cache headers. | `Cache-Control: no-store` on every `api/auth/*` response. | `SessionApiTests.Auth_responses_are_not_cached` |
| 🟡 | A suspended user's request to log out would have been blocked with 403 (server session not ended). | `POST api/auth/logout` is exempt from the suspension block, like the suspension status. | `SessionApiTests.Suspended_user_can_still_log_out` |
| 🟠 | (Found in the final review.) A failed token refresh signed the person out whatever the cause — offline, timeout, 5xx, 429 — and left the server session orphaned. | Only a definitive 401/400 from the refresh signs out; otherwise the tokens stay and the request reports the refresh's own failure (retry page). | `session_over.test.ts`, `refresh_gate.test.ts` |
| 🟡 | (Found in the final review.) The Facebook/Reddit redirect deep links had no route: cancel/deny could leave the person on an "unmatched route" screen. | `+native-intent.tsx` keeps `oauth/reddit` and `authorize` links on the sign-in screen. Check once on a device. | `native_intent.test.ts` |
| 🟡 | (Found in the final review.) `JWT_SECRET` from `.env.example` (public) passed the 32-byte check. | A secret starting with `change-me` stops startup. | `AuthOptionsTests.Placeholder_jwt_secret_is_rejected` |
| 🔵 | Google sign-in requested `offlineAccess` (a server auth code nobody used). | Removed; only `profile` and `email`. | code review (`src/utils/google_signin.ts`) |
| 🔵 | App logged whole provider error/response objects with `console.error`. | Short fixed messages only; tokens never logged. Backend logs provider failures by reason only. | `FacebookSignInTests.Logs_never_contain_code_or_tokens` |
| 🔵 | React Query cache was re-created on every render of the root and never cleared on logout (data of the previous account could be shown). | One cache; cleared on every sign-out. | code review (`src/utils/session.ts`) |
| 🔵 | GitHub client secret was env-only but the GitHub flow logged nothing useful and fell back to a built-in client id. | GitHub app sign-in removed entirely (Manager untouched). | `SessionApiTests.Removed_endpoints_are_gone` |

---

## 3. Checklist answers

**Notes used below.**
- **N1 (native app):** Coffer is an Android app that talks to the API with bearer tokens; there are no cookies, no
  browser session, no tabs and no browser history. Cookie, CSRF, SameSite, tab and back-button items don't apply;
  provider pages open in the system's in-app browser (Custom Tabs).
- **N2 (backend transaction):** Facebook/Reddit `start` creates a server-side transaction (id, state, nonce, PKCE
  verifier; 256-bit CSPRNG values; 10 minutes; single use). The app gets the id and the authorize URL; `complete`
  takes the transaction atomically and checks provider and state.
- **N3 (Google):** native SDK; the backend verifies the ID token. The SDK's free API can't send a nonce.

### 2. OAuth authorization flow

| Item | Answer | Evidence |
|---|---|---|
| Is the state parameter generated using a cryptographically secure random generator? | Yes: 32 bytes `RandomNumberGenerator`. (Google: no redirect/state — N3.) | `SecureRandom.Token`, `OAuthTransactionStore.Create` |
| Is state validated on the backend? | Yes, constant-time, against the transaction's state (the app checks it too). | `AuthController.CompleteBrowserSignIn`; `State_mismatch_*` tests |
| Is state bound to the browser session that initiated authentication? | Bound to the server transaction whose id only the initiating app instance holds (N1: no browser session). | N2 |
| Is state single-use? | Yes: the transaction is removed on the first `complete`, success or not. | `State_mismatch_fails_and_consumes_transaction` |
| Can an attacker replay an OAuth callback? | No: second `complete` → `providerSignInFailed`, no second code exchange. | `Replayed_transaction_fails` (Facebook, Reddit) |
| Can an OAuth callback initiated in one browser be completed in another? | No: completing needs the transaction id, which is never in a URL; an intercepted code + state is useless. | N2 |
| Is PKCE implemented using the S256 challenge method where supported? | Facebook: yes, S256, verifier server-side. Reddit: not supported by Reddit — confidential client instead. Google: native SDK. | `FacebookOAuthClient.AuthorizeUrl`; `Token_request_carries_verifier_and_configured_redirect` |
| Is the code_verifier securely associated with the original authorization transaction? | Yes: generated and stored in the transaction, never sent to the app. | N2 |
| Are authorization codes exchanged exclusively through the intended backend flow? | Yes: only the backend has the client secrets; the app never exchanges codes. | `FacebookOAuthClient`, `RedditOAuthClient` |
| Are authorization codes rejected when expired or already consumed? | By the providers (one-time codes); our side refuses a consumed transaction before any exchange. | `Replayed_transaction_fails`; `Facebook_error_response_fails_cleanly`, `Reddit_error_response_fails_cleanly` |
| Is the redirect URI validated against an exact allowlist? | Yes: one exact redirect per provider from config, registered with the provider. | `AuthOptions`; `Start_builds_url_from_server_config` |
| Can the redirect URI be manipulated through query parameters or frontend input? | No: built only from server config; the app sends no redirect. | `Start_builds_url_from_server_config`, `Token_request_*` |
| Can the post-login redirect be manipulated to create an open redirect? | No: there is no post-login redirect parameter; the app always goes to its start screen. The app also rejects answers not on its redirect URI. | `auth_redirect.test.ts` `redirect_mismatch` |
| Are OAuth error callbacks handled securely? | Yes: `access_denied` → "cancelled", other errors → "failed"; nothing is sent to the backend. | `parse_auth_result_handles_error_and_cancel` |
| Can multiple concurrent OAuth transactions interfere with one another? | No: each has its own id/state/nonce/verifier. | N2 |
| Can a missing or invalid authorization parameter leave the application in an authenticated state? | No: every failure is `providerSignInFailed` with no session created. | `AssertFailed` checks `AuthSessions` empty in every failure test |

### 3. OpenID Connect and identity validation

| Item | Answer | Evidence |
|---|---|---|
| ID token signatures are cryptographically validated. | Yes: Google (library, Google's keys), Facebook (RS256, Facebook JWKS). Reddit has no ID token. | `GoogleIdTokenValidator`, `FacebookOAuthClient.ValidateAsync` |
| Only explicitly trusted signing algorithms are accepted. | Facebook RS256 only; Google per library (RS256). | `Hs256_token_signed_with_public_key_bytes_fails` |
| The issuer (iss) is validated. | Yes. | `Wrong_issuer_fails` |
| The audience (aud) is validated. | Yes (Google: `GOOGLE_CLIENT_IDS`; Facebook: app id). | `Wrong_audience_fails` |
| The authorized party (azp) is validated when applicable. | Not applicable: single audience values; Google's `aud` is our web client. | — |
| Token expiration (exp) is validated. | Yes (Facebook: 2 min skew). | `Expired_token_fails` |
| Issued-at (iat) is checked where appropriate. | Google: must be within the last 10 minutes (no nonce possible). | `GoogleIdTokenRulesTests` |
| The nonce is generated, stored, and validated correctly. | Facebook: yes (server-side, constant-time). Google: not possible with the free SDK — accepted risk (R1). | `Wrong_nonce_fails` |
| JWKS keys are retrieved from trusted provider metadata. | Facebook's fixed HTTPS JWKS URL; Google via its library. | `FacebookSigningKeys` |
| Key rotation is handled securely. | Unknown `kid` triggers one refetch, at most every 5 minutes; keys refresh every 24 h. | `Rotated_key_is_picked_up_after_refetch`, `Unknown_kid_does_not_hammer_the_key_endpoint` |
| Unknown or unexpected signing keys are rejected. | Yes. | `Unknown_kid_does_not_hammer_the_key_endpoint` |
| Tokens from another provider or application cannot be accepted. | Yes: audience and issuer per provider; transactions can't cross providers. | `Wrong_audience_fails`, `Transaction_from_other_provider_fails` |
| User identity is based on the provider's stable subject identifier (sub) and issuer, not email alone. | Yes: `(provider, sub)` (Reddit: account id, not username). | `Registration_never_matches_by_email`, `Same_subject_from_another_provider_is_another_account`, `Happy_path_existing_user_signed_in_by_account_id` |
| Email verification claims are validated before relying on email ownership. | E-mail is never relied on; Google's is stored only when verified, Facebook's for display only, Reddit gives none. | `Unverified_email_is_not_kept` |
| Untrusted user profile claims cannot override local account data. | Yes: profile claims are used only at registration; later sign-ins change nothing. | `SignInService.CompleteAsync` |
| Attempt to identify whether the backend merely decodes JWTs instead of verifying their signatures. | It verifies. Forged/unsigned/other-key tokens are rejected. | `Unsigned_token_is_rejected`, `Invalid_token_is_providerSignInFailed` |

### 4. Account registration and account linking

| Item | Answer | Evidence |
|---|---|---|
| Can an OAuth identity be linked to an existing local account without proving ownership? | No: there is no linking; an identity only ever reaches the account created for it. | `SignInService` |
| Can matching email addresses automatically merge accounts? | No. | `Registration_never_matches_by_email` |
| Is the provider's email verification status checked? | Yes for Google; e-mail is never used for matching anyway. | `Unverified_email_is_not_kept` |
| Can an attacker link an OAuth identity already associated with another local user? | No (no linking; identity is UNIQUE). | DB `UNIQUE (provider, provider_user_id)` |
| Can one external identity be associated with multiple local accounts? | No: unique constraint; registration refuses an existing identity. | `Register_handle_is_single_use` |
| Is the external identity uniquely constrained in the database? | Yes: `users_provider_provider_user_id_key`. | `coffer.sql` |
| Are concurrent account-linking requests handled safely? | No linking; concurrent registrations: atomic handle + unique constraints, loser gets `userAlreadyExists`/`usernameTaken`. | `SignInService.RegisterAsync` |
| Does linking an additional provider require an authenticated session? | Not applicable: no linking feature. | — |
| Does linking a provider require recent authentication where appropriate? | Not applicable. | — |
| Can an unauthenticated request modify another user's linked providers? | No; and since this audit, not even an in-app Admin can change an account's identity. | `AccountIdentityTests` |
| Can users remove their only authentication method? | Not possible: one provider per account, not removable. | — |
| Can account deletion leave active OAuth sessions or credentials behind? | No: all sessions revoked in the deletion transaction; no provider tokens are stored. | `Account_deletion_revokes_sessions` |
| Can a disabled, banned, or deleted account authenticate through an existing OAuth identity? | Deleted: the identity is replaced on deletion, a new sign-in makes a new account. Suspended: no tokens (403 with reason). | `Suspended_user_gets_403_and_no_tokens`; `AccountDeletionTests` |
| Can changes to provider email addresses cause account duplication or account takeover? | No: e-mail is not part of identity. | — |
| Can an attacker exploit differences between registration and login flows? | No: both end in `SignInService` with the same identity rules. | `SignInService` |
| Simulate scenarios involving two different local users and multiple OAuth identities. | Done: same e-mail/different subject, same subject/different provider, identity rebinding by an Admin. | `Registration_never_matches_by_email`, `Same_subject_from_another_provider_is_another_account`, `AccountIdentityTests` |

### 5. Token security

| Item | Answer | Evidence |
|---|---|---|
| Are tokens generated securely? | Yes: CSPRNG refresh tokens, HS256 JWT with a ≥ 32-byte key. | `SecureRandom`, `AccessTokenIssuer` |
| Are token signing keys protected? | `JWT_SECRET` from the environment/GitHub secrets only, length enforced. | `AuthOptions` |
| Are JWT signing algorithms explicitly restricted? | Yes, HS256. | `AccessTokenIssuer.ValidationParameters` |
| Are token expiration periods reasonable? | Access 15 min; refresh 14 days idle / 60 days absolute. | `SessionService` |
| Are token audiences and issuers validated? | Yes (`coffer.backend`; Manager tokens use `coffer.manager` and a separate scheme). | `DependencyInjection` |
| Are access tokens unnecessarily long-lived? | No (was one year). | finding 🔴1 |
| Are refresh tokens stored securely? | Server: SHA-256 hash only. App: SecureStore (Keystore). | `Issue_stores_only_the_hash`; `token_store.ts` |
| Are refresh tokens hashed at rest where appropriate? | Yes. | `Issue_stores_only_the_hash` |
| Is refresh token rotation implemented where required by the architecture? | Yes, on every refresh. | `Refresh_rotates_and_old_token_stops_working` |
| Are previously rotated refresh tokens rejected? | Yes. | same |
| Is refresh token reuse detected? | Yes: reuse revokes the whole session. | `Reuse_of_consumed_token_revokes_session` |
| Are refresh operations atomic under concurrent requests? | Yes: conditional update — exactly one consumer wins; the loser is treated as reuse. | `A_token_can_be_consumed_only_once` |
| Can revoked tokens still authenticate requests? | No: session checked per request (cache ≤ 10 s, evicted on revoke in-process). | `Revoked_session_token_is_rejected` |
| Can a user continue using old credentials after logout? | No. | `Logout_revokes_session_and_access_token_stops_working` |
| Are refresh tokens revoked when the account is disabled or deleted? | Deleted: yes. Suspended: refresh stays possible by design so the suspension screen works; every other endpoint is blocked (R5). | `Account_deletion_revokes_sessions` |
| Are tokens exposed in URLs, logs, browser storage, error messages, or analytics? | No: tokens travel in JSON bodies/headers only; logs carry reasons only; no analytics. | `Logs_never_contain_code_or_tokens` |
| Can tokens be obtained through unintended API responses? | No: tokens are returned only by sign-in, register, refresh, dev login (Development only). | `AuthController` |

### 6. Session management

| Item | Answer | Evidence |
|---|---|---|
| Is the session identifier rotated after successful authentication? | Every sign-in creates a new session; refresh rotates the refresh token. | `SessionService.IssueAsync` |
| Is session fixation possible? | No: session ids are server-generated at sign-in; nothing client-supplied is adopted. | — |
| Are session expiration rules enforced by the backend? | Yes. | `Idle_expiry`, `Absolute_expiry` |
| Are idle and absolute session expiration handled appropriately? | 14 days idle, 60 days absolute. | same |
| Does logout invalidate the actual server-side session or refresh credentials? | Yes. | `Logout_*` tests |
| Are cookies configured with HttpOnly, Secure, and appropriate SameSite attributes? | N/A — no cookies (N1). | — |
| Is CSRF protection implemented for cookie-authenticated requests? | N/A (N1). | — |
| Can sessions be invalidated after password changes or security-sensitive account changes? | No passwords exist; identity can't change; deletion revokes everything. | — |
| Are sessions invalidated when an account is disabled? | Suspension blocks every request immediately; sessions stay so the suspension screen and logout work (R5). | `SuspensionEnforcementMiddleware` |
| Can multiple browser tabs create inconsistent authentication states? | N/A (N1); multiple requests share one refresh. | `single_flight_refresh` |
| Are sessions isolated between different users and devices? | Yes: one session per sign-in/device; revoking one leaves the others. | `Revoke_by_refresh_token_ends_that_session_only` |
| Can an expired session be restored using stale frontend state? | No: the backend decides; a failed refresh signs out. | `refresh_failure_signs_out_once` |

### 7. Backend API security

| Item | Answer | Evidence |
|---|---|---|
| Is authentication enforced on every protected endpoint? | Yes: route sweep test classifies every route. | `RouteSweepTests` |
| Is authorization independently enforced on the backend? | Yes (permission services, ownership checks — earlier audit). | `SECURITY_AUDIT_REPORT.md` |
| Can changing a user ID in a request access another user's resources? | No (earlier audit tests); user id always from the token. | `BaseController.UserId` |
| Can regular users access administrator endpoints? | No: `api/Admin/*` needs a Manager token. | `ManagerAuthTests` |
| Can user roles or permissions be modified through mass assignment? | Not by regular users. An in-app `Admin` (legacy role, not used by the app) can still edit another user's profile and role through `PUT api/Users/{id}` — listed (R7); its identity can no longer change. | `AccountIdentityTests` |
| Are authorization checks performed using trusted server-side data? | Yes. | — |
| Can an unauthenticated user invoke account-linking or token-management endpoints? | Refresh/logout are anonymous by design and need a valid refresh token; no linking endpoint exists. | `Logout_with_unknown_token_is_204` |
| Are authentication endpoints protected against brute force and abuse? | Yes: rate limits; 256-bit handles. | `Auth_endpoints_are_rate_limited` |
| Is rate limiting implemented where appropriate? | Yes, per real client IP (trusted proxies only). | `ForwardedHeadersTests` |
| Do error responses reveal whether an account exists? | Only to the identity's owner (signed in vs. registration required). `GET api/Users/UserExists/{name}` reveals usernames, which are public profile names. | — |
| Are sensitive authentication operations logged without exposing credentials? | Failures and refresh reuse are logged with reasons/session ids only. | `Logs_never_contain_code_or_tokens` |
| Are state-changing endpoints protected against CSRF when cookie authentication is used? | N/A (N1). | — |
| Are CORS origins explicitly restricted? | Yes: only `http://localhost:8081` (Expo web dev), no credentials. | `StartupExtension` |
| Is wildcard CORS combined with credentialed requests anywhere? | No. | — |
| Are HTTP methods and content types validated appropriately? | Yes: attribute routing per method, JSON bodies. | — |
| Test the backend directly, bypassing all frontend restrictions. | Done: every test above calls the API directly. | — |

### 8. Frontend authentication security

| Item | Answer | Evidence |
|---|---|---|
| Are access and refresh tokens exposed to JavaScript unnecessarily? | In a native app the JS layer must send them; they live in SecureStore, not in JS state beyond the request. | `token_store.ts` |
| Are sensitive credentials stored in localStorage or other insecure persistent storage? | No (AsyncStorage fallback removed). | finding 🟡 |
| Are tokens accidentally logged to the console? | No. | code review |
| Are authentication credentials exposed in URL parameters? | Only the one-time code/state in the redirect, as OAuth requires; never tokens. | — |
| Is the OAuth callback processed only once? | Yes: one `openAuthSessionAsync` result per attempt; server transaction single use. | N2 |
| Does refreshing the callback page cause duplicate processing? | N/A (N1); a replay fails server-side. | `Replayed_transaction_fails` |
| Is the callback URL cleaned after successful processing? | N/A (N1: the in-app browser closes; no history). | — |
| Does the frontend wait for backend authentication confirmation? | Yes: tokens are stored only from the backend's answer. | `hooks/auth.ts` |
| Can users access protected routes by manually entering their URLs? | Screens load data only with a valid token; the API refuses otherwise. | — |
| Does the application correctly handle HTTP 401 and 403 responses? | 401 → one refresh + one retry, else sign-out; 401 `accountDeleted` → sign-out; 403 suspension → suspended screen. | `backendAccessConfiguration.ts` |
| Can multiple simultaneous requests trigger uncontrolled refresh operations? | No: single-flight gate. | `single_flight_refresh` |
| Can failed refresh requests cause infinite retry loops? | No: each request retried at most once; auth endpoints never retried. | `refresh_failure_signs_out_once` |
| Is authentication state cleared correctly after logout? | Yes: server logout, tokens, query cache, Google session. | `session.ts` |
| Can browser back navigation expose previously authenticated content? | N/A (N1); sign-out resets navigation. | — |
| Are cached user-specific API responses cleared after logout? | Yes (`queryClient.clear()`). | `session.ts` |
| Can one user see another user's data after switching accounts? | No: cache cleared on sign-out. | — |
| Is authentication state synchronized between browser tabs? | N/A (N1). | — |
| Can frontend state manipulation bypass backend authorization? | No: every decision is on the backend. | — |

### 9. CORS, CSRF and browser security

| Item | Answer | Evidence |
|---|---|---|
| Are allowed origins explicitly configured? | Yes (one dev origin). | `StartupExtension` |
| Are credentials restricted to trusted origins? | No credentialed CORS at all. | — |
| Are wildcard origins avoided when credentials are enabled? | Yes. | — |
| Are state-changing cookie-authenticated requests protected against CSRF? | N/A (N1). | — |
| Are CSRF tokens validated server-side where required? | N/A (N1). | — |
| Are cookie attributes appropriate for the authentication architecture? | N/A (N1). | — |
| Can cross-origin requests initiate unwanted account linking or logout? | No cookies → a cross-origin request carries no credentials. | — |
| Are security-sensitive responses protected against unintended caching? | Yes: `no-store` on auth responses. | `Auth_responses_are_not_cached` |
| Are authentication responses protected against accidental exposure through browser history or referrer headers? | Tokens are never in URLs. | — |

### 10. Error handling and information disclosure

| Item | Answer | Evidence |
|---|---|---|
| Are OAuth provider errors handled without exposing internal details? | Yes: one generic `providerSignInFailed`. | `*_fails_cleanly` tests |
| Are stack traces hidden from production API responses? | Yes: no developer exception page outside Development. | `StartupExtension` |
| Are access tokens, refresh tokens, authorization codes, and secrets excluded from logs? | Yes. | `Logs_never_contain_code_or_tokens` |
| Are sensitive credentials excluded from frontend telemetry? | No telemetry exists. | — |
| Do error responses reveal internal account existence? | See section 7. | — |
| Are database errors prevented from exposing authentication implementation details? | Unique violations are mapped to `userAlreadyExists`/`usernameTaken`. | `SignInService.RegisterAsync` |
| Are failed authentication attempts logged safely? | Yes, reason only. | `AuthController.SignInFailed` |
| Can malformed OAuth responses cause unhandled exceptions? | No: malformed JSON, missing fields and error statuses become `providerSignInFailed`. | `Malformed_token_response_fails_cleanly`, `Malformed_json_fails_cleanly`, `Missing_id_fails` |
| Are provider outages handled without leaving partial authentication state? | Yes: 15 s timeouts; nothing is stored before the identity is verified. | `Reddit_me_failure_fails_cleanly` |

### 11. Concurrency and race conditions

| Scenario | Result | Evidence |
|---|---|---|
| Multiple refresh requests using the same refresh token | One wins; the other is reuse → session revoked. App sends only one (single flight). | `A_token_can_be_consumed_only_once`, `single_flight_refresh` |
| Multiple OAuth callbacks for the same authorization transaction | First takes the transaction; the rest fail. | `Replayed_transaction_fails` |
| Concurrent account registration with the same external identity | Single-use handle + unique constraint → one account. | `Register_handle_is_single_use` |
| Concurrent account linking and unlinking | N/A (no linking). | — |
| Logout during an active refresh operation | Logout revokes the session; a refresh that finished first yields tokens of a revoked session, rejected on use. | `SessionService.RevokeAsync` |
| Account deletion during an active session | Sessions revoked; deleted-account answer on the next request. | `Account_deletion_revokes_sessions` |
| Password changes while multiple sessions are active | N/A (no passwords). | — |
| Simultaneous login attempts from multiple browser tabs | Separate transactions, separate sessions. | N2 |
| Multiple requests attempting to use an already-consumed authorization code | Refused before reaching the provider. | `Replayed_transaction_fails` |

### 12. Attack scenarios (reproduced as tests)

| Scenario | Outcome | Test |
|---|---|---|
| OAuth login CSRF | Blocked (state + backend transaction) | `State_mismatch_fails_and_consumes_transaction` |
| Authorization code replay | Blocked | `Replayed_transaction_fails` |
| State parameter manipulation | Blocked | `State_mismatch_*` |
| PKCE bypass attempts | Verifier never leaves the server | `Token_request_carries_verifier_and_configured_redirect` |
| Open redirect through callback or return URL | No redirect parameter; app rejects foreign redirects | `redirect_mismatch` |
| Account takeover through email-based account linking | Blocked | `Registration_never_matches_by_email` |
| External identity takeover through incorrect provider validation | Blocked | `Wrong_audience_fails`, `Wrong_issuer_fails`, `Transaction_from_other_provider_fails`, `AccountIdentityTests` |
| Session fixation | Not possible (server-generated sessions) | — |
| Session hijacking using revoked credentials | Blocked | `Revoked_session_token_is_rejected` |
| Refresh token replay | Detected, session revoked | `Reuse_of_consumed_token_revokes_session` |
| JWT signature validation bypass | Blocked | `Unsigned_token_is_rejected`, `Hs256_token_signed_with_public_key_bytes_fails` |
| JWT issuer or audience confusion | Blocked | `Wrong_issuer_fails`, `Wrong_audience_fails` |
| Cross-site request forgery | N/A (N1) | — |
| Cross-origin credential leakage | No credentialed CORS | — |
| Privilege escalation through modified API requests | Identity fields locked; roles only by in-app Admin (R7) | `AccountIdentityTests` |
| IDOR through modified user identifiers | Covered by the earlier audit | `ApiSecurityTests` |
| Authentication bypass through frontend state manipulation | Backend decides | — |
| Authentication race conditions | Handled | section 11 |
| Authentication bypass for disabled or deleted accounts | Blocked | `Suspended_user_gets_403_and_no_tokens`, `OldTokenIsRejectedAfterDeletion` |

---

## 4. Residual risks (accepted or out of scope)

| # | Risk | Why it stays / mitigation |
|---|---|---|
| R1 | Google sign-in has no nonce. | The native SDK's free API can't carry one. Mitigation: ID tokens accepted only within 10 minutes of issue, audience-bound, signature-checked. |
| R2 | OAuth transactions and pending registrations live in API memory. | Fine for one API instance; a restart drops in-progress sign-ins (users retry). More instances would need a shared store (Redis/DB). |
| R3 | Reddit offers no PKCE. | Confidential client (secret only on the API), state checked server-side, transaction id never in a URL, Reddit token revoked right after use, `identity` scope only. |
| R4 | A refresh response lost on the network makes the next refresh look like reuse → that session ends. | Deliberate: favours theft detection; the person signs in again. |
| R5 | Suspended users keep their session (refresh allowed) until they log out or the session ends. | So the "Your account is suspended" screen and logout keep working; every other request is blocked server-side. |
| R6 | Android Custom Tabs keep the Facebook/Reddit browser login after Coffer sign-out. | Provider cookies are outside the app's control; Coffer's own session is ended. |
| R7 | The legacy in-app `Admin` role can still edit other users' profile fields and role through `PUT api/Users/{id}`. | Not an OAuth path (the identity is now locked). Moderation moved to Coffer.Manager; consider removing the role's write access. |
| R8 | Coffer.Manager tokens (8 h) are not session-revocable; app and Manager tokens share `JWT_SECRET` (different audience and scheme). | Manager sign-in was kept unchanged by decision; removing an admin id takes effect on the next request. |
| R9 | Session revocation is cached ≤ 10 s per API process. | Usually immediate in the process that revoked (the cache entry is evicted), but a request that read "active" just before the revoke can keep the token working for up to 10 s; other instances catch up within 10 s. |
| R10 | Facebook e-mail addresses are not marked verified by Facebook. | Stored for display only, never used to match or merge accounts. |
