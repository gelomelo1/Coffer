import { test } from "node:test";
import assert from "node:assert/strict";
import { completeTag, currentTagToken, parseTags } from "../src/utils/tag_input.ts";

test("parseTags splits on spaces, strips # and lowercases, without duplicates", () => {
  assert.deepEqual(parseTags("#Austria  #travel #austria beer"), ["austria", "travel", "beer"]);
});

test("currentTagToken is the tag being typed at the end", () => {
  assert.equal(currentTagToken("#austria #tra"), "tra");
});

test("no current token right after a space", () => {
  assert.equal(currentTagToken("#austria "), null);
});

test("a bare # is not a token yet", () => {
  assert.equal(currentTagToken("#austria #"), null);
});

test("completeTag replaces the token being typed and adds a trailing space", () => {
  assert.equal(completeTag("#austria #tra", "travel"), "#austria #travel ");
});

test("completeTag on an empty field just inserts the tag", () => {
  assert.equal(completeTag("", "beer"), "#beer ");
});
