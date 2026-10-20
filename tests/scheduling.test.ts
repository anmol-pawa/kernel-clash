import { describe, expect, it } from "vitest";
import { fcfs, ganttText, mlfq, priority, priorityNP, roundRobin, sjf, srtf, type Job, type PriorityJob, type Schedule } from "@/game/sim/scheduling";
import { rng } from "@/lib/rng";

const jobs = (...rows: [string, number, number][]): Job[] => rows.map(([name, arrival, burst]) => ({ name, arrival, burst }));
const pjobs = (...rows: [string, number, number, number][]): PriorityJob[] => rows.map(([name, arrival, burst, priority]) => ({ name, arrival, burst, priority }));

describe("SJF (Silberschatz §5.3.2)", () => {
  it("P1 6, P2 8, P3 7, P4 3: average wait 7 ms", () => {
    const s = sjf(jobs(["P1", 0, 6], ["P2", 0, 8], ["P3", 0, 7], ["P4", 0, 3]));
    expect(ganttText(s.gantt)).toBe("P4 0–3 | P1 3–9 | P3 9–16 | P2 16–24");
    expect(s.waiting).toEqual([3, 16, 9, 0]);
    expect(s.avgWaiting).toBe(7);
  });
  it("only chooses among jobs that have arrived, and ties are FCFS", () => {
    const s = sjf(jobs(["A", 0, 5], ["B", 1, 2], ["C", 1, 2], ["D", 2, 1]));
    expect(ganttText(s.gantt)).toBe("A 0–5 | D 5–6 | B 6–8 | C 8–10");
  });
});

describe("SRTF (Silberschatz §5.3.2, preemptive SJF)", () => {
  it("P1 0/8, P2 1/4, P3 2/9, P4 3/5: average wait 6.5 ms", () => {
    const s = srtf(jobs(["P1", 0, 8], ["P2", 1, 4], ["P3", 2, 9], ["P4", 3, 5]));
    expect(ganttText(s.gantt)).toBe("P1 0–1 | P2 1–5 | P4 5–10 | P1 10–17 | P3 17–26");
    expect(s.waiting).toEqual([9, 0, 15, 2]);
    expect(s.avgWaiting).toBe(6.5);
    expect(s.response).toEqual([0, 0, 15, 2]);
  });
  it("a tie on remaining time doesn't preempt the running job", () => {
    const s = srtf(jobs(["A", 0, 4], ["B", 1, 3]));
    expect(ganttText(s.gantt)).toBe("A 0–4 | B 4–7");
  });
});

describe("Priority (Silberschatz §5.3.4)", () => {
  const book = pjobs(["P1", 0, 10, 3], ["P2", 0, 1, 1], ["P3", 0, 2, 4], ["P4", 0, 1, 5], ["P5", 0, 5, 2]);
  it("non-preemptive: average wait 8.2 ms", () => {
    const s = priorityNP(book);
    expect(ganttText(s.gantt)).toBe("P2 0–1 | P5 1–6 | P1 6–16 | P3 16–18 | P4 18–19");
    expect(s.avgWaiting).toBeCloseTo(8.2, 10);
    expect(priority(book)).toEqual(s);
  });
  it("preemptive: a higher-priority arrival takes the CPU", () => {
    const s = priority(pjobs(["P1", 0, 5, 3], ["P2", 1, 3, 1], ["P3", 2, 2, 2]), { preemptive: true });
    expect(ganttText(s.gantt)).toBe("P1 0–1 | P2 1–4 | P3 4–6 | P1 6–10");
    expect(s.waiting).toEqual([5, 0, 2]);
  });
  it("non-preemptive: a higher-priority arrival waits for the running job", () => {
    const s = priority(pjobs(["P1", 0, 5, 3], ["P2", 1, 3, 1], ["P3", 2, 2, 2]));
    expect(ganttText(s.gantt)).toBe("P1 0–5 | P2 5–8 | P3 8–10");
  });
  it("aging lets a starving low-priority job run", () => {
    const set = pjobs(["H1", 0, 4, 1], ["L", 0, 2, 5], ["H2", 4, 8, 1]);
    expect(ganttText(priority(set, { preemptive: true }).gantt)).toBe("H1 0–4 | H2 4–12 | L 12–14");
    // L waits 4 ticks, so its priority number falls 5 → 1 and it wins the FCFS tie with H2.
    // Non-preemptive, L then runs to completion.
    const np = priority(set, { aging: 1 });
    expect(ganttText(np.gantt)).toBe("H1 0–4 | L 4–6 | H2 6–14");
    expect(np.waiting).toEqual([0, 4, 2]);
    // Preemptive, H2 ages too while it waits (1 → 0) and takes the CPU back after one tick.
    expect(ganttText(priority(set, { preemptive: true, aging: 1 }).gantt)).toBe("H1 0–4 | L 4–5 | H2 5–13 | L 13–14");
  });
});

describe("Round Robin (Silberschatz §5.3.3)", () => {
  it("q = 4, P1 24, P2 3, P3 3: average wait 17/3 ms", () => {
    const s = roundRobin(jobs(["P1", 0, 24], ["P2", 0, 3], ["P3", 0, 3]), 4);
    expect(ganttText(s.gantt)).toBe("P1 0–4 | P2 4–7 | P3 7–10 | P1 10–30");
    expect(s.waiting).toEqual([6, 4, 7]);
    expect(s.avgWaiting).toBeCloseTo(17 / 3, 10);
    expect(s.response).toEqual([0, 4, 7]);
  });
  it("a new arrival joins the queue ahead of the job whose quantum just expired", () => {
    const s = roundRobin(jobs(["A", 0, 5], ["B", 2, 3]), 2);
    expect(ganttText(s.gantt)).toBe("A 0–2 | B 2–4 | A 4–6 | B 6–7 | A 7–8");
  });
  it("idles until a late arrival", () => {
    expect(ganttText(roundRobin(jobs(["A", 0, 1], ["B", 3, 2]), 4).gantt)).toBe("A 0–1 | idle 1–3 | B 3–5");
  });
});

describe("MLFQ (Silberschatz §5.3.6: queues of quantum 8, 16, then FCFS)", () => {
  it("demotes jobs that use their quantum and lets new arrivals preempt", () => {
    // A uses 8 in Q0 → Q1; B arrives at 10 and preempts A (A stays in Q1); C arrives at 12,
    // runs 8 in Q0 → Q1; A gets a fresh 16 in Q1 → Q2; C finishes in Q1; A finishes in Q2.
    const s = mlfq(jobs(["A", 0, 30], ["B", 10, 4], ["C", 12, 20]), [8, 16, Infinity]);
    expect(ganttText(s.gantt)).toBe("A 0–10 | B 10–14 | C 14–22 | A 22–38 | C 38–50 | A 50–54");
    expect(s.completion).toEqual([54, 14, 50]);
    expect(s.waiting).toEqual([24, 0, 18]);
    expect(s.response).toEqual([0, 0, 2]);
  });
});

describe("every scheduler on random workloads", () => {
  const randomJobs = (seed: number): PriorityJob[] => {
    const r = rng(seed);
    const n = r.int(2, 6);
    return Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, arrival: r.int(0, 7), burst: r.int(1, 9), priority: r.int(0, 4) }));
  };
  const all = (js: PriorityJob[]): [string, Schedule][] => [
    ["fcfs", fcfs(js)],
    ["sjf", sjf(js)],
    ["srtf", srtf(js)],
    ["priority", priority(js)],
    ["priority-p", priority(js, { preemptive: true })],
    ["priority-aging", priority(js, { preemptive: true, aging: 2 })],
    ["rr2", roundRobin(js, 2)],
    ["rr3", roundRobin(js, 3)],
    ["mlfq", mlfq(js, [2, 4, Infinity])],
  ];
  it("produce consistent Gantt charts and times", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const js = randomJobs(seed);
      for (const [, s] of all(js)) {
        // contiguous from 0, no zero-length or adjacent duplicate blocks
        expect(s.gantt[0].start).toBe(0);
        s.gantt.forEach((b, k) => {
          expect(b.end).toBeGreaterThan(b.start);
          if (k) expect(b.start).toBe(s.gantt[k - 1].end);
        });
        js.forEach((j, i) => {
          const mine = s.gantt.filter((b) => b.name === j.name);
          expect(mine.reduce((a, b) => a + b.end - b.start, 0)).toBe(j.burst);
          expect(mine[0].start).toBeGreaterThanOrEqual(j.arrival);
          expect(s.waiting[i]).toBe(s.turnaround[i] - j.burst);
          expect(s.waiting[i]).toBeGreaterThanOrEqual(0);
          expect(s.response[i]).toBeLessThanOrEqual(s.waiting[i]);
        });
        // the CPU only idles when nothing has arrived and is unfinished
        for (const b of s.gantt.filter((g) => g.name === null)) {
          expect(js.some((j, i) => j.arrival <= b.start && s.completion[i] > b.start)).toBe(false);
        }
      }
    }
  });
  it("SRTF has the least average wait; SJF beats FCFS when all arrive together", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const js = randomJobs(seed);
      const best = srtf(js).avgWaiting;
      for (const [, s] of all(js)) expect(best).toBeLessThanOrEqual(s.avgWaiting + 1e-9);
      const together = js.map((j) => ({ ...j, arrival: 0 }));
      expect(sjf(together).avgWaiting).toBeLessThanOrEqual(fcfs(together).avgWaiting);
    }
  });
  it("reduce to FCFS / SJF in the limiting cases", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const js = randomJobs(seed);
      const f = ganttText(fcfs(js).gantt);
      expect(ganttText(roundRobin(js, 100).gantt)).toBe(f);
      expect(ganttText(mlfq(js, [Infinity]).gantt)).toBe(f);
      expect(ganttText(priority(js.map((j) => ({ ...j, priority: 0 }))).gantt)).toBe(f);
      expect(ganttText(priority(js.map((j) => ({ ...j, priority: j.burst }))).gantt)).toBe(ganttText(sjf(js).gantt));
    }
  });
});
