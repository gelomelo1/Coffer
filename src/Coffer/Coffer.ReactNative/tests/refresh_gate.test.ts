import { test } from "node:test";
import assert from "node:assert/strict";
import { createRefreshGate } from "../src/utils/refresh_gate.ts";

test("single_flight_refresh: concurrent 401s share one refresh", async () => {
  let calls = 0;
  let release!: (token: string) => void;
  const gate = createRefreshGate(() => {
    calls++;
    return new Promise<string>((resolve) => (release = resolve));
  });

  const waiters = Array.from({ length: 5 }, () => gate());
  release("new-access");

  assert.deepEqual(await Promise.all(waiters), Array(5).fill("new-access"));
  assert.equal(calls, 1);
});

test("next_call_after_settle_refreshes_again", async () => {
  let calls = 0;
  const gate = createRefreshGate(async () => `token-${++calls}`);

  assert.equal(await gate(), "token-1");
  assert.equal(await gate(), "token-2");
});

test("refresh_failure_signs_out_once: every waiter fails, sign-out runs once", async () => {
  let failures = 0;
  let seen: unknown;
  let reject!: (e: Error) => void;
  const gate = createRefreshGate(
    () => new Promise<string>((_, r) => (reject = r)),
    (error) => {
      failures++;
      seen = error;
    },
  );

  const waiters = Array.from({ length: 5 }, () => gate());
  const cause = new Error("session ended");
  reject(cause);

  const results = await Promise.allSettled(waiters);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(failures, 1);
  assert.equal(seen, cause);
});

test("a failed refresh does not block the next attempt", async () => {
  let calls = 0;
  const gate = createRefreshGate(async () => {
    calls++;
    if (calls === 1) throw new Error("offline");
    return "token";
  });

  await assert.rejects(gate());
  assert.equal(await gate(), "token");
});
