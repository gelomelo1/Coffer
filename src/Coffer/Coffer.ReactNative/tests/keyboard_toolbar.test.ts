import { test } from "node:test";
import assert from "node:assert/strict";
import { computeToolbarBottom } from "../src/utils/keyboard_toolbar.ts";

test("hidden while the keyboard is down", () => {
  assert.equal(computeToolbarBottom({ hostBottom: 800, keyboardTop: null }), null);
});

test("sits on the keyboard when the keyboard overlaps the host", () => {
  assert.equal(computeToolbarBottom({ hostBottom: 800, keyboardTop: 500 }), 300);
});

test("reaches below the host when the host ends above the keyboard (e.g. padding under the editor)", () => {
  assert.equal(computeToolbarBottom({ hostBottom: 458, keyboardTop: 500 }), -42);
});

test("respects an explicit minimum bottom offset", () => {
  assert.equal(computeToolbarBottom({ hostBottom: 400, keyboardTop: 500, minBottom: 0 }), 0);
});

test("rounds to whole pixels", () => {
  assert.equal(computeToolbarBottom({ hostBottom: 800.6, keyboardTop: 500.2 }), 300);
});
