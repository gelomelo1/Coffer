import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "check-i18n.mjs");

/** Builds a throwaway project with one source file and an en locale, runs the checker on it. */
function check(source, { common = {}, fileName = "screen.tsx", allowlist = "" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "i18n-check-"));
  const locales = join(root, "locales", "en");
  mkdirSync(locales, { recursive: true });
  writeFileSync(join(locales, "common.json"), JSON.stringify(common));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", fileName), source);
  const allowFile = join(root, "allow.txt");
  writeFileSync(allowFile, allowlist);
  const res = spawnSync(
    process.execPath,
    [script, "--locales", locales, "--allowlist", allowFile, join(root, "src")],
    { encoding: "utf8" },
  );
  return { code: res.status, out: res.stdout + res.stderr };
}

test("reports missing key", () => {
  const r = check(`const a = t("common:nope");`);
  assert.equal(r.code, 1);
  assert.match(r.out, /common:nope/);
});

test("accepts existing and plural keys", () => {
  const r = check(`const a = t("common:actions.save"); const b = t("common:itemCount", { count });`, {
    common: { actions: { save: "Save" }, itemCount_one: "{{count}} item", itemCount_other: "{{count}} items" },
  });
  assert.equal(r.code, 0, r.out);
});

test("accepts i18n.t and i18nKey usages", () => {
  const r = check(`i18n.t("common:a"); <Trans i18nKey="common:b" />;`, { common: { a: "A", b: "B" } });
  assert.equal(r.code, 0, r.out);
});

test("flags JSX text", () => {
  assert.equal(check(`const x = <CustomText>Hello</CustomText>;`).code, 1);
  assert.equal(
    check(`const x = <CustomText>{t("common:x")}</CustomText>;`, { common: { x: "X" } }).code,
    0,
  );
});

test("flags multi-line JSX text", () => {
  const r = check(`const x = (\n  <CustomText>\n    Read further\n  </CustomText>\n);`);
  assert.equal(r.code, 1);
  assert.match(r.out, /Read further/);
});

test("flags literal props", () => {
  assert.equal(check(`const x = <Input placeholder="Search" />;`).code, 1);
  assert.equal(
    check(`const x = <Input placeholder={t("common:search")} />;`, { common: { search: "S" } }).code,
    0,
  );
});

test("flags literal props written as expression strings", () => {
  assert.equal(check(`const x = <CustomButton title={"Save"} />;`).code, 1);
});

test("flags showToast and Alert.alert literals", () => {
  assert.equal(check(`showToast("error", "Failed");`).code, 1);
  assert.equal(check(`Alert.alert("Delete?", "Sure");`).code, 1);
  assert.equal(check(`showToast("error", t("common:f"));`, { common: { f: "F" } }).code, 0);
});

test("honours i18n-ignore and punctuation-only text", () => {
  assert.equal(check(`const x = <Text>Coffer</Text>; // i18n-ignore`).code, 0);
  assert.equal(check(`const x = <Text>·</Text>; const y = <Text> — </Text>; const z = <Text>/</Text>;`).code, 0);
});

test("ignores files in the allowlist", () => {
  assert.equal(check(`const x = <Text>Hello</Text>;`, { allowlist: "src/screen.tsx\n" }).code, 0);
});

test("ignores generic type arguments and comparisons", () => {
  assert.equal(check(`function f<T>(a: Array<string>) { return a.length > 0 && b < 3; }`, { fileName: "u.tsx" }).code, 0);
});
