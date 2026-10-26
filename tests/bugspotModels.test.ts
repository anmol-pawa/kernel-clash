import { describe, expect, it } from "vitest";
import { BUGSPOT_QUESTIONS } from "@/content/bugspotQuestions";
import { explore, finalValues, isSafe, type Op, type Program } from "@/game/sim/threads";

/**
 * The concurrency bugs in the 6.1 bug-spotting snippets as runnable models:
 * the buggy version must fail in some interleaving and the fix must be safe in
 * all of them, so the answer keys are proven rather than trusted.
 */
const lockAll = (m: string, body: Op[]): Op[] => [{ op: "lock", m }, ...body, { op: "unlock", m }];

const BUGGY_AND_FIXED: Record<string, { buggy: Program; fixed: Program }> = {
  // counter++ is load, add, store
  "bs-counter": (() => {
    const inc: Op[] = [{ op: "load", reg: "r", v: "counter" }, { op: "add", reg: "r", k: 1 }, { op: "store", v: "counter", reg: "r" }];
    // main joins both workers, then checks the total
    const worker = (code: Op[]): Op[] => [...code, { op: "post", s: "done" }];
    const main: Op[] = [
      { op: "wait", s: "done" },
      { op: "wait", s: "done" },
      { op: "assert", a: "counter", cmp: "==", b: 2, msg: "lost update: counter is not 2" },
    ];
    const mk = (code: Op[]): Program => ({
      threads: [{ name: "A", code: worker(code) }, { name: "B", code: worker(code) }, { name: "main", code: main }],
    });
    return { buggy: mk(inc), fixed: mk(lockAll("m", inc)) };
  })(),

  // the attacker swaps the path for a link to a secret file at any moment
  "bs-toctou": (() => {
    const attacker = { name: "X", code: [{ op: "set", v: "target", to: 1 }] satisfies Op[] };
    const victim = (code: Op[]): Program => ({ threads: [{ name: "V", code }, attacker] });
    return {
      buggy: victim([
        { op: "load", reg: "chk", v: "target" }, // access()
        { op: "if", a: "chk", cmp: "!=", b: 0, to: "end" },
        { op: "load", reg: "fd", v: "target" }, // fopen() looks the path up again
        { op: "assert", a: "fd", cmp: "==", b: 0, msg: "wrote through a link to the secret file" },
        { op: "label", name: "end" },
      ]),
      fixed: victim([
        { op: "load", reg: "fd", v: "target" }, // open once, permission is checked on that object
        { op: "if", a: "fd", cmp: "!=", b: 0, to: "end" },
        { op: "assert", a: "fd", cmp: "==", b: 0, msg: "wrote through a link to the secret file" },
        { op: "label", name: "end" },
      ]),
    };
  })(),

  // two consumers, a producer making two items
  "bs-cond-if": (() => {
    const consumer = (loop: boolean): Op[] => [
      { op: "lock", m: "m" },
      { op: "label", name: "top" },
      { op: "if", a: "items", cmp: "!=", b: 0, to: "go" },
      { op: "cwait", c: "ready", m: "m" },
      ...(loop ? [{ op: "jmp", to: "top" } as Op] : []),
      { op: "label", name: "go" },
      { op: "inc", v: "items", k: -1 },
      { op: "assert", a: "items", cmp: ">=", b: 0, msg: "took an item that was not there" },
      { op: "unlock", m: "m" },
    ];
    const give: Op[] = lockAll("m", [{ op: "inc", v: "items", k: 1 }, { op: "signal", c: "ready" }]);
    const mk = (loop: boolean): Program => ({
      threads: [{ name: "P", code: [...give, ...give] }, { name: "C1", code: consumer(loop) }, { name: "C2", code: consumer(loop) }],
    });
    return { buggy: mk(false), fixed: mk(true) };
  })(),

  "bs-lock-order": (() => {
    const both = (a: string, b: string): Op[] => [
      { op: "lock", m: a }, { op: "lock", m: b }, { op: "inc", v: "n", k: 1 }, { op: "unlock", m: b }, { op: "unlock", m: a },
    ];
    const mk = (second: [string, string]): Program => ({ threads: [{ name: "t1", code: both("a", "b") }, { name: "t2", code: both(...second) }] });
    return { buggy: mk(["b", "a"]), fixed: mk(["a", "b"]) };
  })(),

  // a lookup of a missing key (table[idx] == 0) returns early
  "bs-early-return": (() => {
    const lookup = (unlockOnMiss: boolean): Op[] => [
      { op: "lock", m: "m" },
      { op: "if", a: "table", cmp: "!=", b: 0, to: "hit" },
      ...(unlockOnMiss ? [{ op: "unlock", m: "m" } as Op] : []),
      { op: "jmp", to: "end" },
      { op: "label", name: "hit" },
      { op: "unlock", m: "m" },
      { op: "label", name: "end" },
    ];
    const mk = (fix: boolean): Program => ({ threads: [{ name: "A", code: lookup(fix) }, { name: "B", code: lookup(fix) }] });
    return { buggy: mk(false), fixed: mk(true) };
  })(),

  // producer may run before the consumer; the fix must also survive spurious wakeups
  "bs-lost-signal": (() => {
    const producer = (flag: boolean): Op[] => lockAll("m", [...(flag ? [{ op: "set", v: "flag", to: 1 } as Op] : []), { op: "signal", c: "cv" }]);
    const consumer = (flag: boolean): Op[] =>
      flag
        ? lockAll("m", [
            { op: "label", name: "top" },
            { op: "if", a: "flag", cmp: "!=", b: 0, to: "go" },
            { op: "cwait", c: "cv", m: "m" },
            { op: "jmp", to: "top" },
            { op: "label", name: "go" },
          ])
        : lockAll("m", [{ op: "cwait", c: "cv", m: "m" }]);
    const mk = (flag: boolean): Program => ({ spurious: flag, threads: [{ name: "P", code: producer(flag) }, { name: "C", code: consumer(flag) }] });
    return { buggy: mk(false), fixed: mk(true) };
  })(),
};

describe("bugspot concurrency snippets, proven by running every interleaving", () => {
  for (const [id, { buggy, fixed }] of Object.entries(BUGGY_AND_FIXED)) {
    it(`${id}: the bug fails, the fix is safe`, () => {
      expect(BUGSPOT_QUESTIONS.some((q) => q.id === id)).toBe(true);
      const bad = explore({ ...buggy, fairness: true });
      expect(isSafe(bad)).toBe(false);
      const good = explore({ ...fixed, fairness: true });
      expect(good.failure?.message ?? good.deadlock?.message ?? good.starvation?.message).toBeUndefined();
      expect(isSafe(good)).toBe(true);
    });
  }

  it("the unlocked counter can end at 1 or 2, the locked one only at 2", () => {
    const { buggy, fixed } = BUGGY_AND_FIXED["bs-counter"];
    expect(finalValues(explore({ ...buggy, threads: buggy.threads.slice(0, 2) }), "counter")).toEqual([1, 2]);
    expect(finalValues(explore({ ...fixed, threads: fixed.threads.slice(0, 2) }), "counter")).toEqual([2]);
  });

  it("bs-early-return deadlocks (the second caller waits forever) rather than corrupting data", () => {
    expect(explore(BUGGY_AND_FIXED["bs-early-return"].buggy).deadlock).toBeDefined();
  });

  it("bs-cond-if fails by taking an item that is not there, with no spurious wakeup needed", () => {
    expect(explore(BUGGY_AND_FIXED["bs-cond-if"].buggy).failure?.message).toContain("not there");
  });

  it("bs-toctou fails only when the swap lands between the check and the use", () => {
    const r = explore(BUGGY_AND_FIXED["bs-toctou"].buggy);
    const t = r.failure!.trace;
    expect(t.findIndex((s) => s.startsWith("X"))).toBeGreaterThan(t.findIndex((s) => s.includes("chk")));
  });
});

describe("starvation under a fair schedule", () => {
  const spin = (setter: Op[]): Program => ({
    fairness: true,
    threads: [
      { name: "A", code: setter },
      { name: "B", code: [{ op: "label", name: "top" }, { op: "if", a: "flag", cmp: "==", b: 0, to: "top" }] },
    ],
  });

  it("spinning on a flag nobody sets never finishes", () => {
    const r = explore(spin([]));
    expect(r.starvation?.message).toContain("B never finishes");
    expect(isSafe(r)).toBe(false);
  });

  it("the same spin is fine once the flag is set", () => {
    expect(isSafe(explore(spin([{ op: "set", v: "flag", to: 1 }])))).toBe(true);
  });

  it("a thread blocked behind a lock holder that loops forever starves", () => {
    const r = explore({
      fairness: ["B"],
      threads: [
        { name: "hog", code: [{ op: "lock", m: "m" }, { op: "label", name: "l" }, { op: "jmp", to: "l" }] },
        { name: "B", code: [{ op: "lock", m: "m" }, { op: "unlock", m: "m" }] },
      ],
    });
    expect(r.starvation?.message).toContain("B never finishes");
  });

  it("a hog that releases the lock each lap does not starve B: a fair scheduler lets it in", () => {
    const r = explore({
      fairness: ["B"],
      threads: [
        { name: "hog", code: [{ op: "label", name: "l" }, { op: "lock", m: "m" }, { op: "unlock", m: "m" }, { op: "jmp", to: "l" }] },
        { name: "B", code: [{ op: "lock", m: "m" }, { op: "unlock", m: "m" }] },
      ],
    });
    expect(r.starvation).toBeUndefined();
  });
});
