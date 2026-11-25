import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEnv } from "../src/utils/env_check.ts";

const complete = {
  EXPO_PUBLIC_BACKEND_URL: "https://api.coffer.example",
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "web.apps.googleusercontent.com",
  EXPO_PUBLIC_FACEBOOK_APP_ID: "123456",
  EXPO_PUBLIC_DISCORD_APP_ID: "998877",
  EXPO_PUBLIC_AUTH_SCHEME: "com.gelomelo.coffer",
};

test("all values present: normalised config", () => {
  assert.deepEqual(checkEnv(complete, false), {
    backendUrl: "https://api.coffer.example",
    googleWebClientId: "web.apps.googleusercontent.com",
    facebookAppId: "123456",
    discordAppId: "998877",
    authScheme: "com.gelomelo.coffer",
  });
});

for (const key of Object.keys(complete) as (keyof typeof complete)[]) {
  test(`missing ${key} names the variable`, () => {
    assert.throws(() => checkEnv({ ...complete, [key]: undefined }, true), new Error(`Missing ${key} in Coffer.ReactNative/.env`));
  });
}

test("whitespace counts as missing", () => {
  assert.throws(() => checkEnv({ ...complete, EXPO_PUBLIC_FACEBOOK_APP_ID: "  " }, true), /Missing EXPO_PUBLIC_FACEBOOK_APP_ID/);
});

test("http backend allowed in development", () => {
  assert.equal(checkEnv({ ...complete, EXPO_PUBLIC_BACKEND_URL: "http://10.0.2.2:5141" }, true).backendUrl, "http://10.0.2.2:5141");
});

test("http backend rejected outside development", () => {
  assert.throws(
    () => checkEnv({ ...complete, EXPO_PUBLIC_BACKEND_URL: "http://10.0.2.2:5141" }, false),
    new Error("EXPO_PUBLIC_BACKEND_URL must use https:// outside development"),
  );
});

test("a backend URL that isn't http(s) is rejected", () => {
  assert.throws(() => checkEnv({ ...complete, EXPO_PUBLIC_BACKEND_URL: "ftp://x" }, true), /EXPO_PUBLIC_BACKEND_URL/);
});

test("a trailing slash is dropped (image URLs append /api/...)", () => {
  assert.equal(checkEnv({ ...complete, EXPO_PUBLIC_BACKEND_URL: "https://api.coffer.example//" }, false).backendUrl, "https://api.coffer.example");
});
