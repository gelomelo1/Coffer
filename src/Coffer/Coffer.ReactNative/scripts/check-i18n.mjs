#!/usr/bin/env node
/**
 * i18n checker.
 *   node scripts/check-i18n.mjs [--locales <dir>] [--allowlist <file>] <paths…>
 *
 * Fails (exit 1) when
 *  (a) a literal translation key — t("ns:key"), i18n.t("ns:key"), i18nKey="ns:key" — is missing from <locales>/<ns>.json
 *      (plural keys resolve through key_one / key_other), or
 *  (b) user-facing text is hardcoded in a .tsx/.ts file: JSX text, string literals in user-facing props / object
 *      properties, label/text constants, or the text arguments of showToast() / Alert.alert().
 * A line (or the line above it) containing `i18n-ignore` is skipped; files listed in the allowlist are skipped.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const TEXT_PROPS = new Set([
  "title",
  "label",
  "placeholder",
  "text1",
  "text2",
  "accessibilityLabel",
  "accessibilityHint",
  "overlayTitle",
  "modalTitle",
  "message",
  "multipleText",
  "emptyText",
  "header",
  "screenTitle",
  "confirmLabel",
  "cancelLabel",
  "helperText",
  "errorMessage",
  "tabBarLabel",
  "text",
  "subtitle",
  "description",
]);
const TEXT_CONST = /(label|labels|text|texts|title|titles|message|messages|placeholder)$/i;
const LETTER = /\p{L}/u;

function parseArgs(argv) {
  const opts = { locales: join(projectRoot, "src", "i18n", "locales", "en"), allowlist: join(projectRoot, "scripts", "i18n-allowlist.txt"), paths: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--locales") opts.locales = resolve(argv[++i]);
    else if (argv[i] === "--allowlist") opts.allowlist = resolve(argv[++i]);
    else opts.paths.push(resolve(argv[i]));
  }
  if (opts.paths.length === 0) opts.paths.push(join(projectRoot, "src"));
  return opts;
}

function loadLocales(dir) {
  const namespaces = {};
  if (!existsSync(dir)) return namespaces;
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".json")) namespaces[f.slice(0, -5)] = JSON.parse(readFileSync(join(dir, f), "utf8"));
  }
  return namespaces;
}

function keyExists(namespaces, fullKey) {
  const colon = fullKey.indexOf(":");
  const ns = colon === -1 ? "common" : fullKey.slice(0, colon);
  const path = colon === -1 ? fullKey : fullKey.slice(colon + 1);
  const root = namespaces[ns];
  if (!root) return false;
  const parts = path.split(".");
  const last = parts.pop();
  let node = root;
  for (const p of parts) {
    if (node == null || typeof node !== "object") return false;
    node = node[p];
  }
  if (node == null || typeof node !== "object") return false;
  return typeof node[last] === "string" || typeof node[`${last}_one`] === "string" || typeof node[`${last}_other`] === "string";
}

function walkFiles(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      walkFiles(join(p, f), out);
    }
  } else if (/\.(tsx|ts)$/.test(p) && !p.endsWith(".d.ts")) out.push(p);
  return out;
}

function loadAllowlist(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\\/g, "/"))
    .filter((l) => l && !l.startsWith("#"));
}

function stringValue(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((s) => s.literal.text).join("");
  if (ts.isJsxExpression(node)) return stringValue(node.expression);
  if (ts.isParenthesizedExpression(node)) return stringValue(node.expression);
  if (ts.isConditionalExpression(node)) return stringValue(node.whenTrue) ?? stringValue(node.whenFalse);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) return stringValue(node.right) ?? stringValue(node.left);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return stringValue(node.right) ?? stringValue(node.left);
  return null;
}

function propName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function checkFile(file, namespaces, problems) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const ignored = (node) => {
    const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line;
    for (let l = Math.max(0, start - 1); l <= end; l++) if (lines[l]?.includes("i18n-ignore")) return true;
    return false;
  };
  const report = (node, msg) => {
    if (ignored(node)) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    problems.push(`${relative(process.cwd(), file).replace(/\\/g, "/")}:${line}  ${msg}`);
  };
  const userText = (s) => s != null && LETTER.test(s);
  const checkKey = (node, key) => {
    if (!keyExists(namespaces, key)) report(node, `missing translation key "${key}"`);
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const s = node.text.replace(/\s+/g, " ").trim();
      if (userText(s)) report(node, `hardcoded JSX text "${s}"`);
    } else if (ts.isJsxAttribute(node)) {
      const name = propName(node.name);
      if (name === "i18nKey") {
        const k = stringValue(node.initializer);
        if (k != null) checkKey(node, k);
      } else if (name && TEXT_PROPS.has(name)) {
        const s = stringValue(node.initializer);
        if (userText(s)) report(node, `hardcoded prop ${name}="${s}"`);
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = propName(node.name);
      const literal = ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer);
      if (name && literal && /Key$/.test(name) && node.initializer.text.includes(":")) {
        checkKey(node.initializer, node.initializer.text);
      } else if (name && TEXT_PROPS.has(name) && literal) {
        if (userText(node.initializer.text)) report(node, `hardcoded property ${name}: "${node.initializer.text}"`);
      }
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && TEXT_CONST.test(node.name.text) && node.initializer) {
      const init = node.initializer;
      if ((ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) && userText(init.text)) {
        report(node, `hardcoded text constant ${node.name.text}`);
      } else if (ts.isObjectLiteralExpression(init)) {
        for (const p of init.properties) {
          if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer) && userText(p.initializer.text)) {
            report(p, `hardcoded label in ${node.name.text}: "${p.initializer.text}"`);
          }
        }
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const calleeText = callee.getText(sf);
      const isT = (ts.isIdentifier(callee) && callee.text === "t") || (ts.isPropertyAccessExpression(callee) && callee.name.text === "t");
      if (isT && node.arguments.length > 0) {
        const a = node.arguments[0];
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) checkKey(a, a.text);
      } else if (calleeText === "showToast") {
        for (const a of node.arguments.slice(1, 3)) {
          const s = stringValue(a);
          if (userText(s)) report(a, `hardcoded toast text "${s}"`);
        }
      } else if (calleeText === "Alert.alert") {
        for (const a of node.arguments.slice(0, 2)) {
          const s = stringValue(a);
          if (userText(s)) report(a, `hardcoded alert text "${s}"`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const opts = parseArgs(process.argv.slice(2));
const namespaces = loadLocales(opts.locales);
const allow = loadAllowlist(opts.allowlist);
const problems = [];
for (const p of opts.paths) {
  for (const file of walkFiles(p, [])) {
    const norm = file.replace(/\\/g, "/");
    if (norm.includes("/i18n/locales/")) continue;
    if (allow.some((a) => norm.endsWith(a))) continue;
    checkFile(file, namespaces, problems);
  }
}
if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n${problems.length} i18n problem(s)`);
  process.exit(1);
}
console.log("i18n check passed");
