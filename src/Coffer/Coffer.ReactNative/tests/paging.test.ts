import { test } from "node:test";
import assert from "node:assert/strict";
import { groupInOrder, isNearEnd, mergeMessagePages, mergePages, nextPageParam, prefetchForExpandedGroup } from "../src/utils/paging.ts";

const page = (n: number, ids: string[], total: number) => ({ items: ids.map((id) => ({ id })), page: n, pageSize: 20, total });

test("there is a next page while fewer than total have been served", () => {
  assert.equal(nextPageParam(page(1, [], 45)), 2);
  assert.equal(nextPageParam(page(2, [], 45)), 3);
  assert.equal(nextPageParam(page(3, [], 45)), undefined);
  assert.equal(nextPageParam(page(1, [], 20)), undefined);
  assert.equal(nextPageParam(page(1, [], 0)), undefined);
});

test("pages are appended in order and a row that moved to the next page shows up once", () => {
  const merged = mergePages([page(1, ["a", "b"], 3), page(2, ["b", "c"], 3)], (x) => x.id);
  assert.deepEqual(merged.map((x) => x.id), ["a", "b", "c"]);
});

test("chat pages (newest first) become one list, oldest message first", () => {
  const newest = { items: [{ id: "m3" }, { id: "m4" }], hasMore: true, total: 4 };
  const older = { items: [{ id: "m1" }, { id: "m2" }], hasMore: false, total: 4 };
  assert.deepEqual(mergeMessagePages([newest, older]).map((m) => m.id), ["m1", "m2", "m3", "m4"]);
});

test("groups appear in the order the backend sent them", () => {
  const groups = groupInOrder([{ t: 2, n: "a" }, { t: 2, n: "b" }, { t: 5, n: "c" }, { t: 1, n: "d" }], (x) => x.t);
  assert.deepEqual(groups.map((g) => [g.id, g.items.map((x) => x.n).join("")]), [[2, "ab"], [5, "c"], [1, "d"]]);
});

test("an expanded group that hasn't got its first items yet keeps loading pages", () => {
  // group 7 has 30 entries, 0 loaded so far → load more
  assert.equal(prefetchForExpandedGroup([7], { 7: 0 }, { 7: 30 }), true);
  // 20 already loaded → normal scrolling takes over
  assert.equal(prefetchForExpandedGroup([7], { 7: 20 }, { 7: 30 }), false);
  // a small group fully loaded
  assert.equal(prefetchForExpandedGroup([7], { 7: 4 }, { 7: 4 }), false);
  assert.equal(prefetchForExpandedGroup([], {}, { 7: 30 }), false);
});

test("near the end of a scroll view", () => {
  const at = (offset: number) => ({ layoutMeasurement: { height: 800 }, contentOffset: { y: offset }, contentSize: { height: 3000 } });
  assert.equal(isNearEnd(at(1900), 400), true);
  assert.equal(isNearEnd(at(1000), 400), false);
});
