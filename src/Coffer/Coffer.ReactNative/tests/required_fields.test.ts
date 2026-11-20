import { test } from "node:test";
import assert from "node:assert/strict";
import { isFilled, isRequired, missingRequired, orderFields } from "../src/utils/required_fields.ts";

// dataType codes (AttributeDataTypes): 0 String, 1 Number, 2 Date, 3 Boolean, 4 Select, 5 Multi_Select, 6 Autocomplete
const notes = { id: 1, name: "Notes", dataType: 0, primary: false, required: false };
const brand = { id: 2, name: "Brand", dataType: 0, primary: true, required: false };
const year = { id: 3, name: "Year", dataType: 1, primary: false, required: true };
const sealed = { id: 4, name: "Sealed", dataType: 3, primary: false, required: true };

test("the primary attribute is always required", () => {
  assert.equal(isRequired(brand), true);
  assert.equal(isRequired(year), true);
  assert.equal(isRequired(notes), false);
});

test("missing required fields are listed primary first", () => {
  const missing = missingRequired([notes, year, brand], { 2: "", 3: null });
  assert.deepEqual(missing.map((a) => a.name), ["Brand", "Year"]);
  assert.deepEqual(missingRequired([notes, year, brand], { 2: "Heineken", 3: 1968 }), []);
});

test("a yes/no field always counts as filled", () => {
  assert.equal(isFilled(sealed, false), true);
  assert.equal(isFilled(sealed, undefined), true);
});

test("zero is a filled number, blank text is missing", () => {
  assert.equal(isFilled(year, 0), true);
  assert.equal(isFilled(year, null), false);
  assert.equal(isFilled(brand, "   "), false);
  assert.equal(isFilled({ ...brand, dataType: 2 }, "2026-11-20T00:00:00Z"), true);
});

test("required fields come first, the primary on top, then the optional ones", () => {
  const { required, optional } = orderFields([notes, year, sealed, brand]);
  assert.deepEqual(required.map((a) => a.name), ["Brand", "Year", "Sealed"]);
  assert.deepEqual(optional.map((a) => a.name), ["Notes"]);
});
