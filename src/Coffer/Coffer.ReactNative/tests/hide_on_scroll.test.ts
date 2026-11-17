import { test } from "node:test";
import assert from "node:assert/strict";
import { snapOffset, trackChrome } from "../src/utils/hide_on_scroll.ts";
import type { ChromeTrack } from "../src/utils/hide_on_scroll.ts";

const MAX = 100;
const BACKLASH = 50;
const at = (offset: number, slack = 0): ChromeTrack => ({ offset, slack });
const track = (s: ChromeTrack, prevY: number, y: number) => trackChrome(s, prevY, y, MAX, BACKLASH);

test("scrolling down hides by the scrolled distance", () => {
  assert.deepEqual(track(at(0), 0, 30), at(30));
});

test("hidden offset never exceeds the chrome height", () => {
  assert.deepEqual(track(at(90), 500, 540), at(100));
});

test("overscroll above the top shows the chrome fully", () => {
  assert.deepEqual(track(at(50), 100, -20), at(0));
});

test("near the top the chrome never hides more than was scrolled", () => {
  // 30 hidden + 20 more scrolled would be 50, but only 40 px of list have scrolled away
  assert.deepEqual(track(at(30, 0), 20, 40), at(40));
});

test("a partly shown chrome reveals immediately when scrolling up", () => {
  assert.deepEqual(track(at(60), 500, 470), at(30));
});

test("a fully hidden chrome waits for the backlash before revealing", () => {
  assert.deepEqual(track(at(100), 500, 470), at(100, 30));
});

test("upward travel beyond the backlash starts the reveal", () => {
  assert.deepEqual(track(at(100, 30), 470, 440), at(90, 50));
});

test("scrolling down again resets the backlash", () => {
  assert.deepEqual(track(at(100, 30), 470, 480), at(100, 0));
});

test("near the top the chrome shows even if the backlash was not used up", () => {
  assert.deepEqual(track(at(100, 10), 120, 60), at(60, 0));
});

test("release under half-way snaps to shown", () => {
  assert.equal(snapOffset(49, 500, 100), 0);
});

test("release at or past half-way snaps to hidden", () => {
  assert.equal(snapOffset(50, 500, 100), 100);
});

test("release near the top always snaps to shown", () => {
  assert.equal(snapOffset(90, 60, 100), 0);
});

test("a partly hidden chrome follows the last scroll direction: up reveals", () => {
  assert.equal(snapOffset(80, 500, 100, -1), 0);
});

test("a partly hidden chrome follows the last scroll direction: down hides", () => {
  assert.equal(snapOffset(20, 500, 100, 1), 100);
});

test("fully shown or hidden chrome stays put whatever the direction", () => {
  assert.equal(snapOffset(0, 500, 100, 1), 0);
  assert.equal(snapOffset(100, 500, 100, -1), 100);
});
