import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAuthResult, parseRelayResult, queryParam } from "../src/utils/auth_redirect.ts";

const redirect = "fb123456://authorize";
const ok = (query: string) => ({ type: "success", url: `${redirect}?${query}` });

test("happy_path_returns_code_and_state", () => {
  assert.deepEqual(parseAuthResult(ok("code=abc%2Bdef&state=s1"), "s1", redirect), { kind: "code", code: "abc+def", state: "s1" });
});

test("facebook's #_=_ fragment is ignored", () => {
  assert.deepEqual(parseAuthResult({ type: "success", url: `${redirect}?code=abc&state=s1#_=_` }, "s1", redirect), {
    kind: "code",
    code: "abc",
    state: "s1",
  });
});

test("parse_auth_result_handles_error_and_cancel", () => {
  assert.deepEqual(parseAuthResult({ type: "dismiss" }, "s1", redirect), { kind: "cancelled" });
  assert.deepEqual(parseAuthResult({ type: "cancel" }, "s1", redirect), { kind: "cancelled" });
  assert.deepEqual(parseAuthResult(ok("error=access_denied&state=s1"), "s1", redirect), { kind: "cancelled" });
  assert.deepEqual(parseAuthResult(ok("error=server_error&state=s1"), "s1", redirect), { kind: "error", error: "server_error" });
});

test("state_mismatch", () => {
  assert.deepEqual(parseAuthResult(ok("code=abc&state=forged"), "s1", redirect), { kind: "error", error: "state_mismatch" });
  assert.deepEqual(parseAuthResult(ok("code=abc"), "s1", redirect), { kind: "error", error: "state_mismatch" });
});

test("redirect_mismatch", () => {
  assert.deepEqual(parseAuthResult({ type: "success", url: "https://evil.example/?code=abc&state=s1" }, "s1", redirect), {
    kind: "error",
    error: "redirect_mismatch",
  });
  // A look-alike that merely starts with the same characters is not the redirect.
  assert.deepEqual(parseAuthResult({ type: "success", url: `${redirect}evil?code=abc&state=s1` }, "s1", redirect), {
    kind: "error",
    error: "redirect_mismatch",
  });
});

test("missing_code_is_error", () => {
  assert.deepEqual(parseAuthResult(ok("state=s1"), "s1", redirect), { kind: "error", error: "missing_code" });
});

test("queryParam reads the state the backend put in the authorize URL", () => {
  assert.equal(queryParam("https://www.facebook.com/v21.0/dialog/oauth?client_id=1&state=a%2Fb&nonce=n", "state"), "a/b");
  assert.equal(queryParam("https://x.example/?a=1", "state"), undefined);
});

test("discord's single-slash redirect (discord-<id>:/authorize/callback) is recognised", () => {
  const discord = "discord-998877:/authorize/callback";
  assert.deepEqual(parseAuthResult({ type: "success", url: `${discord}?code=abc&state=s1` }, "s1", discord), { kind: "code", code: "abc", state: "s1" });
  assert.deepEqual(parseAuthResult({ type: "success", url: `${discord}x?code=abc&state=s1` }, "s1", discord), { kind: "error", error: "redirect_mismatch" });
});

// Google returns to the app through the API: only the state comes back (plus error=access_denied|failed).
const google = "com.gelomelo.coffer://oauth/google";

test("relay: state only means the API has the result", () => {
  assert.deepEqual(parseRelayResult({ type: "success", url: `${google}?state=s1` }, "s1", google), { kind: "ready", state: "s1" });
});

test("relay: denial and cancel are cancelled, failures are errors", () => {
  assert.deepEqual(parseRelayResult({ type: "dismiss" }, "s1", google), { kind: "cancelled" });
  assert.deepEqual(parseRelayResult({ type: "success", url: `${google}?state=s1&error=access_denied` }, "s1", google), { kind: "cancelled" });
  assert.deepEqual(parseRelayResult({ type: "success", url: `${google}?state=s1&error=failed` }, "s1", google), { kind: "error", error: "failed" });
  assert.deepEqual(parseRelayResult({ type: "success", url: `${google}?error=failed` }, "s1", google), { kind: "error", error: "failed" });
});

test("relay: a foreign state or redirect is refused", () => {
  assert.deepEqual(parseRelayResult({ type: "success", url: `${google}?state=forged` }, "s1", google), { kind: "error", error: "state_mismatch" });
  assert.deepEqual(parseRelayResult({ type: "success", url: "https://evil.example/?state=s1" }, "s1", google), { kind: "error", error: "redirect_mismatch" });
});
