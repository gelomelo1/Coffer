import { test } from "node:test";
import assert from "node:assert/strict";
import { listingLabel, userLabel } from "../src/utils/deleted_labels.ts";

// A t() that returns the key, so the test sees which label was picked.
const t = ((key: string) => key) as never;

test("a deleted or missing user reads 'Deleted user'", () => {
  assert.equal(userLabel({ name: "", isDeleted: true }, t), "common:deleted.user");
  assert.equal(userLabel(null, t), "common:deleted.user");
  assert.equal(userLabel(undefined, t), "common:deleted.user");
});

test("a live user keeps their name", () => {
  assert.equal(userLabel({ name: "Anna" }, t), "Anna");
  assert.equal(userLabel({ name: "Anna", isDeleted: false }, t), "Anna");
});

test("a deleted listing reads 'Deleted user's listing'", () => {
  assert.equal(listingLabel("", true, t), "common:deleted.listing");
  assert.equal(listingLabel("Silver coins", false, t), "Silver coins");
  assert.equal(listingLabel("Silver coins", undefined, t), "Silver coins");
});

