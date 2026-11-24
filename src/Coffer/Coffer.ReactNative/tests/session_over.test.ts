import { test } from "node:test";
import assert from "node:assert/strict";
import { errorToReport, isSessionOver } from "../src/utils/session_over.ts";

const axiosError = (status?: number) => ({ isAxiosError: true, response: status === undefined ? undefined : { status } });

test("the server said the session is over: sign out", () => {
  assert.equal(isSessionOver(axiosError(401)), true);
  assert.equal(isSessionOver(axiosError(400)), true);
});

test("transient failures keep the tokens (the next request tries again)", () => {
  assert.equal(isSessionOver(axiosError()), false); // no answer: offline, timeout
  assert.equal(isSessionOver(axiosError(500)), false);
  assert.equal(isSessionOver(axiosError(502)), false);
  assert.equal(isSessionOver(axiosError(503)), false);
  assert.equal(isSessionOver(axiosError(429)), false);
});

test("no refresh token stored: already signed out, nothing to do again", () => {
  assert.equal(isSessionOver(new Error("No refresh token")), false);
});

test("which error the failed request reports", () => {
  const original = axiosError(401);
  // Session over / nothing stored: the original 401 (the start screen then shows sign-in).
  assert.equal(errorToReport(original, axiosError(401)), original);
  assert.equal(errorToReport(original, new Error("No refresh token")), original);
  // Transient: the refresh's own failure (offline / server trouble), so the screen offers a retry instead.
  const offline = axiosError();
  assert.equal(errorToReport(original, offline), offline);
  const busy = axiosError(503);
  assert.equal(errorToReport(original, busy), busy);
});
