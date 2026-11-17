import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveText, resolveTextParams } from "../src/utils/text_params.ts";

const translate = (key: string) => ({ "market:delivery.shipping": "Szállítás", "errors:fields.title": "Cím" })[key] ?? key;
const money = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

test("@t: params are translated, @eur: params formatted, plain text kept", () => {
  assert.deepEqual(resolveTextParams({ p0: "@t:market:delivery.shipping", p1: "@eur:150", p2: "GLS 1234" }, translate, money), {
    p0: "Szállítás",
    p1: "1,50 €",
    p2: "GLS 1234",
  });
});

test("missing params stay missing", () => {
  assert.equal(resolveTextParams(undefined, translate, money), undefined);
});

test("a single stored text resolves the same way (e.g. a generated cancel reason)", () => {
  assert.equal(resolveText("@t:errors:fields.title", translate, money), "Cím");
  assert.equal(resolveText("Changed my mind", translate, money), "Changed my mind");
  assert.equal(resolveText(null, translate, money), null);
});

test("a malformed money value is shown as written", () => {
  assert.equal(resolveText("@eur:abc", translate, money), "@eur:abc");
});
