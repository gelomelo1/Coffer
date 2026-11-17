import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreference, resolveLanguage } from "../src/i18n/language_preference.ts";

const supported = ["en", "hu"] as const;

test("an explicit choice wins over the device language", () => {
  assert.equal(resolveLanguage("en", ["hu-HU"], supported), "en");
  assert.equal(resolveLanguage("hu", ["en-US"], supported), "hu");
});

test("device language: the first supported device language", () => {
  assert.equal(resolveLanguage("system", ["de-DE", "hu-HU", "en-GB"], supported), "hu");
});

test("device language falls back to English when none is supported", () => {
  assert.equal(resolveLanguage("system", ["de-DE", "fr-FR"], supported), "en");
});

test("stored values are validated: unknown or missing means device language", () => {
  assert.equal(parsePreference("hu", supported), "hu");
  assert.equal(parsePreference("system", supported), "system");
  assert.equal(parsePreference("xx", supported), "system");
  assert.equal(parsePreference(null, supported), "system");
});
