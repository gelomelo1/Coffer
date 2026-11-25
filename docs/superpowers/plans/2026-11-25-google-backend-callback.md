# Google sign-in through a backend callback — Implementation Plan

> Executed natively (superpowers:executing-plans). Spec: `docs/superpowers/specs/2026-11-24-oauth-sessions-env-design.md`
> (Addendum 2026-11-25, 2). Global constraints as in `2026-11-24-oauth-sessions-env.md`.

### Task 1: Backend
- `JwksCache` (per-URL JWKS, 24 h, unknown-kid refetch ≤ every 5 min) replaces `FacebookSigningKeys`; Facebook uses it.
- `GoogleAuthOptions(ClientId, ClientSecret, RedirectUri, AppRedirectUri)` with the redirect rules; strict/dev as before.
- `OAuthTransactionStore.TakeByState(provider, state)`; `PendingCallbackStore` (verified identity or failure by
  transaction id, 10 min, single use).
- `IGoogleOAuthClient` / `GoogleOAuthClient` (authorize URL, code exchange, ID-token validation).
- Endpoints start / callback / complete; `google/validate` and `GoogleIdTokenValidator` removed; Google.Apis.Auth
  reference removed.
- Tests: `GoogleSignInTests` (browser flow incl. nonce/aud/iss/exp/alg, callback replay, unknown state, denial, complete
  replay/wrong state/before callback, unverified e-mail, logs, outage, cross-provider), `RegistrationTests` (the
  registration rules, moved off the old Google validator), `SessionApiTests` rate-limit endpoint, `AuthOptionsTests`,
  `ProviderNotConfiguredTests`, route sweep.

### Task 2: App
- Google through `openAuthSessionAsync`; `parseRelayResult` (state only, no code) + tests; native intent `oauth/google`;
  remove `@react-native-google-signin`, `google_signin.ts`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; sign-out without Google SDK.

### Task 3: Docs + verification (README, audit report R1, env files), full suites, review.
