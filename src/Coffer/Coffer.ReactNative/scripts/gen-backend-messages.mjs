#!/usr/bin/env node
/**
 * Collects the error codes the ASP.NET backend sends with their English messages and writes them to the "backend"
 * section of src/i18n/locales/en/errors.json (other sections are kept). The app translates errors by code
 * (errors:backend.<code>), so these English texts are the reference other locales translate.
 *
 * Call sites it reads:   MarketplaceException.<Kind>("code", "Message …")
 *                        this.ApiError(<status>, "code", $"Message {x} …", ErrorArgs.Of(...))
 * Interpolated holes become {{p0}}, {{p1}}… (the order of ErrorArgs.Of). Machine codes in snake_case
 * (terms_required, expired, …) are special codes with their own keys and are skipped.
 *
 *   node scripts/gen-backend-messages.mjs           regenerate
 *   node scripts/gen-backend-messages.mjs --check   fail if errors.json is out of date or a call site has no code
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoots = ["Coffer.BusinessLogic", "Coffer.ASPNET"].map((d) => join(root, "..", d));
const check = process.argv.includes("--check");

// code literal, then the message literal
const SITE = /(?:MarketplaceException\.\w+\(|this\.ApiError\([^,]+,)\s*"([^"]+)"\s*,\s*(\$?)"((?:[^"\\]|\\.)*)"/g;
// a MarketplaceException factory whose first argument is not a code (prose) — would be an untranslatable error
const NO_CODE = /MarketplaceException\.\w+\(\s*\$?"((?:[^"\\]|\\.)*)"\s*\)/g;
const CODE = /^[a-z][A-Za-z0-9]*$/;

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === "bin" || f === "obj") continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith(".cs")) out.push(p);
  }
  return out;
}

function toMessage(raw, interpolated) {
  let text = raw.replace(/\\"/g, '"').replace(/\\n/g, " ");
  if (!interpolated) return text;
  let i = 0;
  text = text.replace(/\{\{/g, "\u0001").replace(/\}\}/g, "\u0002");
  text = text.replace(/\{[^}]*\}/g, () => `{{p${i++}}}`);
  return text.replace(/\u0001/g, "{").replace(/\u0002/g, "}");
}

const messages = new Map();
const problems = [];
for (const dir of backendRoots) {
  for (const file of walk(dir)) {
    const src = readFileSync(file, "utf8");
    const where = (index) => `${relative(join(root, ".."), file)}:${src.slice(0, index).split("\n").length}`;
    for (const m of src.matchAll(SITE)) {
      const [, code, dollar, raw] = m;
      if (!CODE.test(code)) continue; // special machine code (snake_case)
      const message = toMessage(raw, dollar === "$");
      const prev = messages.get(code);
      if (prev !== undefined && prev !== message) problems.push(`${where(m.index)}: code "${code}" already used for "${prev}"`);
      messages.set(code, message);
    }
    for (const m of src.matchAll(NO_CODE)) problems.push(`${where(m.index)}: error without a code: "${m[1]}"`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const backend = Object.fromEntries([...messages.entries()].sort(([a], [b]) => a.localeCompare(b)));
const errorsPath = join(root, "src/i18n/locales/en/errors.json");
const current = readFileSync(errorsPath, "utf8");
const errors = JSON.parse(current);
errors.backend = backend;
const next = JSON.stringify(errors, null, 2) + "\n";

if (check) {
  if (current.replace(/\r\n/g, "\n") !== next) {
    console.error("errors.json backend section is out of date: run node scripts/gen-backend-messages.mjs");
    process.exit(1);
  }
  console.log(`${messages.size} backend error codes, up to date`);
} else {
  writeFileSync(errorsPath, next);
  console.log(`${messages.size} backend error codes`);
}
