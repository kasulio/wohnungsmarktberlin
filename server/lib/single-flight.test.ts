import { describe, expect, test } from "bun:test";
import { createCoalescedRunner, createSkipIfRunning } from "./single-flight";

describe("createSkipIfRunning", () => {
  test("skips overlapping calls while the first run is in flight", async () => {
    const guard = createSkipIfRunning<string>();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    const first = guard.run(async () => {
      await gate;
      return "done";
    });
    expect(guard.isRunning()).toBe(true);

    const second = await guard.run(async () => "should-not-run");
    expect(second).toEqual({ skipped: true });

    release();
    expect(await first).toEqual({ skipped: false, value: "done" });
    expect(guard.isRunning()).toBe(false);

    const third = await guard.run(async () => "next");
    expect(third).toEqual({ skipped: false, value: "next" });
  });
});

describe("createCoalescedRunner", () => {
  test("shares one in-flight execution by default", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    const run = createCoalescedRunner(async () => {
      calls++;
      await gate;
      return calls;
    });

    const a = run();
    const b = run();
    release();
    expect(await Promise.all([a, b])).toEqual([1, 1]);
    expect(calls).toBe(1);
  });

  test("schedules one follow-up pass when rerunWhenKicked is enabled", async () => {
    let calls = 0;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => {
      releaseFirst = r;
    });

    const run = createCoalescedRunner(
      async () => {
        calls++;
        if (calls === 1) await firstGate;
        return calls;
      },
      { rerunWhenKicked: true },
    );

    const first = run();
    const second = run();
    const third = run();
    releaseFirst();

    await Promise.all([first, second, third]);
    // Allow follow-up microtask to settle
    await Bun.sleep(10);
    expect(calls).toBe(2);
  });
});
