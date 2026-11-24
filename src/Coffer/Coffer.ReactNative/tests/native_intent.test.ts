import { test } from "node:test";
import assert from "node:assert/strict";
import { systemPathFor } from "../src/utils/native_intent_path.ts";

test("OAuth redirects stay on the sign-in screen (the in-app browser hands them to the sign-in code)", () => {
  assert.equal(systemPathFor("com.gelomelo.coffer://oauth/reddit?code=abc&state=s"), "/login");
  assert.equal(systemPathFor("fb123456://authorize?code=abc&state=s#_=_"), "/login");
  assert.equal(systemPathFor("/oauth/reddit?error=access_denied&state=s"), "/login");
  assert.equal(systemPathFor("authorize?error=access_denied"), "/login");
});

test("every other link is left alone", () => {
  assert.equal(systemPathFor("com.gelomelo.coffer://market/listing/42"), "com.gelomelo.coffer://market/listing/42");
  assert.equal(systemPathFor("/settings"), "/settings");
  assert.equal(systemPathFor("com.gelomelo.coffer://oauth-help"), "com.gelomelo.coffer://oauth-help");
});
