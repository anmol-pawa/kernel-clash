import { describe, expect, it } from "vitest";
import { FILL_QUESTIONS } from "@/content/fillQuestions";
import { explore, isSafe, type Op, type Program } from "@/game/sim/threads";

/**
 * Each classic fill problem as a runnable model. `build(choice)` turns the
 * option picked for each blank into a program; the simulator then runs every
 * interleaving. The keyed option must be safe, and every other combination
 * must deadlock, fail an assertion or never finish, so the answer key is
 * proven by execution rather than trusted.
 */
type Model = (choice: number[]) => Program;

const N_PHIL = 3;

const MODELS: Record<string, Model> = {
  // producer's two blanks; the consumer is the correct textbook one. 1 slot, 2 items, so overflow is reachable.
  "fill-bb-sem": ([b1, b2]) => {
    const first: Op[][] = [[{ op: "wait", s: "empty" }], [{ op: "wait", s: "full" }], [{ op: "post", s: "empty" }]];
    const last: Op[][] = [[{ op: "post", s: "full" }], [{ op: "post", s: "empty" }], [{ op: "wait", s: "full" }]];
    const put: Op[] = [
      { op: "wait", s: "mutex" },
      { op: "inc", v: "count", k: 1 },
      { op: "assert", a: "count", cmp: "<=", b: 1, msg: "buffer overflow" },
      { op: "post", s: "mutex" },
    ];
    const get: Op[] = [
      { op: "wait", s: "full" },
      { op: "wait", s: "mutex" },
      { op: "assert", a: "count", cmp: ">=", b: 1, msg: "buffer underflow" },
      { op: "inc", v: "count", k: -1 },
      { op: "post", s: "mutex" },
      { op: "post", s: "empty" },
    ];
    const item = [...first[b1], ...put, ...last[b2]];
    return {
      sems: { empty: 1, full: 0, mutex: 1 },
      threads: [
        { name: "P", code: [...item, ...item] },
        { name: "C", code: [...get, ...get] },
      ],
    };
  },

  // two consumers, one producer, one slot, two items
  "fill-bb-cv": ([b1, b2]) => {
    const wake: Op[][] = [[{ op: "signal", c: "not_full" }], [{ op: "signal", c: "not_empty" }], [{ op: "cwait", c: "not_full", m: "m" }]];
    const guard: Op[][] = [
      [{ op: "if", a: "count", cmp: "!=", b: 0, to: "go" }, { op: "cwait", c: "not_empty", m: "m" }],
      [{ op: "label", name: "top" }, { op: "if", a: "count", cmp: "!=", b: 0, to: "top" }, { op: "cwait", c: "not_empty", m: "m" }, { op: "jmp", to: "top" }],
      [{ op: "label", name: "top" }, { op: "if", a: "count", cmp: "!=", b: 0, to: "go" }, { op: "cwait", c: "not_empty", m: "m" }, { op: "jmp", to: "top" }],
    ];
    const consumer: Op[] = [
      { op: "lock", m: "m" },
      ...guard[b1],
      { op: "label", name: "go" },
      { op: "assert", a: "count", cmp: ">=", b: 1, msg: "took an item that was not there" },
      { op: "inc", v: "count", k: -1 },
      ...wake[b2],
      { op: "unlock", m: "m" },
    ];
    const put = (n: number): Op[] => [
      { op: "lock", m: "m" },
      { op: "label", name: `top${n}` },
      { op: "if", a: "count", cmp: "!=", b: 1, to: `go${n}` },
      { op: "cwait", c: "not_full", m: "m" },
      { op: "jmp", to: `top${n}` },
      { op: "label", name: `go${n}` },
      { op: "inc", v: "count", k: 1 },
      { op: "signal", c: "not_empty" },
      { op: "unlock", m: "m" },
    ];
    return {
      threads: [
        { name: "P", code: [...put(1), ...put(2)] },
        { name: "C1", code: consumer },
        { name: "C2", code: consumer },
      ],
    };
  },

  // two readers and a writer (reader preference)
  "fill-rw": ([b1, b2]) => {
    const target = [0, 1, 2][b1];
    const lock: Op[][] = [[{ op: "post", s: "rw" }], [{ op: "wait", s: "mutex" }], [{ op: "wait", s: "rw" }]];
    const reader = (): Op[] => [
      { op: "wait", s: "mutex" },
      { op: "inc", v: "readcount", k: 1 },
      { op: "if", a: "readcount", cmp: "!=", b: target, to: "skip" },
      ...lock[b2],
      { op: "label", name: "skip" },
      { op: "post", s: "mutex" },
      { op: "inc", v: "readers", k: 1 },
      { op: "assert", a: "writing", cmp: "==", b: 0, msg: "read during a write" },
      { op: "inc", v: "readers", k: -1 },
      { op: "wait", s: "mutex" },
      { op: "inc", v: "readcount", k: -1 },
      { op: "if", a: "readcount", cmp: "!=", b: 0, to: "out" },
      { op: "post", s: "rw" },
      { op: "label", name: "out" },
      { op: "post", s: "mutex" },
    ];
    const writer: Op[] = [
      { op: "wait", s: "rw" },
      { op: "set", v: "writing", to: 1 },
      { op: "assert", a: "readers", cmp: "==", b: 0, msg: "write during a read" },
      { op: "set", v: "writing", to: 0 },
      { op: "post", s: "rw" },
    ];
    return {
      sems: { rw: 1, mutex: 1 },
      threads: [
        { name: "R1", code: reader() },
        { name: "R2", code: reader() },
        { name: "W", code: writer },
      ],
    };
  },

  // three philosophers and three forks; the swap rule and the release are the blanks
  "fill-philosophers": ([b1, b2]) => {
    const swap = [(a: number, b: number) => a > b, (a: number, b: number) => a !== b, (a: number, b: number) => a === b, (a: number, b: number) => a < b][b1];
    const threads = Array.from({ length: N_PHIL }, (_, i) => {
      let a = i;
      let b = (i + 1) % N_PHIL;
      if (swap(a, b)) [a, b] = [b, a];
      const rel: Op[] = [
        { op: "wait", s: `fork${a}` },
        { op: "post", s: `fork${a}` },
        { op: "post", s: `fork${i + 1}` },
      ];
      return {
        name: `P${i}`,
        code: [
          { op: "wait", s: `fork${a}` },
          { op: "wait", s: `fork${b}` },
          { op: "inc", v: `use${a}`, k: 1 },
          { op: "assert", a: `use${a}`, cmp: "==", b: 1, msg: "a fork used twice" },
          { op: "inc", v: `use${b}`, k: 1 },
          { op: "assert", a: `use${b}`, cmp: "==", b: 1, msg: "a fork used twice" },
          { op: "inc", v: `use${a}`, k: -1 },
          { op: "inc", v: `use${b}`, k: -1 },
          rel[b2],
          { op: "post", s: `fork${b}` },
        ] as Op[],
      };
    });
    return { sems: Object.fromEntries(Array.from({ length: N_PHIL }, (_, i) => [`fork${i}`, 1])), threads };
  },

  // three threads meet at a barrier
  "fill-barrier": ([b1, b2]) => {
    const last: Op[][] = [[{ op: "signal", c: "all" }], [{ op: "cwait", c: "all", m: "m" }], [{ op: "broadcast", c: "all" }]];
    const early: Op[][] = [[{ op: "cwait", c: "all", m: "m" }], [{ op: "signal", c: "all" }], [{ op: "unlock", m: "m" }]];
    const arrive = (): Op[] => [
      { op: "lock", m: "m" },
      { op: "inc", v: "arrived", k: 1 },
      { op: "if", a: "arrived", cmp: "!=", b: 3, to: "sleep" },
      ...last[b1],
      { op: "jmp", to: "end" },
      { op: "label", name: "sleep" },
      { op: "label", name: "again" },
      { op: "if", a: "arrived", cmp: ">=", b: 3, to: "end" },
      ...early[b2],
      { op: "jmp", to: "again" },
      { op: "label", name: "end" },
      { op: "assert", a: "arrived", cmp: "==", b: 3, msg: "left before everyone arrived" },
      { op: "unlock", m: "m" },
    ];
    return { threads: [1, 2, 3].map((i) => ({ name: `T${i}`, code: arrive() })) };
  },

  // two threads call get_config()
  "fill-once": ([b1, b2]) => {
    const tests: Op[][] = [
      [{ op: "if", a: "done", cmp: "!=", b: 0, to: "body" }, { op: "jmp", to: "end" }],
      [{ op: "if", a: "done", cmp: "==", b: 0, to: "body" }, { op: "jmp", to: "end" }],
      [{ op: "if", a: "done", cmp: "<", b: 0, to: "body" }, { op: "jmp", to: "end" }],
    ];
    const mark: Op[][] = [[{ op: "set", v: "done", to: 0 }], [{ op: "unlock", m: "m" }], [{ op: "set", v: "done", to: 1 }]];
    const call = (): Op[] => [
      { op: "lock", m: "m" },
      ...tests[b1],
      { op: "label", name: "body" },
      { op: "inc", v: "inits", k: 1 },
      ...mark[b2],
      { op: "label", name: "end" },
      { op: "unlock", m: "m" },
      { op: "assert", a: "inits", cmp: "==", b: 1, msg: "init ran zero times or twice" },
    ];
    return { threads: [{ name: "A", code: call() }, { name: "B", code: call() }] };
  },
};

describe("distractors that must not be offered", () => {
  it("philosophers: taking the higher fork first is also a global order, so `a < b` can't be a wrong option", () => {
    expect(isSafe(explore(MODELS["fill-philosophers"]([3, 1])))).toBe(true);
  });
});

describe("fill problems, proven by running every interleaving", () => {
  it("has a model for every fill question", () => {
    expect(Object.keys(MODELS).sort()).toEqual(FILL_QUESTIONS.map((q) => q.id).sort());
  });

  for (const q of FILL_QUESTIONS) {
    it(`${q.id}: only the keyed options are safe`, () => {
      const key = q.blanks.map((b) => b.answer);
      const combos = q.blanks.reduce<number[][]>((acc, b) => acc.flatMap((c) => b.options.map((_, o) => [...c, o])), [[]]);
      expect(combos.length).toBeGreaterThan(1);
      for (const c of combos) {
        const r = explore(MODELS[q.id](c));
        const right = c.every((o, i) => o === key[i]);
        expect(isSafe(r), `${q.id} options ${c.join(",")}: ${r.failure?.message ?? r.deadlock?.message ?? (r.truncated ? "truncated" : "ok")}`).toBe(right);
      }
    });
  }
});
