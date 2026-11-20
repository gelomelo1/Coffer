import { test } from "node:test";
import assert from "node:assert/strict";
import { HeldActionQueue } from "../src/utils/held_action.ts";

/** Manual timers: fire() runs whatever is scheduled. */
function fakeTimers() {
  let scheduled: (() => void) | null = null;
  return {
    setTimer: (fn: () => void) => {
      scheduled = fn;
      return 1;
    },
    clearTimer: () => {
      scheduled = null;
    },
    fire: () => {
      const fn = scheduled;
      scheduled = null;
      fn?.();
    },
    get pending() {
      return scheduled !== null;
    },
  };
}

const flushPromises = () => new Promise((r) => setImmediate(r));

function action(id: string, sent: string[], fail = false) {
  return {
    id,
    label: id,
    send: async () => {
      if (fail) throw new Error("nope");
      sent.push(id);
    },
  };
}

test("a held action is sent when the delay ends, once", async () => {
  const timers = fakeTimers();
  const sent: string[] = [];
  const queue = new HeldActionQueue({ delayMs: 5000, ...timers });
  queue.hold(action("a", sent));
  await flushPromises();
  assert.deepEqual(sent, []);
  timers.fire();
  await flushPromises();
  assert.deepEqual(sent, ["a"]);
  assert.equal(queue.held, null);
});

test("undo cancels the held action", async () => {
  const timers = fakeTimers();
  const sent: string[] = [];
  const queue = new HeldActionQueue({ delayMs: 5000, ...timers });
  queue.hold(action("a", sent));
  assert.equal(queue.undo()?.id, "a");
  assert.equal(timers.pending, false);
  await flushPromises();
  assert.deepEqual(sent, []);
  assert.equal(queue.undo(), null);
});

test("holding a second action sends the first immediately", async () => {
  const timers = fakeTimers();
  const sent: string[] = [];
  const queue = new HeldActionQueue({ delayMs: 5000, ...timers });
  queue.hold(action("a", sent));
  queue.hold(action("b", sent));
  await flushPromises();
  assert.deepEqual(sent, ["a"]);
  assert.equal(queue.held?.id, "b");
});

test("flush sends the held action now", async () => {
  const timers = fakeTimers();
  const sent: string[] = [];
  const queue = new HeldActionQueue({ delayMs: 5000, ...timers });
  queue.hold(action("a", sent));
  await queue.flush();
  assert.deepEqual(sent, ["a"]);
  assert.equal(timers.pending, false);
  await queue.flush(); // nothing held: no-op
  assert.deepEqual(sent, ["a"]);
});

test("a failed send is reported, not thrown", async () => {
  const timers = fakeTimers();
  const failed: string[] = [];
  const sentOk: string[] = [];
  const queue = new HeldActionQueue({ delayMs: 5000, ...timers, onFailed: (a) => failed.push(a.id), onSent: (a) => sentOk.push(a.id) });
  queue.hold(action("a", [], true));
  await queue.flush();
  assert.deepEqual(failed, ["a"]);
  assert.deepEqual(sentOk, []);
});
