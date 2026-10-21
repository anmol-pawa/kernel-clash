import { describe, expect, it } from "vitest";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { BASICS_EXTRA, BATTLE_TURNS, POOLS, PROCESSES_EXTRA, SCHEDULING_EXTRA, SYNC_EXTRA, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { STARTERS, starterFighter } from "@/content/starters";
import { petersonNext, raceFinals, semaphoreTrace } from "@/content/syncGenerators";
import { initialState, reducer, type Fighter } from "@/game/engine/battle";
import { cardKey } from "@/game/engine/leitner";
import { grade, kindOf, questionProblems, type InterleaveQ, type McqQ, type MultiQ, type NumericQ, type Question } from "@/game/engine/question";
import { xpForLevel } from "@/game/engine/xp";
import { finalValues, increment, interleavings, runSchedule, runSemaphore, type SemOp } from "@/game/sim/sync";
import { bossFighter } from "@/game/world/gymBattle";

const T = 1_700_000_000_000;
const pool = POOLS.sync;

/** The answer key for the extra authored questions, written independently of the data. */
const KEY: Record<string, string | string[] | number> = {
  "sync-spinlock": "On a multicore CPU, when the lock is held for less time than two context switches",
  "sync-tas": "Sets lock to true and returns its old value",
  "sync-cas": "Writes new_value only if value equals expected, and returns the original value",
  "sync-cv-while": "With signal-and-continue, the condition can change again before the woken thread runs",
  "sync-inversion": "Priority inheritance: the lock holder runs at the waiter's priority until it releases the lock",
  "sync-bb-swap": "The producer sleeps holding mutex, so no consumer can take an item: deadlock",
  "sync-rw-starve": "Writers",
  "sync-philosophers": "Odd philosophers pick up the left chopstick first, even ones the right",
  "multi-sync-race-finals": ["4", "5", "6"],
  "multi-sync-mutex": ["A spinlock built on test_and_set", "A lock built on compare_and_swap", "A binary semaphore initialised to 1"],
  // re-solved by the simulators below as well
  "num-sync-sem": -1,
  "num-sync-interleavings": 20,
  "num-sync-twice": 2,
};

const ENDS: Record<string, [string, string]> = {
  "order-sync-consumer": ["wait(full)", "Consume the item"],
  "order-sync-sections": ["Entry section: ask permission to enter", "Remainder section: everything else"],
};

const find = (id: string) => SYNC_EXTRA.find((q) => q.id === id)!;

/**
 * Every end value of a race, worked out by hand from the prompt's wording
 * ("x is 3. T1 runs x++ twice, and T2 runs x++"): each change is a load, an
 * add and a store, tried over every interleaving with no simulator code.
 */
function handFinals(prompt: string): number[] {
  const [, v, init] = /^(\w+) is (-?\d+)\./.exec(prompt)!;
  const deltas = [...prompt.matchAll(/(\w+) runs (\w+)(\+\+|--| \+= (\d+)| -= (\d+))( twice)?/g)].map((m) => {
    expect(m[2]).toBe(v);
    const k = m[3] === "++" ? 1 : m[3] === "--" ? -1 : m[4] ? Number(m[4]) : -Number(m[5]);
    return m[6] ? [k, k] : [k];
  });
  expect(deltas).toHaveLength(2);
  const out = new Set<number>();
  // state per thread: [op index, phase 0 load / 1 add / 2 store, register]
  const walk = (x: number, st: number[][]) => {
    if (st.every((s, i) => s[0] === deltas[i].length)) return void out.add(x);
    st.forEach(([op, phase, reg], i) => {
      if (op === deltas[i].length) return;
      const next = st.map((s) => [...s]);
      if (phase === 0) next[i] = [op, 1, x];
      else if (phase === 1) next[i] = [op, 2, reg + deltas[i][op]];
      else next[i] = [op + 1, 0, 0];
      walk(phase === 2 ? reg : x, next);
    });
  };
  walk(Number(init), deltas.map(() => [0, 0, 0]));
  return [...out].sort((a, b) => a - b);
}

describe("the Mutex Marsh pool", () => {
  it("has ~20 authored questions of every kind plus generators, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(20);
    expect(new Set(pool.authored.map(kindOf))).toEqual(new Set(["mcq", "multi", "numeric", "order", "interleave"]));
    expect(pool.generators.map((g) => g.id).sort()).toEqual(["gen-sync-finals", "gen-sync-interleave", "gen-sync-peterson", "gen-sync-semaphore"]);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.entries(GYM_QUESTIONS).flatMap(([g, qs]) => (g === "sync" ? [] : qs)), ...BASICS_EXTRA, ...PROCESSES_EXTRA, ...SCHEDULING_EXTRA].map((q) => q.id);
    for (const q of pool.authored) {
      expect(elsewhere, q.id).not.toContain(q.id);
      expect(questionProblems(q), q.id).toEqual([]);
      expect(q.move.type, q.id).toBe("sync");
      expect(q.explain.length, q.id).toBeGreaterThan(40);
    }
    for (const id of GYM_QUESTIONS.sync.map((q) => q.id)) expect(ids).toContain(id);
  });

  it("matches the answer key for every extra question", () => {
    const keyed = [...Object.keys(KEY), ...Object.keys(ENDS), "il-sync-lose-producer"].sort();
    expect(keyed).toEqual(SYNC_EXTRA.map((q) => q.id).sort());
    for (const q of SYNC_EXTRA) {
      const k = KEY[q.id];
      switch (q.kind) {
        case "multi":
          expect(q.answers.map((i) => q.options[i]).sort(), q.id).toEqual([...(k as string[])].sort());
          expect(grade(q, { kind: "multi", choices: q.answers })).toBe(true);
          expect(grade(q, { kind: "multi", choices: q.answers.slice(1) })).toBe(false);
          break;
        case "numeric":
          expect(q.answer, q.id).toBe(k);
          expect(grade(q, { kind: "numeric", value: String(k) })).toBe(true);
          break;
        case "order":
          expect([q.steps[0], q.steps[q.steps.length - 1]], q.id).toEqual(ENDS[q.id]);
          break;
        case "interleave":
          break;
        default:
          expect((q as McqQ).options[(q as McqQ).answer], q.id).toBe(k);
      }
    }
  });

  it("doesn't park every MCQ answer in the same slot", () => {
    const mcqs = pool.authored.filter((q) => kindOf(q) === "mcq") as McqQ[];
    expect(new Set(mcqs.map((q) => q.answer)).size).toBe(4);
  });

  it("the computed questions agree with the simulators and the textbook", () => {
    // counter++ racing counter-- from 5 (Silberschatz §6.1): 4, 5 or 6
    const pc = [
      { name: "PRODUCER", code: increment("counter", "r1", 1) },
      { name: "CONSUMER", code: increment("counter", "r2", -1) },
    ];
    const finals = find("multi-sync-race-finals") as MultiQ;
    expect(finals.answers.map((i) => Number(finals.options[i]))).toEqual(finalValues({ counter: 5 }, pc, "counter"));
    expect(handFinals(finals.prompt.replace("The producer", "PRODUCER").replace("the consumer", "CONSUMER"))).toEqual([4, 5, 6]);

    // a blocking semaphore from 2: P3 and P4 block, P1's signal wakes P3
    const sem = runSemaphore(2, [
      { op: "wait", who: "P1" },
      { op: "wait", who: "P2" },
      { op: "wait", who: "P3" },
      { op: "wait", who: "P4" },
      { op: "signal", who: "P1" },
    ]);
    expect(sem).toEqual({ value: -1, blocked: ["P4"], woken: ["P3"] });
    expect((find("num-sync-sem") as NumericQ).answer).toBe(sem.value);

    expect(interleavings([3, 3])).toHaveLength((find("num-sync-interleavings") as NumericQ).answer);

    // two threads doing x++ twice from 0: the classic answer is 2, not 1
    const twice = [0, 1].map((t) => ({ name: `T${t + 1}`, code: [...increment("x", "r", 1), ...increment("x", "r", 1)] }));
    expect(Math.min(...finalValues({ x: 0 }, twice, "x"))).toBe((find("num-sync-twice") as NumericQ).answer);
    // the explanation's run: T1 load, T2 load/add/store, T1 add/store, T2 load, T1 load/add/store, T2 add/store
    expect(runSchedule({ x: 0 }, twice, [0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1]).shared.x).toBe(2);

    const il = find("il-sync-lose-producer") as InterleaveQ;
    expect(grade(il, { kind: "interleave", schedule: il.answer })).toBe(true);
    expect(grade(il, { kind: "interleave", schedule: [1, 1, 0, 0, 1, 0] })).toBe(false); // ends at 6
    expect(grade(il, { kind: "interleave", schedule: [0, 0, 0, 1, 1, 1] })).toBe(false); // serial: 5
    expect(runSchedule(il.init, il.threads, il.answer).shared.counter).toBe(4);
  });

  it("is in the question bank, labelled with the gym", () => {
    for (const q of pool.authored) expect(cardLabel(cardKey(q))).toEqual({ from: "Mutex Marsh Gym", text: q.prompt });
    for (const g of pool.generators) expect(inBank(g.id)).toBe(true);
  });
});

describe("sync generators", () => {
  it("final values: the answers are exactly what a hand model of every interleaving reaches", () => {
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const q = raceFinals.make(seed) as MultiQ;
      expect(questionProblems(q), q.id).toEqual([]);
      expect(q.options).toHaveLength(6);
      const want = handFinals(q.prompt);
      expect(q.answers.map((i) => Number(q.options[i])).sort((a, b) => a - b), q.id).toEqual(want);
      // options ascend and include at least two impossible values
      const nums = q.options.map(Number);
      expect([...nums].sort((a, b) => a - b)).toEqual(nums);
      expect(nums.filter((n) => !want.includes(n)).length).toBeGreaterThanOrEqual(3);
      expect(grade(q, { kind: "multi", choices: q.answers })).toBe(true);
      shapes.add(q.prompt.split(" ")[0] + want.length);
    }
    // all four workloads, and the two-counter case with equal steps (only two endings)
    expect(new Set([...shapes].map((s) => s.replace(/\d$/, "")))).toEqual(new Set(["counter", "hits", "balance", "x"]));
    expect(shapes).toContain("hits2");
  });

  it("semaphore: value and sleepers follow a hand count, and no blocked process makes a call", () => {
    const asked = { value: 0, blocked: 0, negative: 0 };
    for (let seed = 1; seed <= 200; seed++) {
      const q = semaphoreTrace.make(seed) as NumericQ;
      expect(questionProblems(q), q.id).toEqual([]);
      const init = Number(/starts at (\d+)/.exec(q.prompt)![1]);
      const ops = q.code!.split("\n").map((l) => {
        const m = /^(P\d): (wait|signal)\(S\)$/.exec(l)!;
        return { who: m[1], op: m[2] } as SemOp;
      });
      // hand model: a counter and a FIFO line of sleepers
      let s = init;
      const line: string[] = [];
      for (const o of ops) {
        expect(line, `${q.id}: ${o.who} is asleep`).not.toContain(o.who);
        if (o.op === "wait") {
          if (s <= 0) line.push(o.who);
          s--;
        } else {
          if (line.length) line.shift();
          s++;
        }
      }
      expect(s, q.id).toBe(init - ops.filter((o) => o.op === "wait").length + ops.filter((o) => o.op === "signal").length);
      expect(line.length).toBe(Math.max(0, -s));
      if (q.prompt.includes("How many")) {
        asked.blocked++;
        expect(q.answer, q.id).toBe(line.length);
      } else {
        asked.value++;
        expect(q.answer, q.id).toBe(s);
        if (s < 0) asked.negative++;
      }
      expect(grade(q, { kind: "numeric", value: String(q.answer) })).toBe(true);
    }
    expect(asked.value).toBeGreaterThan(50);
    expect(asked.blocked).toBeGreaterThan(50);
    expect(asked.negative).toBeGreaterThan(5);
  });

  it("Peterson: alone, Pi always enters; racing, whoever writes turn last waits", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const q = petersonNext.make(seed) as McqQ;
      expect(questionProblems(q), q.id).toEqual([]);
      const writes = [...q.prompt.matchAll(/P(\d) runs (flag\[\d\] = true|turn = \d)/g)].map((m) => [Number(m[1]), m[2]] as const);
      expect(writes).toHaveLength(q.prompt.includes("isn't trying") ? 2 : 4);
      const picked = q.options[q.answer];
      if (writes.length === 2) {
        expect(picked).toBe(`P${writes[0][0]} enters its critical section`);
        seen.add("solo");
      } else {
        // each process raises its flag before it writes turn
        for (const p of [0, 1]) expect(writes.filter(([w]) => w === p).map(([, s]) => s)).toEqual([`flag[${p}] = true`, `turn = ${1 - p}`]);
        const lastTurn = writes.filter(([, s]) => s.startsWith("turn")).at(-1)![0];
        expect(picked, q.id).toBe(`P${1 - lastTurn} enters; P${lastTurn} waits`);
        seen.add(picked);
      }
    }
    expect(seen).toEqual(new Set(["solo", "P0 enters; P1 waits", "P1 enters; P0 waits"]));
  });
});

describe("Mutex Marsh battles draw from the pool", () => {
  it("six distinct pool questions, deterministic per seed, every question asked over many battles", () => {
    const keys = new Set([...pool.authored.map(cardKey), ...pool.generators.map((g) => g.id)]);
    const qs = gymBattleQuestions("sync", 3, {}, T);
    expect(qs).toHaveLength(BATTLE_TURNS);
    expect(gymBattleQuestions("sync", 3, {}, T)).toEqual(qs);
    const asked = new Set<string>();
    for (let s = 0; s < 200; s++)
      for (const q of gymBattleQuestions("sync", s, {}, T)) {
        expect(keys).toContain(cardKey(q));
        asked.add(cardKey(q));
      }
    expect(asked).toEqual(keys);
  });

  function play(qs: Question[], pattern: boolean[], player: Fighter) {
    const gym = GYMS.find((g) => g.id === "sync")!;
    let s = reducer(initialState(player, bossFighter(gym), qs.length), { type: "ready" });
    for (let i = 0; s.phase === "ask"; i++) {
      s = reducer(s, { type: "answer", correct: pattern[i] ?? false, power: qs[i].move.power, seconds: 30, moveType: qs[i].move.type, counterType: gym.type });
      s = reducer(s, { type: "next" });
    }
    return s.phase;
  }

  it("keeps Mutexa balanced for any draw: the weakest six win with a slip, the strongest lose with three misses", () => {
    const all = [...pool.authored, ...pool.generators.map((g) => g.make(1))].sort((a, b) => a.move.power - b.move.power);
    const weakest = all.slice(0, BATTLE_TURNS);
    const strongest = all.slice(-BATTLE_TURNS);
    for (const p of STARTERS.flatMap((s) => [starterFighter(s), starterFighter(s, xpForLevel(9))])) {
      expect(play(weakest, weakest.map(() => true), p), p.name).toBe("victory");
      for (let slip = 0; slip < BATTLE_TURNS; slip++) expect(play(weakest, weakest.map((_, i) => i !== slip), p), `${p.name} slip ${slip}`).toBe("victory");
      expect(play(strongest, [true, true, true, false, false, false], p), p.name).toBe("defeat");
    }
  });
});
