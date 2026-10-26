import { describe, expect, it } from "vitest";
import { explore, finalValues, isSafe, type Op, type Program } from "@/game/sim/threads";

/** counter++ as the three machine steps load / add / store. */
const incr = (v: string, reg = "r"): Op[] => [
  { op: "load", reg, v },
  { op: "add", reg, k: 1 },
  { op: "store", v, reg },
];

describe("lost update (Silberschatz ch. 6.1)", () => {
  const racy: Program = {
    threads: [
      { name: "T1", code: incr("counter") },
      { name: "T2", code: incr("counter") },
    ],
  };

  it("two unlocked counter++ can end at 1 or 2", () => {
    const r = explore(racy);
    expect(finalValues(r, "counter")).toEqual([1, 2]);
    expect(r.deadlock).toBeUndefined();
  });

  it("three unlocked increments can end anywhere from 1 to 3", () => {
    const r = explore({ threads: ["T1", "T2", "T3"].map((name) => ({ name, code: incr("counter") })) });
    expect(finalValues(r, "counter")).toEqual([1, 2, 3]);
  });

  it("the same increments under a mutex always give 2", () => {
    const locked = (): Op[] => [{ op: "lock", m: "m" }, ...incr("counter"), { op: "unlock", m: "m" }];
    const r = explore({ threads: [{ name: "T1", code: locked() }, { name: "T2", code: locked() }] });
    expect(finalValues(r, "counter")).toEqual([2]);
    expect(isSafe(r)).toBe(true);
  });

  it("an atomic increment (lock-free fetch-and-add) also gives 2", () => {
    const r = explore({ threads: ["T1", "T2"].map((name) => ({ name, code: [{ op: "inc", v: "counter", k: 1 }] as Op[] })) });
    expect(finalValues(r, "counter")).toEqual([2]);
  });

  it("a mutual-exclusion assert catches two threads in the critical section", () => {
    const enter = (): Op[] => [
      { op: "inc", v: "inside", k: 1 },
      { op: "assert", a: "inside", cmp: "==", b: 1, msg: "two threads inside" },
      { op: "inc", v: "inside", k: -1 },
    ];
    const bad = explore({ threads: [{ name: "T1", code: enter() }, { name: "T2", code: enter() }] });
    expect(bad.failure?.message).toBe("two threads inside");
    expect(bad.failure?.trace.length).toBeLessThanOrEqual(5);
    const guarded = (): Op[] => [{ op: "lock", m: "m" }, ...enter(), { op: "unlock", m: "m" }];
    expect(isSafe(explore({ threads: [{ name: "T1", code: guarded() }, { name: "T2", code: guarded() }] }))).toBe(true);
  });
});

describe("deadlock (Silberschatz ch. 8)", () => {
  const take = (first: string, second: string): Op[] => [
    { op: "lock", m: first },
    { op: "lock", m: second },
    { op: "unlock", m: second },
    { op: "unlock", m: first },
  ];

  it("opposite lock orders deadlock, and the counterexample is one step each", () => {
    const r = explore({ threads: [{ name: "T1", code: take("a", "b") }, { name: "T2", code: take("b", "a") }] });
    expect(r.deadlock?.message).toBe("deadlock: T1, T2 can never move");
    expect([...r.deadlock!.trace].sort()).toEqual(["T1: lock(a)", "T2: lock(b)"]);
    expect(r.deadlock?.trace).toHaveLength(2);
  });

  it("one global lock order removes the cycle", () => {
    const r = explore({ threads: [{ name: "T1", code: take("a", "b") }, { name: "T2", code: take("a", "b") }] });
    expect(r.deadlock).toBeUndefined();
    expect(isSafe(r)).toBe(true);
  });

  it("a missing unlock on one path leaves the next thread stuck", () => {
    const leaky: Op[] = [{ op: "lock", m: "m" }, { op: "if", a: 1, cmp: "==", b: 1, to: "out" }, { op: "unlock", m: "m" }, { op: "label", name: "out" }];
    const r = explore({ threads: [{ name: "T1", code: leaky }, { name: "T2", code: [{ op: "lock", m: "m" }, { op: "unlock", m: "m" }] }] });
    expect(r.deadlock?.message).toBe("deadlock: T2 can never move");
  });

  it("unlocking a mutex you do not hold is reported", () => {
    const r = explore({ threads: [{ name: "T1", code: [{ op: "unlock", m: "m" }] }] });
    expect(r.failure?.message).toBe("T1 unlocks m without holding it");
  });
});

describe("semaphores", () => {
  it("a binary semaphore guards a critical section", () => {
    const guarded = (): Op[] => [
      { op: "wait", s: "mutex" },
      ...incr("counter"),
      { op: "post", s: "mutex" },
    ];
    const r = explore({ sems: { mutex: 1 }, threads: [{ name: "T1", code: guarded() }, { name: "T2", code: guarded() }] });
    expect(finalValues(r, "counter")).toEqual([2]);
  });

  it("a semaphore started at 0 makes B run after A (ordering)", () => {
    const r = explore({
      sems: { go: 0 },
      threads: [
        { name: "A", code: [{ op: "set", v: "x", to: 1 }, { op: "post", s: "go" }] },
        { name: "B", code: [{ op: "wait", s: "go" }, { op: "assert", a: "x", cmp: "==", b: 1, msg: "B ran before A" }] },
      ],
    });
    expect(isSafe(r)).toBe(true);
  });
});

describe("condition variables", () => {
  const waiter = (guard: "while" | "if"): Op[] => [
    { op: "lock", m: "m" },
    { op: "label", name: "top" },
    { op: "if", a: "ready", cmp: "!=", b: 0, to: "go" },
    { op: "cwait", c: "cv", m: "m" },
    ...(guard === "while" ? ([{ op: "jmp", to: "top" }] as Op[]) : []),
    { op: "label", name: "go" },
    { op: "assert", a: "ready", cmp: "==", b: 1, msg: "ran without the condition" },
    { op: "unlock", m: "m" },
  ];
  const setter: Op[] = [{ op: "lock", m: "m" }, { op: "set", v: "ready", to: 1 }, { op: "signal", c: "cv" }, { op: "unlock", m: "m" }];

  it("a signal with no sleeper is lost, so waiting without checking a flag deadlocks", () => {
    const r = explore({
      threads: [
        { name: "W", code: [{ op: "lock", m: "m" }, { op: "cwait", c: "cv", m: "m" }, { op: "unlock", m: "m" }] },
        { name: "S", code: [{ op: "lock", m: "m" }, { op: "signal", c: "cv" }, { op: "unlock", m: "m" }] },
      ],
    });
    expect(r.deadlock?.message).toBe("deadlock: W can never move");
  });

  it("check-in-a-while-loop is safe even with spurious wakeups", () => {
    const r = explore({ spurious: true, threads: [{ name: "W", code: waiter("while") }, { name: "S", code: setter }] });
    expect(isSafe(r)).toBe(true);
  });

  it("an if instead of a while breaks on a spurious wakeup", () => {
    const r = explore({ spurious: true, threads: [{ name: "W", code: waiter("if") }, { name: "S", code: setter }] });
    expect(r.failure?.message).toBe("ran without the condition");
  });

  it("broadcast wakes both sleepers; signal can leave one asleep", () => {
    // each sleeper sets its flag under the mutex before sleeping; the waker only fires once both are set
    const sleeper = (): Op[] => [
      { op: "lock", m: "m" },
      { op: "inc", v: "asleep", k: 1 },
      { op: "cwait", c: "cv", m: "m" },
      { op: "unlock", m: "m" },
    ];
    const waker = (op: "signal" | "broadcast"): Op[] => [
      { op: "label", name: "spin" },
      { op: "lock", m: "m" },
      { op: "if", a: "asleep", cmp: "==", b: 2, to: "fire" },
      { op: "unlock", m: "m" },
      { op: "jmp", to: "spin" },
      { op: "label", name: "fire" },
      { op, c: "cv" },
      { op: "unlock", m: "m" },
    ];
    const run = (op: "signal" | "broadcast") => explore({ threads: [{ name: "A", code: sleeper() }, { name: "B", code: sleeper() }, { name: "K", code: waker(op) }] });
    expect(isSafe(run("broadcast"))).toBe(true);
    expect(run("signal").deadlock?.message).toMatch(/^deadlock: [AB] can never move$/);
  });
});

describe("explorer limits", () => {
  it("reports truncation when the state cap is hit", () => {
    const r = explore({ maxStates: 5, threads: [{ name: "T1", code: incr("c") }, { name: "T2", code: incr("c") }] });
    expect(r.truncated).toBe(true);
    expect(isSafe(r)).toBe(false);
  });

  it("rejects a duplicate label", () => {
    const l: Op = { op: "label", name: "x" };
    expect(() => explore({ threads: [{ name: "T", code: [l, l] }] })).toThrow("duplicate label x");
  });

  it("rejects an unknown label", () => {
    expect(() => explore({ threads: [{ name: "T", code: [{ op: "jmp", to: "nowhere" }] }] })).toThrow("unknown label nowhere");
  });
});
