import { describe, expect, it } from "vitest";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { bankerNeed, bankerRequest, bankerSafeSequence, detectCount, lockOrder, ragCycle, DEADLOCK_GENERATORS } from "@/content/deadlockGenerators";
import { BATTLE_TURNS, DEADLOCK_BANKER, DEADLOCK_EXTRA, POOLS, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { cardKey } from "@/game/engine/leitner";
import { grade, kindOf, questionProblems, type BankerQ, type CycleQ, type McqQ, type MultiQ, type NumericQ, type OrderQ, type Question } from "@/game/engine/question";
import { canDeadlock, findCycle, isSafeSequence, need, safety, type BankerState } from "@/game/sim/deadlock";

const T = 1_700_000_000_000;
const pool = POOLS.deadlocks;
const find = (id: string) => DEADLOCK_EXTRA.find((q) => q.id === id)!;

/** Is some order of all processes a safe sequence? (brute force, no safety algorithm) */
function anySafeOrder(s: BankerState): boolean {
  const n = s.allocation.length;
  const go = (work: number[], left: number[]): boolean => {
    if (!left.length) return true;
    return left.some((i) => s.max[i].every((m, j) => m - s.allocation[i][j] <= work[j]) && go(work.map((w, j) => w + s.allocation[i][j]), left.filter((x) => x !== i)));
  };
  return go([...s.available], [...Array(n).keys()]);
}

/** Read the "Allocation / Max" (or Request) table out of a question's code block. */
function parseTable(code: string) {
  const rows = code.split("\n").filter((l) => /^P\d/.test(l)).map((l) => l.trim().split(/\s+/).slice(1).map(Number));
  const available = /Available: ([\d ]+)/.exec(code)![1].trim().split(" ").map(Number);
  return { first: rows.map((r) => r.slice(0, 3)), second: rows.map((r) => r.slice(3)), available };
}

describe("deadlock simulator: lock ordering", () => {
  it("opposite orders can deadlock, equal orders cannot", () => {
    expect(canDeadlock([["A", "B"], ["B", "A"]])).toBe(true);
    expect(canDeadlock([["A", "B"], ["A", "B"]])).toBe(false);
    expect(canDeadlock([["A", "B"], ["B", "C"], ["C", "A"]])).toBe(true);
    expect(canDeadlock([["A", "B"], ["B", "C"], ["A", "C"]])).toBe(false);
  });
  it("agrees with a cycle in the lock-order graph for every two-lock workload", () => {
    const locks = ["A", "B", "C"];
    const pairs = locks.flatMap((a) => locks.filter((b) => b !== a).map((b) => [a, b]));
    for (const x of pairs) for (const y of pairs) for (const z of pairs) {
      const orders = [x, y, z];
      expect(canDeadlock(orders), JSON.stringify(orders)).toBe(findCycle(orders.map(([a, b]) => [a, b] as const)) !== null);
    }
  });
});

describe("deadlocks pool", () => {
  it("has the six boss questions plus about twenty authored ones, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(15);
    expect(pool.authored.slice(0, 6).map((q) => q.id)).toEqual(GYM_QUESTIONS.deadlocks.map((q) => q.id));
    for (const q of pool.authored) expect(questionProblems(q), q.id).toEqual([]);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.values(GYM_QUESTIONS).flat().filter((q) => !GYM_QUESTIONS.deadlocks.includes(q)), ...POOLS.sync.authored, ...POOLS.basics.authored].map((q) => q.id);
    for (const id of ids) if (!GYM_QUESTIONS.deadlocks.some((q) => q.id === id)) expect(elsewhere).not.toContain(id);
  });

  it("covers every question kind", () => {
    const kinds = new Set(pool.authored.map(kindOf));
    for (const k of ["mcq", "multi", "numeric", "order", "banker", "cycle"]) expect(kinds.has(k as never), k).toBe(true);
  });

  it("every authored answer matches an independent key", () => {
    const mcq: Record<string, string> = {
      "dl-hold-wait": "Hold and wait",
      "dl-starvation": "Starvation",
      "dl-waitfor": "Removing the resource nodes and joining each waiting process to the process holding what it wants",
      "dl-advance-max": "Deadlock avoidance (the Banker's algorithm)",
      "dl-victim": "That process may starve, so the number of rollbacks belongs in the victim's cost",
    };
    for (const [id, text] of Object.entries(mcq)) {
      const q = find(id) as McqQ;
      expect(q.options[q.answer], id).toBe(text);
    }
    const multi = find("multi-dl-prevention") as MultiQ;
    expect(multi.answers.map((i) => multi.options[i]).sort()).toEqual(
      ["Request every resource before the process starts running", "Number the resources and always request them in increasing order", "Let the OS take a resource from a waiting process"].sort(),
    );
    const order = find("order-dl-safety") as OrderQ;
    expect([order.steps[0], order.steps.at(-1)]).toEqual(["Set Work = Available and Finish[i] = false for every process", "The state is safe if every Finish[i] is true"]);
  });

  it("the computed authored questions agree with the simulators", () => {
    // Silberschatz §8.6.3.3: P0's Need is (7, 4, 3)
    expect(need({ available: [3, 3, 2], allocation: [[0, 1, 0]], max: [[7, 5, 3]] })[0]).toEqual([7, 4, 3]);
    expect((find("num-dl-need") as NumericQ).answer).toBe(7);

    // n = 3 processes, each needing up to 2 units: 3 units can deadlock, 4 never do
    const state = (total: number, alloc: number[]): BankerState => ({
      available: [total - alloc.reduce((a, b) => a + b, 0)],
      allocation: alloc.map((a) => [a]),
      max: alloc.map(() => [2]),
    });
    expect(safety(state(3, [1, 1, 1])).safe).toBe(false);
    for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) for (let c = 0; c <= 2; c++) if (a + b + c <= 4) expect(safety(state(4, [a, b, c])).safe, `${a}${b}${c}`).toBe(true);
    expect((find("num-dl-units") as NumericQ).answer).toBe(4);

    const bq = find("banker-dl-small") as BankerQ;
    expect(bq.state).toBe(DEADLOCK_BANKER);
    expect(need(DEADLOCK_BANKER)).toEqual([[2, 1, 1], [1, 1, 1], [1, 1, 1]]);
    expect(isSafeSequence(DEADLOCK_BANKER, bq.answer)).toBe(true);
    expect(isSafeSequence(DEADLOCK_BANKER, [1, 2, 0])).toBe(true);
    expect(isSafeSequence(DEADLOCK_BANKER, [0, 1, 2])).toBe(false);
    expect(grade(bq, { kind: "banker", sequence: [2, 1, 0] })).toBe(true);

    const cq = find("cycle-dl-free") as CycleQ;
    expect(findCycle(cq.edges)).toBeNull();
    expect(grade(cq, { kind: "cycle", nodes: [] })).toBe(true);
  });

  it("is in the question bank, labelled with the gym", () => {
    for (const q of pool.authored) expect(cardLabel(cardKey(q))).toEqual({ from: "Gridlock Gym", text: q.prompt });
    for (const g of pool.generators) expect(inBank(g.id)).toBe(true);
    expect(pool.generators).toBe(DEADLOCK_GENERATORS);
  });

  it("a gym battle draws six distinct questions from the pool", () => {
    expect(GYMS.find((g) => g.id === "deadlocks")).toBeDefined();
    for (let seed = 1; seed <= 30; seed++) {
      const qs = gymBattleQuestions("deadlocks", seed, {}, T);
      expect(qs).toHaveLength(BATTLE_TURNS);
      expect(new Set(qs.map((q) => q.id)).size).toBe(BATTLE_TURNS);
      for (const q of qs) expect(questionProblems(q), q.id).toEqual([]);
    }
  });
});

describe("deadlock generators", () => {
  it("are seeded: the same seed makes the same problem", () => {
    for (const g of DEADLOCK_GENERATORS) {
      expect(g.make(7)).toEqual(g.make(7));
      expect(g.make(7).id).toBe(`${g.id}#7`);
      expect(new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(g.make(i + 1)))).size).toBeGreaterThan(20);
    }
  });

  it("safe sequence: every state is safe by brute force and the answer is a safe order", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = bankerSafeSequence.make(seed) as BankerQ;
      expect(questionProblems(q), q.id).toEqual([]);
      expect(anySafeOrder(q.state), q.id).toBe(true);
      expect(isSafeSequence(q.state, q.answer), q.id).toBe(true);
      expect(grade(q, { kind: "banker", sequence: [...q.answer] })).toBe(true);
    }
  });

  it("Need entries equal Max − Allocation read from the printed table", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = bankerNeed.make(seed) as NumericQ;
      expect(questionProblems(q), q.id).toEqual([]);
      const [, p, r] = /Need\[P(\d)\]\[([ABC])\]/.exec(q.prompt)!;
      const t = parseTable(q.code!);
      expect(q.answer, q.id).toBe(t.second[Number(p)]["ABC".indexOf(r)] - t.first[Number(p)]["ABC".indexOf(r)]);
      expect(q.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it("request: the verdict follows a hand check (Need, Available, then a brute-force safety test)", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = bankerRequest.make(seed) as McqQ;
      expect(questionProblems(q), q.id).toEqual([]);
      const p = /P(\d) requests/.exec(q.prompt)![1];
      const req = /requests \((\d), (\d), (\d)\)/.exec(q.prompt)!.slice(1).map(Number);
      const t = parseTable(q.code!);
      const state: BankerState = { available: t.available, allocation: t.first, max: t.second };
      expect(anySafeOrder(state), "starts safe").toBe(true);
      const i = Number(p);
      const nd = t.second[i].map((m, j) => m - t.first[i][j]);
      let want: number;
      if (req.some((x, j) => x > nd[j])) want = 1;
      else if (req.some((x, j) => x > t.available[j])) want = 2;
      else {
        const after: BankerState = {
          available: t.available.map((x, j) => x - req[j]),
          allocation: t.first.map((row, k) => (k === i ? row.map((x, j) => x + req[j]) : row)),
          max: t.second,
        };
        want = anySafeOrder(after) ? 0 : 3;
      }
      expect(q.answer, q.id).toBe(want);
      seen.add(want);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("detection: the count matches a set-based fixpoint", () => {
    let dead = 0;
    let none = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const q = detectCount.make(seed) as NumericQ;
      expect(questionProblems(q), q.id).toEqual([]);
      const t = parseTable(q.code!);
      const done = new Set<number>(t.first.flatMap((a, i) => (a.every((x) => x === 0) ? [i] : [])));
      let work = [...t.available];
      for (let changed = true; changed; ) {
        changed = false;
        for (let i = 0; i < t.first.length; i++)
          if (!done.has(i) && t.second[i].every((x, j) => x <= work[j])) {
            work = work.map((w, j) => w + t.first[i][j]);
            done.add(i);
            changed = true;
          }
      }
      expect(q.answer, q.id).toBe(t.first.length - done.size);
      if (q.answer) dead++;
      else none++;
    }
    expect(dead).toBeGreaterThan(50);
    expect(none).toBeGreaterThan(20);
  });

  it("RAG: single-instance graphs, the stored cycle is real, and both outcomes occur", () => {
    let withCycle = 0;
    let without = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const q = ragCycle.make(seed) as CycleQ;
      expect(questionProblems(q), q.id).toEqual([]);
      // each resource is held by at most one process, each process waits for at most one resource
      const holds = q.edges.filter(([a]) => a.startsWith("R")).map(([a]) => a);
      expect(new Set(holds).size).toBe(holds.length);
      const waits = q.edges.filter(([a]) => a.startsWith("P")).map(([a]) => a);
      expect(new Set(waits).size).toBe(waits.length);
      // independent check: follow arrows from every node; a node on a cycle returns to itself
      const next = new Map(q.edges.map(([a, b]) => [a, b]));
      const onCycle = q.nodes.map((n) => n.id).filter((start) => {
        let at = next.get(start);
        for (let k = 0; k < 8 && at; k++) {
          if (at === start) return true;
          at = next.get(at);
        }
        return false;
      });
      expect([...q.answer].sort(), q.id).toEqual(onCycle.sort());
      expect(grade(q, { kind: "cycle", nodes: [...q.answer] })).toBe(true);
      if (q.answer.length) withCycle++;
      else without++;
    }
    expect(withCycle).toBeGreaterThan(100);
    expect(without).toBeGreaterThan(60);
  });

  it("lock order: the verdict matches a lock-order-graph cycle, and both outcomes occur", () => {
    let yes = 0;
    let no = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const q = lockOrder.make(seed) as McqQ;
      expect(questionProblems(q), q.id).toEqual([]);
      const orders = q.code!.split("\n").map((l) => /lock\((\w)\); lock\((\w)\)/.exec(l)!.slice(1));
      const cyc = findCycle(orders.map(([a, b]) => [a, b] as const)) !== null;
      expect(q.answer, q.id).toBe(cyc ? 0 : 1);
      if (cyc) yes++;
      else no++;
    }
    expect(yes).toBeGreaterThan(80);
    expect(no).toBeGreaterThan(80);
  });

  it("gives every question a type-sync move with power in the pool's range", () => {
    for (const g of DEADLOCK_GENERATORS) for (let seed = 1; seed <= 20; seed++) {
      const q: Question = g.make(seed);
      expect(q.move.type).toBe("sync");
      expect(q.move.power).toBeGreaterThanOrEqual(30);
      expect(q.move.power).toBeLessThanOrEqual(36);
    }
  });
});
