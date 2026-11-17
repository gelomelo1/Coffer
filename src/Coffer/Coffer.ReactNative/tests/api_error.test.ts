import { test } from "node:test";
import assert from "node:assert/strict";
import { mapApiError } from "../src/utils/api_error.ts";

/** Codes the app has an English text for (errors:backend.<code>). */
const known = new Set(["onlyActiveListingsCanBeArchived", "listingNotFound", "accountSuspendedUntil"]);

const axiosError = (response?: { status: number; data?: unknown }, code?: string) => ({ isAxiosError: true, response, code });

test("network error without a response", () => {
  assert.deepEqual(mapApiError(axiosError(), known), { key: "errors:network" });
});

test("timeout", () => {
  assert.deepEqual(mapApiError(axiosError(undefined, "ECONNABORTED"), known), { key: "errors:timeout" });
});

test("special machine-readable codes keep their own keys", () => {
  const r = mapApiError(axiosError({ status: 409, data: { code: "terms_required", message: "Accept the terms first." } }), known);
  assert.deepEqual(r, { key: "errors:termsRequired" });
});

test("a backend error code maps to its translation key", () => {
  const r = mapApiError(axiosError({ status: 409, data: { code: "onlyActiveListingsCanBeArchived", message: "Only active listings can be archived." } }), known);
  assert.deepEqual(r, { key: "errors:backend.onlyActiveListingsCanBeArchived" });
});

test("error code params are passed on for interpolation", () => {
  const r = mapApiError(axiosError({ status: 404, data: { code: "listingNotFound", params: { p0: "42" }, message: "Listing 42 not found" } }), known);
  assert.deepEqual(r, { key: "errors:backend.listingNotFound", params: { p0: "42" } });
});

test("the English message is no longer matched: wording changes can't break translations", () => {
  const r = mapApiError(axiosError({ status: 409, data: { message: "Only active listings can be archived." } }), known);
  assert.deepEqual(r, { key: "errors:conflict" });
});

test("an unknown code falls back to the status", () => {
  const r = mapApiError(axiosError({ status: 400, data: { code: "somethingNew", message: "Something new" } }), known);
  assert.deepEqual(r, { key: "errors:badRequest" });
});

test("without a code the status decides", () => {
  assert.deepEqual(mapApiError(axiosError({ status: 400, data: "plain text" }), known), { key: "errors:badRequest" });
  assert.deepEqual(mapApiError(axiosError({ status: 401 }), known), { key: "errors:unauthorized" });
  assert.deepEqual(mapApiError(axiosError({ status: 403 }), known), { key: "errors:forbidden" });
  assert.deepEqual(mapApiError(axiosError({ status: 404 }), known), { key: "errors:notFound" });
  assert.deepEqual(mapApiError(axiosError({ status: 409 }), known), { key: "errors:conflict" });
  assert.deepEqual(mapApiError(axiosError({ status: 413 }), known), { key: "errors:tooLarge" });
  assert.deepEqual(mapApiError(axiosError({ status: 429 }), known), { key: "errors:tooManyRequests" });
  assert.deepEqual(mapApiError(axiosError({ status: 503 }), known), { key: "errors:server" });
});

test("non-axios errors are unknown", () => {
  assert.deepEqual(mapApiError(new Error("boom"), known), { key: "errors:unknown" });
  assert.deepEqual(mapApiError(undefined, known), { key: "errors:unknown" });
});
