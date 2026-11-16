import { test } from "node:test";
import assert from "node:assert/strict";
import { mapApiError, type BackendMessage } from "../src/utils/api_error.ts";

const table: BackendMessage[] = [
  { text: "Only active listings can be archived.", key: "errors:backend.onlyActiveListingsCanBeArchived" },
  { pattern: "Listing {{p0}} not found", key: "errors:backend.listingNotFound" },
  { pattern: "Your account is suspended until {{p0}} UTC.", key: "errors:backend.accountSuspendedUntil" },
];

const axiosError = (response?: { status: number; data?: unknown }, code?: string) => ({ isAxiosError: true, response, code });

test("network error without a response", () => {
  assert.deepEqual(mapApiError(axiosError(), table), { key: "errors:network" });
});

test("timeout", () => {
  assert.deepEqual(mapApiError(axiosError(undefined, "ECONNABORTED"), table), { key: "errors:timeout" });
});

test("known machine-readable code wins over the message", () => {
  const r = mapApiError(axiosError({ status: 409, data: { code: "terms_required", message: "Accept the terms first." } }), table);
  assert.deepEqual(r, { key: "errors:termsRequired" });
});

test("exact backend message maps to its key", () => {
  const r = mapApiError(axiosError({ status: 409, data: { message: "Only active listings can be archived." } }), table);
  assert.deepEqual(r, { key: "errors:backend.onlyActiveListingsCanBeArchived" });
});

test("interpolated backend message maps to its key with params", () => {
  const r = mapApiError(axiosError({ status: 404, data: { message: "Listing 42 not found" } }), table);
  assert.deepEqual(r, { key: "errors:backend.listingNotFound", params: { p0: "42" } });
});

test("plain-string response bodies are matched too", () => {
  const r = mapApiError(axiosError({ status: 400, data: "Only active listings can be archived." }), table);
  assert.deepEqual(r, { key: "errors:backend.onlyActiveListingsCanBeArchived" });
});

test("unknown message falls back to the status", () => {
  assert.deepEqual(mapApiError(axiosError({ status: 409, data: { message: "Something new" } }), table), { key: "errors:conflict" });
  assert.deepEqual(mapApiError(axiosError({ status: 400 }), table), { key: "errors:badRequest" });
  assert.deepEqual(mapApiError(axiosError({ status: 401 }), table), { key: "errors:unauthorized" });
  assert.deepEqual(mapApiError(axiosError({ status: 403 }), table), { key: "errors:forbidden" });
  assert.deepEqual(mapApiError(axiosError({ status: 404 }), table), { key: "errors:notFound" });
  assert.deepEqual(mapApiError(axiosError({ status: 413 }), table), { key: "errors:tooLarge" });
  assert.deepEqual(mapApiError(axiosError({ status: 429 }), table), { key: "errors:tooManyRequests" });
  assert.deepEqual(mapApiError(axiosError({ status: 503 }), table), { key: "errors:server" });
});

test("non-axios errors are unknown", () => {
  assert.deepEqual(mapApiError(new Error("boom"), table), { key: "errors:unknown" });
  assert.deepEqual(mapApiError(undefined, table), { key: "errors:unknown" });
});
