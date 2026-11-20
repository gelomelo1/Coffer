import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByDay, sentenceParams } from "../src/utils/activity_format.ts";

const labels = { today: "Today", yesterday: "Yesterday", date: (d: Date) => `${d.getMonth() + 1}/${d.getDate()}` };
const deps = {
  unavailable: "No longer available",
  untitled: "Untitled",
  money: (cents: number) => `€${(cents / 100).toFixed(2)}`,
  term: (key: string) => `[${key}]`,
};
const entry = (over: Partial<{ kind: string; details: Record<string, unknown>; title: string; available: boolean; otherName: string | null }> = {}) => ({
  kind: over.kind ?? "reaction.liked",
  occurredAt: new Date(2026, 10, 20, 10).toISOString(),
  details: over.details ?? {},
  target: { type: "item", title: over.title ?? "Heineken", available: over.available ?? true, otherName: over.otherName ?? null },
});

test("groupsByTodayYesterdayAndDate", () => {
  const now = new Date(2026, 10, 20, 18, 0); // local time, whatever the machine's zone
  const at = (d: Date) => ({ occurredAt: d.toISOString() });
  const entries = [
    at(new Date(2026, 10, 20, 17, 0)),
    at(new Date(2026, 10, 20, 0, 5)),
    at(new Date(2026, 10, 19, 23, 59)),
    at(new Date(2026, 10, 17, 9, 0)),
    at(new Date(2026, 10, 17, 8, 0)),
  ];

  const sections = groupByDay(entries, now, labels);

  assert.deepEqual(
    sections.map((s) => [s.title, s.data.length]),
    [
      ["Today", 2],
      ["Yesterday", 1],
      ["11/17", 2],
    ],
  );
});

test("sentenceParamsForRerate", () => {
  const params = sentenceParams(entry({ kind: "reaction.rerated", details: { from: 3, to: 5 } }), deps);

  assert.equal(params.from, "3★");
  assert.equal(params.to, "5★");
  assert.equal(params.name, "Heineken");
  assert.equal(params.context, undefined);
});

test("sentenceParamsUsePlaceholderWhenUnavailable", () => {
  const params = sentenceParams(entry({ title: "", available: false, otherName: "" }), deps);

  assert.equal(params.name, "No longer available");
  assert.equal(params.context, "gone"); // the "_gone" sentence names nobody and nothing
  assert.equal(params.other, "");
});

test("untitled targets still read", () => {
  assert.equal(sentenceParams(entry({ title: "" }), deps).name, "Untitled");
});

test("priceIsFormatted", () => {
  const params = sentenceParams(entry({ kind: "offer.sent", details: { priceCents: 1500 } }), deps);

  assert.equal(params.price, "€15.00");
});

test("proposal kind and stars become words", () => {
  assert.equal(sentenceParams(entry({ kind: "proposal.accepted", details: { proposal: "offer" } }), deps).what, "[proposal.offer]");
  assert.equal(sentenceParams(entry({ kind: "review.written", details: { stars: 4 }, otherName: "Sam" }), deps).stars, "4★");
  assert.equal(sentenceParams(entry({ kind: "item.addedToExisting", details: { quantity: 2 } }), deps).quantity, 2);
});

test("activity caches are per user (a second account on the device never sees the first one's log)", async () => {
  const { activityListKey, activitySummaryKey } = await import("../src/utils/activity_format.ts");
  assert.notDeepEqual(activityListKey("user-a", null), activityListKey("user-b", null));
  assert.notDeepEqual(activityListKey("user-a", "likes"), activityListKey("user-b", "likes"));
  assert.notDeepEqual(activityListKey("user-a", "likes"), activityListKey("user-a", "comments"));
  assert.notDeepEqual(activitySummaryKey("user-a"), activitySummaryKey("user-b"));
});
