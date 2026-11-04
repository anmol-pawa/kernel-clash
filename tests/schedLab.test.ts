import { describe, expect, it } from "vitest";
import { ALGOS, CHALLENGES, gradeChallenge, metrics, runAlgo, sanitize, solutions, type LabJob } from "@/game/sim/schedLab";

const J = (name: string, arrival: number, burst: number, priority = 0): LabJob => ({ name, arrival, burst, priority });

describe("scheduler lab engine", () => {
  it("matches Silberschatz's FCFS and RR examples", () => {
    const jobs = [J("P1", 0, 24), J("P2", 0, 3), J("P3", 0, 3)];
    expect(runAlgo(jobs, { id: "fcfs", quantum: 1 }).avgWaiting).toBe(17);
    const rr = runAlgo(jobs, { id: "rr", quantum: 4 });
    expect(rr.waiting).toEqual([6, 4, 7]);
    expect(rr.avgWaiting).toBeCloseTo(17 / 3);
  });
  it("counts context switches and the worst waits", () => {
    const jobs = [J("A", 0, 4), J("B", 0, 4)];
    const m = metrics(jobs, runAlgo(jobs, { id: "rr", quantum: 2 }));
    expect(m.switches).toBe(3); // A B A B
    expect(m.makespan).toBe(8);
    expect(m.maxWaiting).toBe(4);
    expect(metrics(jobs, runAlgo(jobs, { id: "fcfs", quantum: 1 })).switches).toBe(1);
  });
  it("sanitizes hand-edited workloads", () => {
    const s = sanitize([J("", -3, 0, 99), J("X", 1.9, 500, -1), J("Y", NaN, 2)]);
    expect(s[0]).toEqual({ name: "P1", arrival: 0, burst: 1, priority: 9 });
    expect(s[1]).toEqual({ name: "X", arrival: 1, burst: 30, priority: 0 });
    expect(s[2].arrival).toBe(0);
    expect(sanitize(Array.from({ length: 10 }, (_, i) => J(`J${i}`, 0, 1)))).toHaveLength(6);
  });
  it("runs every algorithm to completion on a random-ish workload", () => {
    const jobs = [J("A", 0, 5, 2), J("B", 3, 2, 1), J("C", 20, 4, 3)];
    for (const a of ALGOS) {
      const s = runAlgo(jobs, { id: a.id, quantum: 2 });
      const ran = s.gantt.filter((g) => g.name).reduce((n, g) => n + g.end - g.start, 0);
      expect(ran, a.id).toBe(11);
      expect(s.waiting.every((w) => w >= 0)).toBe(true);
    }
  });
});

describe("scheduler lab challenges", () => {
  it("there are 8 with unique ids", () => {
    expect(CHALLENGES).toHaveLength(8);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(8);
  });
  for (const c of CHALLENGES) {
    it(`${c.id}: solvable, but not by everything`, () => {
      const sol = solutions(c);
      expect(sol.length).toBeGreaterThan(0);
      const configs = ALGOS.length * 8;
      expect(sol.length).toBeLessThan(configs);
      // a disallowed algorithm never passes, even if its numbers would
      if (c.allowed) {
        const bad = ALGOS.find((a) => !c.allowed!.includes(a.id))!;
        expect(gradeChallenge(c, { id: bad.id, quantum: 4 }).allowed).toBe(false);
        expect(gradeChallenge(c, { id: bad.id, quantum: 4 }).ok).toBe(false);
      }
    });
  }
  const sols = (id: string) => solutions(CHALLENGES.find((c) => c.id === id)!).map((s) => s.id);
  it("convoy: FCFS fails, shortest-first families pass", () => {
    expect(sols("convoy")).not.toContain("fcfs");
    expect(sols("convoy")).toContain("sjf");
  });
  it("sjf-optimal: only SJF-like orderings reach 7", () => {
    expect(sols("sjf-optimal")).toContain("sjf");
    expect(sols("sjf-optimal")).not.toContain("fcfs");
  });
  it("response: FCFS fails, small-quantum RR passes", () => {
    const c = CHALLENGES.find((x) => x.id === "response")!;
    expect(gradeChallenge(c, { id: "fcfs", quantum: 1 }).ok).toBe(false);
    expect(gradeChallenge(c, { id: "rr", quantum: 1 }).ok).toBe(true);
    expect(gradeChallenge(c, { id: "rr", quantum: 4 }).ok).toBe(false);
  });
  it("no-starve: plain preemptive priority starves LOW, aging fixes it", () => {
    const c = CHALLENGES.find((x) => x.id === "no-starve")!;
    expect(gradeChallenge(c, { id: "prioP", quantum: 1 }).ok).toBe(false);
    expect(gradeChallenge(c, { id: "prioAge", quantum: 1 }).ok).toBe(true);
  });
  it("prio-textbook: Silberschatz's 8.2 ms", () => {
    const c = CHALLENGES.find((x) => x.id === "prio-textbook")!;
    expect(gradeChallenge(c, { id: "prio", quantum: 1 }).metrics.avgWaiting).toBeCloseTo(8.2);
  });
  it("rr-quantum: q=4 passes, huge q (FCFS-like) fails", () => {
    const c = CHALLENGES.find((x) => x.id === "rr-quantum")!;
    expect(gradeChallenge(c, { id: "rr", quantum: 4 }).ok).toBe(true);
    expect(gradeChallenge(c, { id: "rr", quantum: 30 }).ok).toBe(false);
  });
  it("few-switches: tiny quanta fail, large pass", () => {
    const c = CHALLENGES.find((x) => x.id === "few-switches")!;
    expect(gradeChallenge(c, { id: "rr", quantum: 1 }).ok).toBe(false);
    expect(gradeChallenge(c, { id: "rr", quantum: 8 }).ok).toBe(true);
  });
  it("srtf-vs-sjf: SRTF's textbook 6.5 passes, non-preemptive SJF fails", () => {
    expect(sols("srtf-vs-sjf")).toContain("srtf");
    expect(sols("srtf-vs-sjf")).not.toContain("sjf");
    expect(sols("srtf-vs-sjf")).not.toContain("fcfs");
  });
});
