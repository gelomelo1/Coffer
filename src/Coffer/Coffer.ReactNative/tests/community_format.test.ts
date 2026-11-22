import { test } from "node:test";
import assert from "node:assert/strict";
import { chartPath, compactNumber, ladderDots, progressRatio } from "../src/utils/community_format.ts";

test("compactNumberKeepsSmallNumbers", () => {
  assert.equal(compactNumber(0, "en"), "0");
  assert.equal(compactNumber(999, "en"), "999");
});

test("compactNumberShortensLargeOnes", () => {
  assert.equal(compactNumber(1234, "en"), "1.2K");
  assert.equal(compactNumber(2_500_000, "en"), "2.5M");
});

test("chartPathSpansTheWidth", () => {
  const { points, line, area } = chartPath([1, 5, 3], 200, 100, 10);

  assert.equal(points[0].x, 10);
  assert.equal(points[2].x, 190);
  assert.equal(points[1].y, 10); // the highest value touches the top padding
  assert.equal(points[0].y, 90); // the lowest touches the bottom padding
  assert.ok(line.startsWith("M10,90"));
  assert.ok(area.endsWith("Z"));

  const flat = chartPath([4, 4, 4], 200, 100, 10).points;
  assert.ok(flat.every((p) => p.y === flat[0].y && Number.isFinite(p.y)), "equal values draw a flat line");

  const single = chartPath([7], 200, 100, 10).points;
  assert.equal(single.length, 1);
  assert.ok(Number.isFinite(single[0].x) && Number.isFinite(single[0].y), "one value doesn't divide by zero");

  assert.deepEqual(chartPath([], 200, 100, 10).points, []);
});

test("ladderDotsWindowAroundCurrent", () => {
  assert.deepEqual(ladderDots(0, 17, 5), ["current", "future", "future", "future", "future"]);
  assert.deepEqual(ladderDots(8, 17, 5), ["past", "past", "current", "future", "future"]);
  assert.deepEqual(ladderDots(16, 17, 5), ["past", "past", "past", "past", "current"]);
  assert.deepEqual(ladderDots(1, 3), ["past", "current", "future"]);
});

test("progressRatioIsClamped", () => {
  assert.equal(progressRatio(5, 10), 0.5);
  assert.equal(progressRatio(30, 10), 1);
  assert.equal(progressRatio(-1, 10), 0);
  assert.equal(progressRatio(3, 0), 0);
});
