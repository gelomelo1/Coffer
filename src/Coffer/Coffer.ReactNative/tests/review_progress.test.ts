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

test("days left until a waiting item is removed, rounded up", async () => {
  const { daysUntil } = await import("../src/utils/review_progress.ts");
  const now = new Date("2026-11-20T12:00:00Z");
  assert.equal(daysUntil("2026-11-22T12:00:00Z", now), 2);
  assert.equal(daysUntil("2026-11-22T13:00:00Z", now), 3); // 2 days and an hour: "3 days"
  assert.equal(daysUntil("2026-11-20T18:00:00Z", now), 1); // later today: "1 day", never "0 days"
  assert.equal(daysUntil("2026-11-19T12:00:00Z", now), 1); // already due (removed within the hour)
});
