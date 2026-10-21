import { describe, expect, it } from "vitest";
import { raceInterleave } from "@/content/syncGenerators";
import { grade, type InterleaveQ } from "@/game/engine/question";
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
  lostUpdates,
  runSchedule,
  runSemaphore,
  scheduleText,
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

describe("lost updates", () => {
  it("Silberschatz's T0–T5 run loses the producer's update; serial runs lose nothing", () => {
    expect(lostUpdates({ counter: 5 }, producerConsumer, [0, 0, 1, 1, 0, 1])).toEqual([0]);
    expect(lostUpdates({ counter: 5 }, producerConsumer, [1, 1, 0, 0, 1, 0])).toEqual([1]);
    expect(lostUpdates({ counter: 5 }, producerConsumer, [0, 0, 0, 1, 1, 1])).toEqual([]);
    expect(lostUpdates({ counter: 5 }, producerConsumer, [1, 1, 1, 0, 0, 0])).toEqual([]);
  });
  it("a schedule loses an update exactly when the result differs from the serial one", () => {
    for (const s of interleavings([3, 3])) {
      const end = runSchedule({ counter: 5 }, producerConsumer, s).shared.counter;
      expect(lostUpdates({ counter: 5 }, producerConsumer, s).length > 0, s.join("")).toBe(end !== 5);
    }
  });
  it("writes a schedule out step by step", () => {
    expect(scheduleText(producerConsumer, [0, 1, 0, 1, 0, 1])).toBe("P: r1 = counter → C: r2 = counter → P: r1 = r1 + 1 → C: r2 = r2 - 1 → P: counter = r1 → C: counter = r2");
  });
});

/**
 * An independent check for the interleave generator: parse each thread's
 * change back out of the prompt, then try every interleaving by hand with a
 * tiny load/compute/store model (no shared code with the simulator).
 */
function handResults(q: InterleaveQ): Map<string, number> {
  const init = q.init[q.goal.v];
  // "NAME runs v++", "v -= 30", "x++ twice"
  const deltas = q.threads.map((t) => {
    const m = new RegExp(`${t.name} runs ${q.goal.v}(\\+\\+|--| \\+= (\\d+)| -= (\\d+))( twice)?`).exec(q.prompt);
    if (!m) throw new Error(`can't read ${t.name} from ${q.prompt}`);
    const k = m[1] === "++" ? 1 : m[1] === "--" ? -1 : m[2] ? Number(m[2]) : -Number(m[3]);
    return m[4] ? [k, k] : [k];
  });
  const out = new Map<string, number>();
  const walk = (sched: number[], pos: number[][], v: number, reg: number[]) => {
    if (q.threads.every((t, i) => pos[i][0] === deltas[i].length)) return void out.set(sched.join(","), v);
    q.threads.forEach((_, i) => {
      const [op, phase] = pos[i];
      if (op === deltas[i].length) return;
      const p = pos.map((x) => [...x]);
      const r = [...reg];
      let nv = v;
      if (phase === 0) r[i] = v;
      else if (phase === 1) r[i] += deltas[i][op];
      else nv = r[i];
      p[i] = phase === 2 ? [op + 1, 0] : [op, phase + 1];
      walk([...sched, i], p, nv, r);
    });
  };
  walk([], q.threads.map(() => [0, 0]), init, q.threads.map(() => 0));
  return out;
}

describe("interleave generator", () => {
  it("asks for a reachable value that no serial order gives, and grades every schedule like a hand model", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 150; seed++) {
      const q = raceInterleave.make(seed) as InterleaveQ;
      kinds.add(q.threads.map((t) => t.name).join("/") + q.threads[0].code.length);
      const results = handResults(q);
      const serial = q.threads.length === 2 ? [results.get(q.threads.flatMap((t, i) => t.code.map(() => i)).join(",")), results.get([...q.threads].reverse().flatMap((t) => t.code.map(() => q.threads.indexOf(t))).join(","))] : [];
      expect(serial[0], q.id).toBe(serial[1]);
      expect(q.goal.value, q.id).not.toBe(serial[0]);
      expect([...results.values()], q.id).toContain(q.goal.value);
      for (const [key, end] of results) expect(grade(q, { kind: "interleave", schedule: key.split(",").map(Number) }), `${q.id} ${key}`).toBe(end === q.goal.value);
      expect(results.get(q.answer.join(",")), q.id).toBe(q.goal.value);
      expect(q.prompt, q.id).toContain(`at ${q.goal.value}.`);
    }
    // producer/consumer, two counters, the bank and the run-twice thread all show up
    expect(kinds.size).toBe(4);
  });
});
