import { test } from "node:test";
import assert from "node:assert/strict";
import { newsDate, newsImageUrl } from "../src/utils/news_format.ts";

const labels = {
  today: "Today",
  yesterday: "Yesterday",
  daysAgo: (n: number) => `${n} days ago`,
  date: (d: Date) => d.toISOString().slice(0, 10),
};
const now = new Date("2026-11-23T15:00:00");

test("newsDateIsRelativeForAWeek", () => {
  assert.equal(newsDate("2026-11-23T08:00:00", null, now, labels).date, "Today");
  assert.equal(newsDate("2026-11-22T23:59:00", null, now, labels).date, "Yesterday");
  assert.equal(newsDate("2026-11-21T01:00:00", null, now, labels).date, "2 days ago");
  assert.equal(newsDate("2026-11-17T10:00:00", null, now, labels).date, "6 days ago");
  assert.equal(newsDate("2026-11-16T10:00:00", null, now, labels).date, labels.date(new Date("2026-11-16T10:00:00")));
  // A clock slightly behind the server must not show "in the future".
  assert.equal(newsDate("2026-11-23T15:00:30", null, now, labels).date, "Today");
});

test("newsDateMarksEdited", () => {
  assert.equal(newsDate("2026-11-20T10:00:00", null, now, labels).edited, false);
  assert.equal(newsDate("2026-11-20T10:00:00", "2026-11-21T10:00:00", now, labels).edited, true);
  assert.equal(newsDate("2026-11-20T10:00:00", undefined, now, labels).edited, false);
});

test("newsImageUrlBuildsTheEndpoint", () => {
  assert.equal(newsImageUrl("http://10.0.2.2:5141", "0123456789abcdef0123456789abcdef.jpg"), "http://10.0.2.2:5141/api/News/Image/0123456789abcdef0123456789abcdef.jpg");
  assert.equal(newsImageUrl("http://host/", "0123456789abcdef0123456789abcdef.png"), "http://host/api/News/Image/0123456789abcdef0123456789abcdef.png");
});
