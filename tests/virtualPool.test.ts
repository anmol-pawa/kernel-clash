import { describe, expect, it } from "vitest";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { VIRTUAL_GENERATORS, faultCountGen, faultEat, maxRate, thrashCheck, tapVictim, victimChoice, workingSetSize } from "@/content/virtualGenerators";
import { BATTLE_TURNS, POOLS, VIRTUAL_EXTRA, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { cardKey } from "@/game/engine/leitner";
import { answerText, grade, kindOf, questionProblems, victimSetup, type McqQ, type MultiQ, type NumericQ, type VictimQ } from "@/game/engine/question";
import { BELADY_EXAMPLE, REFERENCE_EXAMPLE, replacePages, type Replacement } from "@/game/sim/paging";

const pool = POOLS.virtual;
const find = (id: string) => VIRTUAL_EXTRA.find((q) => q.id === id)!;
const nums = (s: string) => [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
const NAMES: Record<string, Replacement> = { FIFO: "fifo", LRU: "lru", Optimal: "opt", "Clock (second chance)": "clock" };

/** FIFO/LRU/OPT by plain loops, independent of replacePages(). */
function plain(refs: number[], n: number, policy: "fifo" | "lru" | "opt", upTo = refs.length): { faults: number; lastVictim: number | null } {
  const res: number[] = []; // resident pages, oldest first (FIFO) or least recently used first (LRU)
  let faults = 0;
  let lastVictim: number | null = null;
  refs.slice(0, upTo).forEach((p, t) => {
    const i = res.indexOf(p);
    if (i >= 0) {
      if (policy === "lru") { res.splice(i, 1); res.push(p); }
      lastVictim = null;
      return;
    }
    faults++;
    lastVictim = null;
    if (res.length === n) {
      let v = 0;
      if (policy === "opt") {
        const next = res.map((q) => { const k = refs.indexOf(q, t + 1); return k < 0 ? Infinity : k; });
        v = next.indexOf(Math.max(...next));
      }
      lastVictim = res[v];
      res.splice(v, 1);
    }
    res.push(p);
  });
  return { faults, lastVictim };
}

describe("virtual-memory pool", () => {
  it("has the six boss questions plus the authored ones, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(18);
    expect(pool.authored.slice(0, 6).map((q) => q.id)).toEqual(GYM_QUESTIONS.virtual.map((q) => q.id));
    for (const q of pool.authored) expect(questionProblems(q), q.id).toEqual([]);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.entries(GYM_QUESTIONS).filter(([k]) => k !== "virtual").flatMap(([, v]) => v), ...POOLS.memory.authored, ...POOLS.deadlocks.authored, ...POOLS.sync.authored, ...POOLS.basics.authored].map((q) => q.id);
    for (const id of VIRTUAL_EXTRA.map((q) => q.id)) expect(elsewhere).not.toContain(id);
  });

  it("covers mcq, multi, numeric and order", () => {
    const kinds = new Set(pool.authored.map(kindOf));
    for (const k of ["mcq", "multi", "numeric", "order"]) expect(kinds.has(k as never), k).toBe(true);
  });

  it("authored answers match an independent key", () => {
    const mcq: Record<string, string> = {
      "vm-dirty": "Writing the victim back to disk if it was never changed",
      "vm-clock": "The bit is cleared and the hand moves on",
      "vm-stack": "With n frames it always holds a subset of what it would hold with n + 1 frames",
      "vm-global": "One process's faults can take frames from others, so its speed depends on how the rest behave",
      "vm-minframes": "The instruction set: one instruction may touch several pages and all must be resident to finish it",
      "vm-pff": "Give it more frames",
    };
    for (const [id, text] of Object.entries(mcq)) {
      const q = find(id) as McqQ;
      expect(q.options[q.answer], id).toBe(text);
    }
    const thrash = find("multi-vm-thrash") as MultiQ;
    expect(thrash.answers.map((i) => thrash.options[i])).toEqual(["Suspend a process and free its frames", "Use local replacement so processes can't steal frames", "Track working sets or page-fault frequency"]);
    const stack = find("multi-vm-stack") as MultiQ;
    expect(stack.answers.map((i) => stack.options[i])).toEqual(["LRU", "Optimal"]);
  });

  it("computed authored answers agree with the simulator and the textbook", () => {
    expect((find("num-vm-belady4") as NumericQ).answer).toBe(replacePages(BELADY_EXAMPLE, 4, "fifo").faults);
    expect(replacePages(BELADY_EXAMPLE, 3, "fifo").faults).toBe(9);
    expect((find("num-vm-opt3") as NumericQ).answer).toBe(replacePages(BELADY_EXAMPLE, 3, "opt").faults);
    // 0.9999 × 200 + 0.0001 × 8,000,000
    expect((find("num-vm-eat") as NumericQ).answer).toBeCloseTo(0.9999 * 200 + 0.0001 * 8_000_000, 2);
    expect(plain(REFERENCE_EXAMPLE, 3, "fifo").faults).toBe(15);
  });

  it("is in the question bank, labelled with the gym", () => {
    for (const q of VIRTUAL_EXTRA) expect(cardLabel(cardKey(q))).toEqual({ from: "Swapwood Gym", text: q.prompt });
    for (const g of pool.generators) expect(inBank(g.id)).toBe(true);
    expect(pool.generators).toBe(VIRTUAL_GENERATORS);
  });

  it("a gym battle draws six distinct questions from the pool", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const qs = gymBattleQuestions("virtual", seed, {}, 1_700_000_000_000);
      expect(qs).toHaveLength(BATTLE_TURNS);
      expect(new Set(qs.map((q) => q.id)).size).toBe(BATTLE_TURNS);
      for (const q of qs) expect(questionProblems(q), q.id).toEqual([]);
    }
  });
});

describe("virtual-memory generators", () => {
  it("are seeded: the same seed makes the same problem", () => {
    for (const g of VIRTUAL_GENERATORS) {
      expect(g.make(7)).toEqual(g.make(7));
      expect(g.make(7).id).toBe(`${g.id}#7`);
      expect(new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(g.make(i + 1)))).size).toBeGreaterThan(20);
      for (let s = 1; s <= 100; s++) expect(questionProblems(g.make(s)), `${g.id}#${s}`).toEqual([]);
    }
  });

  it("fault count: matches plain-loop FIFO, LRU and Optimal", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = faultCountGen.make(seed) as NumericQ;
      const m = /^(\d+) frames start empty\. How many page faults does (.+) take on the reference string ([\d ]+)\?$/.exec(q.prompt)!;
      const [frames, name, refs] = [Number(m[1]), m[2], m[3].trim().split(" ").map(Number)];
      seen.add(name);
      expect(q.answer, `#${seed}`).toBe(replacePages(refs, frames, NAMES[name]).faults);
      if (name === "FIFO" || name === "LRU" || name === "Optimal") expect(q.answer, `#${seed} ${name}`).toBe(plain(refs, frames, NAMES[name] as "fifo").faults);
      expect(q.answer).toBeLessThan(refs.length);
    }
    expect(seen.size).toBe(4);
  });

  it("victim: the marked page is the one a plain scan evicts", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = victimChoice.make(seed) as McqQ;
      const name = /does (.+) evict\?$/.exec(q.prompt)!.pop()!;
      const [pastText, futureText = ""] = q.explain.split("Full reference string: ")[1].replace(/\.$/, "").split(" | ");
      const past = pastText.split(" ").map(Number);
      const future = futureText ? futureText.split(" ").map(Number) : [];
      const refs = [...past, ...future];
      // the plain scan stops at the question's reference: its victim is the one asked about
      const victim = Number(/(\d+)/.exec(q.options[q.answer])![1]);
      expect(victim, `#${seed}`).toBe(plain(refs, 4, NAMES[name] as "fifo", past.length).lastVictim);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  it("EAT: the weighted average of memory time and fault time", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = faultEat.make(seed) as NumericQ;
      const [mem, ms, denom] = [Number(/takes (\d+) ns/.exec(q.prompt)![1]), Number(/takes (\d+) ms/.exec(q.prompt)![1]), Number(/in ([\d,]+) faults/.exec(q.prompt)![1].replace(",", ""))];
      expect(q.answer).toBeCloseTo((1 - 1 / denom) * mem + (1 / denom) * ms * 1e6, 1);
    }
    // Silberschatz §10.2.1: 200 ns, 8 ms, p = 1/1000 → 8199.8 ns
    const hit = Array.from({ length: 400 }, (_, s) => faultEat.make(s + 1) as NumericQ).find((q) => q.prompt.includes("200 ns") && q.prompt.includes("8 ms") && q.prompt.includes("1,000 faults"));
    if (hit) expect(hit.answer).toBe(8199.8);
  });

  it("tolerable fault rate: plugging it back in gives exactly the allowed slowdown", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = maxRate.make(seed) as NumericQ;
      const [mem] = nums(q.prompt);
      const slow = Number(/by at most (\d+)%/.exec(q.prompt)![1]) / 100;
      const p = q.answer / 1e6;
      expect((1 - p) * mem + p * 8e6).toBeCloseTo(mem * (1 + slow), 1);
    }
    // 200 ns, 10% → 2.5 per million (Silberschatz exercise 10.2.1)
    const hit = Array.from({ length: 300 }, (_, s) => maxRate.make(s + 1) as NumericQ).find((q) => q.prompt.startsWith("A memory access takes 200") && q.prompt.includes("10%"));
    if (hit) expect(hit.answer).toBeCloseTo(2.5, 1);
  });

  it("working set: distinct pages in the window ending at that reference", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = workingSetSize.make(seed) as NumericQ;
      const refs = /string is ([\d ]+) and/.exec(q.prompt)![1].trim().split(" ").map(Number);
      const window = Number(/Δ = (\d+)/.exec(q.prompt)![1]);
      const n = Number(/reference number (\d+)/.exec(q.prompt)![1]);
      expect(q.answer).toBe(new Set(refs.slice(n - window, n)).size);
      expect(n).toBeGreaterThanOrEqual(window);
    }
  });

  it("thrashing: yes exactly when total demand exceeds the frames, and both answers occur", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = thrashCheck.make(seed) as McqQ;
      const [sizes, frames] = [/working sets of ([\d, ]+) pages/.exec(q.prompt)![1].split(", ").map(Number), Number(/has (\d+) frames/.exec(q.prompt)![1])];
      expect(q.answer).toBe(sizes.reduce((a, b) => a + b, 0) > frames ? 0 : 1);
      seen.add(q.answer);
    }
    expect(seen.size).toBe(2);
  });
});

describe("tap-the-victim", () => {
  const q = (seed: number) => tapVictim.make(seed) as VictimQ;
  it("matches Silberschatz's string: LRU evicts frame 0 (page 7) at the first replacement, FIFO too", () => {
    // 7 0 1 2: three frames hold 7 0 1, the fault on 2 evicts page 7 (frame 0) under FIFO and LRU
    const fig: VictimQ = { kind: "victim", id: "fig", prompt: "p", explain: "e", policy: "lru" as const, frameCount: 3, refs: [7, 0, 1, 2, 0, 3], at: 3, answer: 0, move: { name: "Frame Strike", type: "memory", power: 34 } };
    expect(questionProblems(fig)).toEqual([]);
    expect(grade(fig, { kind: "victim", frame: 0 })).toBe(true);
    expect(grade(fig, { kind: "victim", frame: 1 })).toBe(false);
    expect(grade(fig, { kind: "mcq", choice: 0 })).toBe(false);
    expect(answerText(fig)).toBe("frame 0 (page 7)");
    expect(victimSetup(fig).frames).toEqual([7, 0, 1]);
    expect(questionProblems({ ...fig, answer: 2 })).toContain("answer isn't the policy's victim frame");
    expect(questionProblems({ ...fig, at: 2 })).toContain("no page is evicted at that reference");
    // Optimal on 7 0 1 2 | 0 1 7: page 7 is used furthest ahead, so it goes
    expect(questionProblems({ ...fig, policy: "opt" as const, refs: [7, 0, 1, 2, 0, 1, 7], answer: 0 })).toEqual([]);
    // pages 7 and 1 are both never used again in the original string: a tie, so it isn't a fair question
    expect(questionProblems({ ...fig, policy: "opt" as const, answer: 0 })).toContain("Optimal's victim is a tie");
  });
  it("generates well-formed, seed-stable questions whose victim an independent loop agrees with", () => {
    const policies = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const a = q(seed);
      expect(questionProblems(a), a.id).toEqual([]);
      expect(a).toEqual(q(seed));
      expect(grade(a, { kind: "victim", frame: a.answer })).toBe(true);
      expect(grade(a, { kind: "victim", frame: (a.answer + 1) % a.frameCount })).toBe(false);
      // plain-loop check of the victim page, from the frames shown just before the fault
      const { frames } = victimSetup(a);
      const page = frames[a.answer] as number;
      const before = a.refs.slice(0, a.at);
      const lastUse = (pg: number) => before.lastIndexOf(pg);
      if (a.policy === "lru") expect(frames.every((pg) => lastUse(pg as number) >= lastUse(page))).toBe(true);
      if (a.policy === "opt") {
        const next = (pg: number) => { const i = a.refs.indexOf(pg, a.at + 1); return i < 0 ? Infinity : i; };
        expect(frames.every((pg) => next(pg as number) <= next(page))).toBe(true);
      }
      policies.add(a.policy);
    }
    expect(policies.size).toBe(3);
  });
  it("joins the virtual pool", () => {
    expect(VIRTUAL_GENERATORS).toContain(tapVictim);
    expect(Array.from({ length: 200 }, (_, i) => kindOf(q(i + 1)))).toContain("victim");
  });
});
