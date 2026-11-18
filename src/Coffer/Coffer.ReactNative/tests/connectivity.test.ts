import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFailure, isDeviceOffline } from "../src/utils/connectivity.ts";

const noAnswer = (code = "ERR_NETWORK") => ({ isAxiosError: true, code });
const answered = (status: number) => ({ isAxiosError: true, response: { status } });

test("no answer while the phone is offline → the no-internet page", () => {
  assert.equal(classifyFailure(noAnswer(), true), "offline");
  assert.equal(classifyFailure(noAnswer("ECONNABORTED"), true), "offline");
});

test("no answer while the phone is online → the server-unavailable page", () => {
  assert.equal(classifyFailure(noAnswer(), false), "server");
});

test("a proxy answering that the server is down counts as server unavailable", () => {
  for (const status of [502, 503, 504]) assert.equal(classifyFailure(answered(status), false), "server");
});

test("a slow answer while online stays an ordinary error (e.g. a big photo upload timing out)", () => {
  assert.equal(classifyFailure(noAnswer("ECONNABORTED"), false), null);
  assert.equal(classifyFailure(noAnswer("ETIMEDOUT"), false), null);
});

test("answers from the server and cancelled requests are not connection problems", () => {
  for (const status of [400, 401, 403, 404, 409, 500]) assert.equal(classifyFailure(answered(status), false), null);
  assert.equal(classifyFailure(noAnswer("ERR_CANCELED"), true), null);
  assert.equal(classifyFailure(new Error("boom"), true), null);
});

test("the phone is offline only when it says so (unknown reachability counts as online)", () => {
  assert.equal(isDeviceOffline({ isConnected: false, isInternetReachable: null }), true);
  assert.equal(isDeviceOffline({ isConnected: true, isInternetReachable: false }), true);
  assert.equal(isDeviceOffline({ isConnected: true, isInternetReachable: null }), false);
  assert.equal(isDeviceOffline({ isConnected: null, isInternetReachable: null }), false);
});
