import { test } from "node:test";
import assert from "node:assert/strict";
import { remainingCount } from "../src/utils/review_progress.ts";

test("caps acted on but still on the server's list are not counted", () => {
  // 3 waiting on the server, all loaded, one of them held for Undo
  assert.equal(remainingCount(3, ["a", "b", "c"], new Set(["a"])), 2);
});

test("a cap already gone from the server's list is not subtracted twice", () => {
  // "a" was sent and the list reloaded without it: total 1, loaded ["b"], "a" still remembered as hidden
  assert.equal(remainingCount(1, ["b"], new Set(["a"])), 1);
});

test("never negative", () => {
  assert.equal(remainingCount(0, [], new Set(["a", "b"])), 0);
});
