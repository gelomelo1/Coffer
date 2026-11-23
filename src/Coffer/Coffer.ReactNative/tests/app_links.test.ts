import { test } from "node:test";
import assert from "node:assert/strict";
import { appLinkFor, imageNameOf, parseAppLink } from "../src/utils/app_links.ts";

const ID = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";

test("parsesEveryTarget", () => {
  for (const kind of ["item", "collection", "listing", "user", "news"] as const) {
    assert.deepEqual(parseAppLink(`coffer://${kind}/${ID}`), { kind, id: ID });
  }
  assert.deepEqual(parseAppLink(`coffer://item/${ID.toUpperCase()}`), { kind: "item", id: ID });
  assert.deepEqual(parseAppLink(`  coffer://user/${ID} `), { kind: "user", id: ID });
});

test("parsesFixedPages", () => {
  assert.deepEqual(parseAppLink("coffer://home"), { kind: "page", page: "home" });
  assert.deepEqual(parseAppLink("coffer://collections"), { kind: "page", page: "collections" });
  assert.deepEqual(parseAppLink("coffer://follows"), { kind: "page", page: "follows" });
  assert.deepEqual(parseAppLink("coffer://community"), { kind: "page", page: "community" });
  assert.deepEqual(parseAppLink("coffer://community/stats"), { kind: "page", page: "communityStats" });
  assert.deepEqual(parseAppLink("coffer://community/news"), { kind: "page", page: "communityNews" });
  assert.deepEqual(parseAppLink("coffer://market"), { kind: "page", page: "market" });
  assert.deepEqual(parseAppLink("coffer://settings"), { kind: "page", page: "settings" });
});

test("webAndMailLinksAreWeb", () => {
  assert.equal(parseAppLink("https://example.com/a?b=c"), "web");
  assert.equal(parseAppLink("http://example.com"), "web");
  assert.equal(parseAppLink("HTTPS://EXAMPLE.COM"), "web");
  assert.equal(parseAppLink("mailto:hello@example.com"), "web");
});

test("unsafeOrMalformedLinksAreRejected", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "ftp://example.com/file",
    "file:///etc/passwd",
    "intent://scan/#Intent;scheme=zxing;end",
    "coffer://item/not-a-guid",
    "coffer://unknown/" + ID,
    `coffer://item/${ID}/extra`,
    `coffer://item/${ID}?x=1`,
    "coffer://item/",
    "coffer://community/other",
    "coffer://",
    "https:",
    "",
    "/relative/path",
  ]) {
    assert.equal(parseAppLink(href), null, href);
  }
});

test("appLinkForRoundTrips", () => {
  assert.equal(appLinkFor("listing", ID), `coffer://listing/${ID}`);
  for (const kind of ["item", "collection", "listing", "user", "news"] as const) {
    assert.deepEqual(parseAppLink(appLinkFor(kind, ID)), { kind, id: ID });
  }
});

test("imageNameOfOnlyAcceptsStoreNames", () => {
  assert.equal(imageNameOf("coffer-image:0123456789abcdef0123456789abcdef.jpg"), "0123456789abcdef0123456789abcdef.jpg");
  assert.equal(imageNameOf("coffer-image:0123456789abcdef0123456789abcdef.png"), "0123456789abcdef0123456789abcdef.png");
  assert.equal(imageNameOf("coffer-image:../x"), null);
  assert.equal(imageNameOf("coffer-image:0123456789abcdef0123456789abcdef.gif"), null);
  assert.equal(imageNameOf("coffer-image:0123456789ABCDEF0123456789ABCDEF.jpg"), null);
  assert.equal(imageNameOf("https://example.com/a.jpg"), null);
  assert.equal(imageNameOf("0123456789abcdef0123456789abcdef.jpg"), null);
});
