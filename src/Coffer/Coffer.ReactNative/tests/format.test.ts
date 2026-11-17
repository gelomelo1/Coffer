import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmountInput, formatDecimal, formatMoney, formatNumberShort, withCurrencySymbol } from "../src/utils/format.ts";

/** Intl uses no-break spaces (U+00A0 / U+202F) between groups and before the currency sign. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

test("money: English puts the euro sign first with a decimal point", () => {
  assert.equal(plain(formatMoney(150, "en")), "€1.50");
  assert.equal(plain(formatMoney(1200, "en")), "€12");
  assert.equal(plain(formatMoney(123456, "en")), "€1,234.56");
});

test("money: Hungarian uses a decimal comma, space grouping and a trailing euro sign", () => {
  assert.equal(plain(formatMoney(150, "hu")), "1,50 €");
  assert.equal(plain(formatMoney(1200, "hu")), "12 €");
  // Hungarian groups digits only from five upwards (CLDR minimumGroupingDigits = 2).
  assert.equal(plain(formatMoney(123456, "hu")), "1234,56 €");
  assert.equal(plain(formatMoney(1234500, "hu")), "12 345 €");
});

test("decimals follow the language", () => {
  assert.equal(formatDecimal(4.5, "en", 1), "4.5");
  assert.equal(formatDecimal(4.5, "hu", 1), "4,5");
  assert.equal(formatDecimal(4, "hu", 1), "4,0");
});

test("price input prefill uses the language's decimal separator, without grouping or currency", () => {
  assert.equal(formatAmountInput(150, "hu"), "1,50");
  assert.equal(formatAmountInput(150, "en"), "1.50");
  assert.equal(formatAmountInput(123400, "hu"), "1234");
});

test("short numbers use the language's separator and suffixes", () => {
  assert.equal(formatNumberShort(999, "en"), "999");
  assert.equal(formatNumberShort(1530, "en"), "1.53k");
  assert.equal(formatNumberShort(1530, "hu"), "1,53 E");
  assert.equal(formatNumberShort(2_000_000, "hu"), "2 M");
  assert.equal(formatNumberShort(3_100_000_000, "hu"), "3,1 Mrd");
});

test("a currency code printed by an engine without narrow-symbol data (Hermes) becomes the symbol", () => {
  assert.equal(plain(withCurrencySymbol("1\u00a0234,50\u00a0EUR", "EUR")), "1 234,50 €");
  assert.equal(plain(withCurrencySymbol("EUR\u00a01.50", "EUR")), "€1.50");
  assert.equal(withCurrencySymbol("€1.50", "EUR"), "€1.50");
});
