import { test } from "node:test";
import assert from "node:assert/strict";
import { clockOffset, elapsedShare, formState, remaining, shareLabel } from "../src/utils/contribution_format.ts";

test("countdownUsesServerOffset", () => {
  // The phone's clock runs 5 minutes fast: the countdown still follows the server.
  const now = Date.parse("2026-12-01T12:05:00Z");
  const off = clockOffset("2026-12-01T12:00:00Z", now);
  const r = remaining("2026-12-01T13:00:00Z", off, now);
  assert.deepEqual([r.days, r.hours, r.minutes, r.seconds], [0, 1, 0, 0]);
});

test("countdownSplitsDaysHoursMinutesSeconds", () => {
  const now = Date.parse("2026-12-01T00:00:00Z");
  const r = remaining("2026-12-04T14:22:07Z", 0, now);
  assert.deepEqual([r.days, r.hours, r.minutes, r.seconds], [3, 14, 22, 7]);
});

test("countdownNeverNegative", () => {
  const r = remaining("2026-12-01T12:00:00Z", 0, Date.parse("2026-12-02T00:00:00Z"));
  assert.equal(r.totalMs, 0);
  assert.deepEqual([r.days, r.hours, r.minutes, r.seconds], [0, 0, 0, 0]);
});

test("elapsedShareIsClamped", () => {
  const opened = "2026-12-01T00:00:00Z";
  const ends = "2026-12-03T00:00:00Z";
  assert.equal(elapsedShare(opened, ends, 0, Date.parse("2026-11-30T00:00:00Z")), 0);
  assert.equal(elapsedShare(opened, ends, 0, Date.parse("2026-12-02T00:00:00Z")), 0.5);
  assert.equal(elapsedShare(opened, ends, 0, Date.parse("2026-12-05T00:00:00Z")), 1);
  assert.equal(elapsedShare(ends, ends, 0, Date.parse("2026-12-05T00:00:00Z")), 1, "a zero-length phase doesn't divide by zero");
});

test("formStateRules", () => {
  assert.equal(formState(0), "tooFew");
  assert.equal(formState(4), "tooFew");
  assert.equal(formState(5), "ready");
  assert.equal(formState(9), "ready");
  assert.equal(formState(10), "full");
});

test("shareLabelRoundsToWholePercent", () => {
  assert.equal(shareLabel(0.4123, "en"), "41%");
  assert.equal(shareLabel(0, "en"), "0%");
  assert.match(shareLabel(0.5, "hu"), /^50\s?%$/);
});
