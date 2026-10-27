import { describe, expect, it } from "vitest";
import { PERF_GENERATORS, amdahlCeiling, amdahlGen, bufferSizing, cacheEat, lockThroughput, poolSizing, rmUtilization, switchOverheadGen } from "@/content/perfGenerators";
import { GENERATORS } from "@/content/generators";
import { POOLS } from "@/content/pools";
import { inBank } from "@/content/questionBank";
import { grade, questionProblems, type McqQ, type NumericQ } from "@/game/engine/question";

const nums = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
const num = (g: { make(seed: number): unknown }, seed: number) => g.make(seed) as NumericQ;

describe("performance calculation generators", () => {
  it("are registered in the bank and the interview pool, and every question is well-formed and gradable", () => {
    for (const g of PERF_GENERATORS) {
      expect(GENERATORS).toContain(g);
      expect(POOLS.interview.generators).toContain(g);
      expect(inBank(g.id)).toBe(true);
      for (const s of seeds) {
        const q = g.make(s);
        expect(questionProblems(q), `${g.id}#${s}`).toEqual([]);
        expect(q.id).toBe(`${g.id}#${s}`);
        expect(g.make(s)).toEqual(q);
        if ("options" in q) {
          const m = q as McqQ;
          expect(grade(q, { kind: "mcq", choice: m.answer })).toBe(true);
          expect(grade(q, { kind: "mcq", choice: (m.answer + 1) % m.options.length })).toBe(false);
        } else {
          const n = q as NumericQ;
          expect(grade(q, { kind: "numeric", value: String(n.answer) })).toBe(true);
          expect(grade(q, { kind: "numeric", value: String(n.answer + 1) })).toBe(false);
        }
      }
    }
  });

  it("round-robin overhead is switch / (quantum + switch) as a percentage", () => {
    for (const s of seeds) {
      const q = num(switchOverheadGen, s);
      const [quantum, cost] = nums(q.prompt);
      expect(q.answer).toBeCloseTo((100 * cost) / (quantum + cost), 2);
    }
    // 10 ms quantum, 1 ms switch: 9.09%
    const hit = seeds.map((s) => num(switchOverheadGen, s)).find((q) => /10 ms quantum, and every context switch costs 1 ms/.test(q.prompt));
    expect(hit?.answer).toBeCloseTo(9.09, 2);
  });

  it("Amdahl answers satisfy the formula and the ceiling", () => {
    for (const s of seeds) {
      const q = num(amdahlGen, s);
      const [serial, cores] = nums(q.prompt);
      const f = serial / 100;
      expect(q.answer).toBeCloseTo(1 / (f + (1 - f) / cores), 2);
      expect(q.answer).toBeLessThan(1 / f);
      const c = num(amdahlCeiling, s);
      expect(c.answer).toBeCloseTo(100 / nums(c.prompt)[0], 2);
    }
  });

  it("the rate-monotonic verdict agrees with U and the Liu & Layland bound, and the exact test for the inconclusive case", () => {
    const seen = new Set<number>();
    for (const s of seeds) {
      const q = rmUtilization.make(s) as McqQ;
      const tasks = [...q.prompt.matchAll(/C=(\d+), T=(\d+)/g)].map((m) => ({ c: Number(m[1]), t: Number(m[2]) }));
      const u = tasks.reduce((sum, k) => sum + k.c / k.t, 0);
      const bound = tasks.length * (2 ** (1 / tasks.length) - 1);
      expect(q.answer).toBe(u > 1 ? 2 : u <= bound ? 0 : 1);
      seen.add(q.answer);
    }
    expect(seen.size).toBe(3);
  });

  it("two-level EAT matches a hand expansion of the three outcomes", () => {
    for (const s of seeds) {
      const q = num(cacheEat, s);
      const [h1, t1, h2, t2, tMem] = nums(q.prompt.replace(/L[12]/g, "L"));
      const p1 = h1 / 100;
      const p2 = (1 - p1) * (h2 / 100);
      const p3 = (1 - p1) * (1 - h2 / 100);
      expect(q.answer).toBeCloseTo(p1 * t1 + p2 * (t1 + t2) + p3 * (t1 + t2 + tMem), 2);
    }
    // 90% / 90%, 1 ns, 10 ns, 100 ns = 3.0 ns? 0.9 + 0.1*(10 + 0.1*100) = 2.9
    expect(0.9 * 1 + 0.1 * (0.9 * 11 + 0.1 * 111)).toBeCloseTo(0.9 + 2.1, 10);
  });

  it("pool sizes follow cores * (1 + W/C) for I/O and cores + 1 for CPU-bound", () => {
    let cpu = 0;
    let io = 0;
    for (const s of seeds) {
      const q = num(poolSizing, s);
      const n = nums(q.prompt);
      if (/CPU-bound/.test(q.prompt)) {
        expect(q.answer).toBe(n[0] + 1);
        cpu++;
      } else {
        const [compute, wait, cores] = n;
        expect(q.answer).toBe(cores + (cores * wait) / compute);
        io++;
      }
    }
    expect(cpu).toBeGreaterThan(0);
    expect(io).toBeGreaterThan(0);
  });

  it("locked throughput is the smaller of the parallel rate and the lock's ceiling", () => {
    for (const s of seeds) {
      const q = num(lockThroughput, s);
      const [threads, outside, inside] = nums(q.prompt);
      expect(q.answer).toBeCloseTo(Math.min((threads * 1000) / (outside + inside), 1000 / inside), 6);
    }
  });

  it("buffer sizes are the bandwidth-delay product (1 Gbit/s x 10 ms = 1250 KB)", () => {
    for (const s of seeds) {
      const q = num(bufferSizing, s);
      const [mbit, rtt] = nums(q.prompt);
      expect(q.answer).toBeCloseTo((mbit * 1e6 * (rtt / 1000)) / 8 / 1000, 6);
    }
  });
});
