import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, readableTextOn } from "../src/utils/contrast.ts";

const NAVY = "#19283f";
const CREAM = "#fefdf0";

test("contrast ratio of black on white is 21", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
});

test("navy text on a light pastel tag", () => {
  assert.equal(readableTextOn("#8fbc8f", NAVY, CREAM), NAVY);
});

test("cream text on a dark tag", () => {
  assert.equal(readableTextOn(NAVY, NAVY, CREAM), CREAM);
});

test("gold brand color takes navy text", () => {
  assert.equal(readableTextOn("#a98d3c", NAVY, CREAM), NAVY);
});

test("accepts 3-digit hex and falls back to the light text for unparseable colors", () => {
  assert.equal(readableTextOn("#fff", NAVY, CREAM), NAVY);
  assert.equal(readableTextOn("dimgray", NAVY, CREAM), CREAM);
});
