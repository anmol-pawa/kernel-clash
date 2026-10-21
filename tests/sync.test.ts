import { describe, expect, it } from "vitest";
import {
  CHECK_THEN_FLAG,
  FLAG_THEN_CHECK,
  PETERSON,
  START,
  explore,
  finalValues,
  increment,
  instrText,
  interleavings,
  runSchedule,
  runSemaphore,
  trace,
  type SyncThread,
} from "@/game/sim/sync";

const producerConsumer: SyncThread[] = [
  { name: "P", code: increment("counter", "r1", 1) },
  { name: "C", code: increment("counter", "r2", -1) },
];

describe("interleaving simulator", () => {
  it("replays Silberschatz §6.1's T0–T5 interleaving: counter = 5 ends at 4", () => {
    const run = runSchedule({ counter: 5 }, producerConsumer, [0, 0, 1, 1, 0, 1]);
    expect(run.steps.map((s) => s.value)).toEqual([5, 6, 5, 4, 6, 4]);
    expect(run.shared.counter).toBe(4);
    expect(run.done).toBe(true);
  });

  it("gives 6 when the producer stores last, and 5 when they don't overlap", () => {
    expect(runSchedule({ counter: 5 }, producerConsumer, [0, 0, 1, 1, 1, 0]).shared.counter).toBe(6);
    expect(runSchedule({ counter: 5 }, producerConsumer, [0, 0, 0, 1, 1, 1]).shared.counter).toBe(5);
    expect(runSchedule({ counter: 5 }, producerConsumer, [1, 1, 1, 0, 0, 0]).shared.counter).toBe(5);
  });

  it("finds every possible final value", () => {
    expect(finalValues({ counter: 5 }, producerConsumer, "counter")).toEqual([4, 5, 6]);
    const two = (n: number): SyncThread[] => [0, 1].map((t) => ({ name: `T${t}`, code: Array.from({ length: n }, () => increment("x", "r")).flat() }));
    expect(finalValues({ x: 0 }, two(1), "x")).toEqual([1, 2]);
    // the classic result: two threads doing x++ n ≥ 2 times can end as low as 2, never 1
    expect(finalValues({ x: 0 }, two(2), "x")).toEqual([2, 3, 4]);
    expect(finalValues({ x: 0 }, two(3), "x")).toEqual([2, 3, 4, 5, 6]);
  });

  it("enumerates the multinomial number of interleavings, each keeping per-thread order", () => {
    expect(interleavings([3, 3])).toHaveLength(20);
    expect(interleavings([2, 2, 2])).toHaveLength(90);
    const all = interleavings([2, 1]).map((s) => s.join(""));
    expect(all.sort()).toEqual(["001", "010", "100"]);
  });

  it("writes instructions the way the lessons show them, and rejects bad schedules", () => {
    expect(producerConsumer[1].code.map(instrText)).toEqual(["r2 = counter", "r2 = r2 - 1", "counter = r2"]);
    expect(() => runSchedule({ counter: 5 }, producerConsumer, [0, 0, 0, 0])).toThrow(/no step/);
    expect(runSchedule({ counter: 5 }, producerConsumer, [0]).done).toBe(false);
  });
});

describe("two-process entry protocols", () => {
  it("Peterson's solution: mutual exclusion and no state where both spin", () => {
    const r = explore(PETERSON);
    expect(r.mutualExclusion).toBe(true);
    expect(r.stuck).toBe(false);
  });

  it("checking the other's flag before raising your own breaks mutual exclusion", () => {
    expect(explore(CHECK_THEN_FLAG).mutualExclusion).toBe(false);
    // both pass the check before either flag is up
    const s = trace(CHECK_THEN_FLAG, [0, 1, 0, 1]).at(-1)!;
    expect(s.pc).toEqual([CHECK_THEN_FLAG.cs, CHECK_THEN_FLAG.cs]);
  });

  it("raising your flag before checking is safe but can deadlock", () => {
    const r = explore(FLAG_THEN_CHECK);
    expect(r.mutualExclusion).toBe(true);
    expect(r.stuck).toBe(true);
  });

  it("whoever writes turn last waits (the Peterson quick check)", () => {
    // flags up, P0 sets turn = 1, then P1 sets turn = 0
    const states = trace(PETERSON, [0, 1, 0, 1, 1, 1, 0]);
    const s = states.at(-1)!;
    expect(states[4].turn).toBe(0);
    expect(s.pc).toEqual([PETERSON.cs, 2]); // P0 is in, P1 spins
    // P1 gets in once P0 leaves and lowers its flag
    const after = trace(PETERSON, [1, 0, 0, 1], s).at(-1)!;
    expect(after.flag[0]).toBe(false);
    expect(after.pc[1]).toBe(PETERSON.cs);
    expect(START.flag).toEqual([false, false]);
  });
});

describe("blocking semaphore", () => {
  it("goes negative by the number waiting", () => {
    const r = runSemaphore(2, ["A", "B", "C", "D", "E"].map((who) => ({ op: "wait" as const, who })));
    expect(r.value).toBe(-3);
    expect(r.blocked).toEqual(["C", "D", "E"]);
  });

  it("signal() wakes the longest waiter, and only when someone waits", () => {
    const r = runSemaphore(1, [
      { op: "wait", who: "A" },
      { op: "wait", who: "B" },
      { op: "wait", who: "C" },
      { op: "signal", who: "A" },
    ]);
    expect(r).toEqual({ value: -1, blocked: ["C"], woken: ["B"] });
    expect(runSemaphore(0, [{ op: "signal", who: "A" }])).toEqual({ value: 1, blocked: [], woken: [] });
  });

  it("orders S1 before S2 with synch = 0 (Silberschatz §6.6.1)", () => {
    // P2 reaches wait(synch) first and sleeps until P1 signals after S1
    const r = runSemaphore(0, [
      { op: "wait", who: "P2" },
      { op: "signal", who: "P1" },
    ]);
    expect(r.woken).toEqual(["P2"]);
    expect(() => runSemaphore(0, [{ op: "wait", who: "P2" }, { op: "signal", who: "P2" }])).toThrow(/blocked/);
  });
});
