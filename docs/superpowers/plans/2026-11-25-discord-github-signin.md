# Discord replaces Reddit, GitHub sign-in for every user — Implementation Plan

> **For agentic workers:** executed natively (superpowers:executing-plans). Steps use checkbox syntax.

**Goal:** Swap Reddit for Discord and add GitHub as an app sign-in, both through the backend-held browser flow.
**Spec:** `docs/superpowers/specs/2026-11-24-oauth-sessions-env-design.md` (Addendum 2026-11-25)
**Global constraints:** same as `2026-11-24-oauth-sessions-env.md` (no branches/push/AI trailers, strict env, no new packages).

### Task 1: Backend — transactions with PKCE without a nonce, Discord client, GitHub client, Reddit removed
- `OAuthTransactionStore.Create(string provider, bool withNonce, bool withPkce)` (Facebook: true/true; Discord, GitHub: false/true).
- `AuthOptions`: `DiscordAuthOptions(ClientId, ClientSecret, RedirectUri)`, `GithubAuthOptions(ClientId, ClientSecret, RedirectUri)`; Reddit options removed.
- `IDiscordOAuthClient` / `DiscordOAuthClient`: authorize `https://discord.com/oauth2/authorize?client_id&response_type=code&redirect_uri&scope=identify email&state&code_challenge&code_challenge_method=S256&prompt=consent`;
  token `POST https://discord.com/api/oauth2/token` (form grant_type, code, redirect_uri, code_verifier; Basic client auth);
  `GET https://discord.com/api/users/@me` → id (required), username/global_name, avatar → `https://cdn.discordapp.com/avatars/{id}/{hash}.png`, email only if verified;
  revoke `POST https://discord.com/api/oauth2/token/revoke` (best effort).
- `IGithubOAuthClient` / `GithubOAuthClient`: authorize `https://github.com/login/oauth/authorize?client_id&redirect_uri&scope=read:user user:email&state&code_challenge&code_challenge_method=S256&allow_signup=true`;
  token `POST https://github.com/login/oauth/access_token` (Accept json; client_id, client_secret, code, redirect_uri, code_verifier; GitHub reports errors as 200 + "error");
  `GET https://api.github.com/user` → id (number, required), login, avatar_url (https only); `GET https://api.github.com/user/emails` → primary && verified;
  revoke `DELETE https://api.github.com/applications/{client_id}/token` with Basic client auth, body `{"access_token": …}` (best effort).
- Endpoints `api/auth/{discord|github}/{start|complete}`; Reddit endpoints, client and tests removed.
- Tests: `DiscordSignInTests`, `GithubSignInTests` (URL from config incl. S256 challenge, token request carries verifier/redirect/client auth, identity = id not name, unverified e-mail dropped, token revoked, state mismatch, replay, cross-provider transaction, provider error, malformed JSON, missing id, outage → providerSignInFailed); RouteSweep; `AuthOptionsTests`.
- Migration + `DevSeedValidator` + `.env` / `.env.example` (Dani → discord) + `TestEnvironment`.

### Task 2: App — Discord and GitHub buttons, env, deep links
- `EXPO_PUBLIC_DISCORD_APP_ID` in `env_check` (+ test), `app.config.ts` intent filter `discord-<id>`, `.env` / `.env.example`.
- `hooks/auth.ts`: providers `google | facebook | discord | github`; endpoints; login buttons (FontAwesome `discord`, `github`); profile card icons; i18n en/hu.
- `systemPathFor`: also `oauth/github` and `authorize/callback`, scheme with `:/` or `://` (+ tests); `parseAuthResult` works for `discord-<id>:/authorize/callback` (+ test).

### Task 3: Docs and final verification
- README provider section/table, audit report (Reddit → Discord/GitHub rows and checklist evidence, R3 replaced), full suites, review.
