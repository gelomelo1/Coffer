import { test } from "node:test";
import assert from "node:assert/strict";
import { snapOffset, trackOffset } from "../src/utils/hide_on_scroll.ts";

test("scrolling down hides by the scrolled distance", () => {
  assert.equal(trackOffset(0, 0, 30, 100), 30);
});

test("hidden offset never exceeds the chrome height", () => {
  assert.equal(trackOffset(90, 500, 540, 100), 100);
});

test("scrolling up reveals by the scrolled distance", () => {
  assert.equal(trackOffset(60, 500, 470, 100), 30);
});

test("overscroll above the top shows the chrome fully", () => {
  assert.equal(trackOffset(50, 100, -20, 100), 0);
});

test("near the top the chrome never hides more than was scrolled", () => {
  // 30 hidden + 20 more scrolled would be 50, but only 40 px of list have scrolled away
  assert.equal(trackOffset(30, 20, 40, 100), 40);
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
