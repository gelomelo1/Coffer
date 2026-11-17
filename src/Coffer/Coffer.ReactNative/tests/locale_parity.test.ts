import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Every translation must cover exactly the English keys, with the same {{placeholders}} and <n> tags. */
const localesDir = join(import.meta.dirname, "..", "src", "i18n", "locales");
const LANGUAGES = ["hu"];

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}

const read = (lang: string, file: string): Record<string, string> =>
  flatten(JSON.parse(readFileSync(join(localesDir, lang, file), "utf8")));
const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?(\d+)>/g)].map((m) => m[0]).sort();

const namespaces = readdirSync(join(localesDir, "en")).filter((f) => f.endsWith(".json"));

for (const lang of LANGUAGES) {
  for (const file of namespaces) {
    test(`${lang}/${file} has every English key with the same placeholders`, () => {
      assert.ok(existsSync(join(localesDir, lang, file)), `missing ${lang}/${file}`);
      const en = read("en", file);
      const tr = read(lang, file);
      assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort(), "key sets differ");
      for (const [key, text] of Object.entries(en)) {
        assert.ok(tr[key].trim().length > 0, `${key} is empty`);
        assert.deepEqual(placeholders(tr[key]), placeholders(text), `${key}: placeholders differ`);
        assert.deepEqual(tags(tr[key]), tags(text), `${key}: <n> tags differ`);
      }
    });
  }
}
