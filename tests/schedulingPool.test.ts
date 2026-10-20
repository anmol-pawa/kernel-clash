import { describe, expect, it } from "vitest";
import { GENERATORS } from "@/content/generators";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { BATTLE_TURNS, POOLS, PROCESSES_EXTRA, SCHEDULING_EXTRA, BASICS_EXTRA, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { WHICH_ALGOS, quantumEnds, rrAmbiguous, schedAverage, schedFinish, schedWhich } from "@/content/schedulingGenerators";
import { STARTERS, starterFighter } from "@/content/starters";
import { initialState, reducer, type Fighter } from "@/game/engine/battle";
import { cardKey } from "@/game/engine/leitner";
import { grade, kindOf, questionProblems, type McqQ, type NumericQ, type OrderQ, type Question } from "@/game/engine/question";
import { xpForLevel } from "@/game/engine/xp";
import { fcfs, ganttText, priority, roundRobin, sjf, srtf, type Job, type PriorityJob, type Schedule, type Slice } from "@/game/sim/scheduling";
import { bossFighter } from "@/game/world/gymBattle";

const T = 1_700_000_000_000;
const pool = POOLS.scheduling;
const job = (name: string, arrival: number, burst: number): Job => ({ name, arrival, burst });

/** The answer key for the extra authored questions, written independently of the data. */
const KEY: Record<string, string | string[] | number> = {
  "sched-dispatch-latency": "The time the dispatcher takes to stop one process and start another",
  "sched-convoy": "FCFS",
  "sched-tiny-quantum": "Most of the CPU's time goes on context switches",
  "sched-mlfq-demote": "It moves down to a lower-priority queue",
  "sched-interactive": "Response time",
  "sched-cfs": "The one with the smallest virtual runtime",
  "multi-sched-preemptive": ["SRTF", "Round Robin", "MLFQ"],
  "multi-sched-starve": ["SRTF", "Priority scheduling", "Non-preemptive SJF"],
  "multi-sched-decisions": ["The running process blocks for I/O", "The running process terminates"],
  // re-solved by the simulators below as well
  "num-sched-rr2": 13 / 3,
  "num-sched-srtf-p1": 17,
  "num-sched-tau": 6,
};

const ENDS: Record<string, [string, string]> = {
  "order-sched-sjf": ["P4 (burst 3)", "P2 (burst 8)"],
  "order-sched-switch": ["The timer interrupt traps into the kernel", "It switches to user mode and jumps to the saved program counter"],
};

const find = <K extends Question["kind"]>(id: string) => SCHEDULING_EXTRA.find((q) => q.id === id) as Extract<Question, { kind?: K }>;

/** Parse a generated process table back into jobs. */
function parseTable(code: string): PriorityJob[] {
  return code
    .split("\n")
    .slice(1)
    .map((line) => {
      const [name, arrival, burst, prio] = line.trim().split(/\s+/);
      return { name, arrival: Number(arrival), burst: Number(burst), priority: Number(prio ?? 0) };
    });
}

/**
 * Round Robin with the other textbook convention: a preempted job rejoins the
 * queue before a job arriving at that same instant. Written independently of
 * the game's simulator.
 */
function rrPreemptedFirst(jobs: Job[], q: number): Slice[] {
  const rem = jobs.map((j) => j.burst);
  const byArr = jobs.map((_, i) => i).sort((a, b) => jobs[a].arrival - jobs[b].arrival || a - b);
  const queue: number[] = [];
  const out: Slice[] = [];
  let next = 0;
  let t = 0;
  const admit = (upTo: number, strict: boolean) => {
    while (next < byArr.length && (strict ? jobs[byArr[next]].arrival < upTo : jobs[byArr[next]].arrival <= upTo)) queue.push(byArr[next++]);
  };
  const add = (name: string | null, a: number, b: number) => {
    const last = out.at(-1);
    if (last && last.name === name && last.end === a) last.end = b;
    else out.push({ name, start: a, end: b });
  };
  admit(0, false);
  while (rem.some((r) => r > 0)) {
    if (!queue.length) {
      const at = jobs[byArr[next]].arrival;
      add(null, t, at);
      t = at;
      admit(t, false);
      continue;
    }
    const i = queue.shift()!;
    const run = Math.min(q, rem[i]);
    add(jobs[i].name, t, t + run);
    t += run;
    rem[i] -= run;
    admit(t, true);
    if (rem[i] > 0) queue.push(i);
    admit(t, false);
  }
  return out;
}

describe("the Clocktower pool", () => {
  it("has ~20 authored questions of every kind plus generators, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(20);
    expect(new Set(pool.authored.map(kindOf))).toEqual(new Set(["mcq", "multi", "numeric", "order"]));
    expect(pool.generators.length).toBeGreaterThanOrEqual(4);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.entries(GYM_QUESTIONS).flatMap(([g, qs]) => (g === "scheduling" ? [] : qs)), ...BASICS_EXTRA, ...PROCESSES_EXTRA].map((q) => q.id);
    for (const q of pool.authored) {
      expect(elsewhere, q.id).not.toContain(q.id);
      expect(questionProblems(q), q.id).toEqual([]);
      expect(q.move.type, q.id).toBe(q.id === "sched-rr-big" ? "io" : "scheduler");
      expect(q.explain.length, q.id).toBeGreaterThan(40);
    }
    for (const id of GYM_QUESTIONS.scheduling.map((q) => q.id)) expect(ids).toContain(id);
  });

  it("matches the answer key for every extra question", () => {
    expect([...Object.keys(KEY), ...Object.keys(ENDS)].sort()).toEqual(SCHEDULING_EXTRA.map((q) => q.id).sort());
    for (const q of SCHEDULING_EXTRA) {
      const k = KEY[q.id];
      switch (q.kind) {
        case "multi":
          expect(q.answers.map((i) => q.options[i]).sort(), q.id).toEqual([...(k as string[])].sort());
          expect(grade(q, { kind: "multi", choices: q.answers.slice(1) })).toBe(false);
          break;
        case "numeric":
          expect(q.answer, q.id).toBeCloseTo(k as number, 9);
          expect(grade(q, { kind: "numeric", value: String(k) })).toBe(true);
          break;
        case "order":
          expect([q.steps[0], q.steps[q.steps.length - 1]], q.id).toEqual(ENDS[q.id]);
          break;
        default:
          expect((q as McqQ).options[(q as McqQ).answer], q.id).toBe(k);
      }
    }
  });

  it("the computed questions agree with the simulators and Silberschatz's examples", () => {
    // RR q=2 on 5, 3, 1: average wait 13/3, typed as a fraction or to 2 d.p.
    const rr = roundRobin([job("P1", 0, 5), job("P2", 0, 3), job("P3", 0, 1)], 2);
    const rr2 = find<"numeric">("num-sched-rr2") as NumericQ;
    expect(rr.avgWaiting).toBeCloseTo(rr2.answer, 9);
    expect(rr2.gantt).toEqual(rr.gantt);
    expect(grade(rr2, { kind: "numeric", value: "13/3" })).toBe(true);
    expect(grade(rr2, { kind: "numeric", value: "4.33" })).toBe(true);
    // Silberschatz's SRTF example: P1 finishes at 17
    const s = srtf([job("P1", 0, 8), job("P2", 1, 4), job("P3", 2, 9), job("P4", 3, 5)]);
    const p1 = find<"numeric">("num-sched-srtf-p1") as NumericQ;
    expect(s.completion[0]).toBe(p1.answer);
    expect(p1.gantt).toEqual(s.gantt);
    expect(parseTable(p1.code!).map(({ name, arrival, burst }) => job(name, arrival, burst))).toEqual([job("P1", 0, 8), job("P2", 1, 4), job("P3", 2, 9), job("P4", 3, 5)]);
    // exponential averaging, α = 1/2, τ0 = 10 (Silberschatz's predictions 10, 8, 6, …)
    const predict = (tau: number, bursts: number[], a: number) => bursts.reduce((t, b) => a * b + (1 - a) * t, tau);
    expect(predict(10, [6, 4], 0.5)).toBe(KEY["num-sched-tau"]);
    expect([6, 4, 6, 4, 13, 13, 13].map((_, n, b) => predict(10, b.slice(0, n), 0.5))).toEqual([10, 8, 6, 6, 5, 9, 11]);
    // the SJF order is the simulator's
    const order = sjf([job("P1", 0, 6), job("P2", 0, 8), job("P3", 0, 7), job("P4", 0, 3)]);
    const o = find<"order">("order-sched-sjf") as OrderQ;
    expect(o.steps.map((x) => x.split(" ")[0])).toEqual(order.gantt.map((b) => b.name));
    expect(order.avgWaiting).toBe(7);
  });

  it("spreads MCQ answers over every slot, and is in the question bank", () => {
    const mcqs = pool.authored.filter((q) => kindOf(q) === "mcq") as McqQ[];
    expect(new Set(mcqs.map((q) => q.answer)).size).toBe(4);
    for (const q of pool.authored) expect(cardLabel(cardKey(q))).toEqual({ from: "Clocktower Gym", text: q.prompt });
    for (const g of pool.generators) expect(inBank(g.id)).toBe(true);
    expect(new Set(GENERATORS.map((g) => g.id)).size).toBe(GENERATORS.length);
  });
});

describe("Round Robin conventions", () => {
  it("finds where quanta run out (Silberschatz q = 4)", () => {
    const jobs = [job("P1", 0, 24), job("P2", 0, 3), job("P3", 0, 3)];
    expect(quantumEnds(roundRobin(jobs, 4), jobs, 4)).toEqual([4, 14, 18, 22, 26]);
    expect(rrAmbiguous(jobs, 4)).toBe(false);
  });

  it("flags an arrival at a quantum's end, where the two conventions differ", () => {
    const jobs = [job("P1", 0, 4), job("P2", 2, 2)];
    expect(rrAmbiguous(jobs, 2)).toBe(true);
    expect(ganttText(roundRobin(jobs, 2).gantt)).toBe("P1 0–2 | P2 2–4 | P1 4–6");
    expect(ganttText(rrPreemptedFirst(jobs, 2))).toBe("P1 0–4 | P2 4–6");
  });

  it("the conventions agree whenever no arrival lands on a quantum's end", () => {
    let checked = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const r = seed * 7919;
      const jobs = [0, 1, 2, 3].map((i) => job(`P${i + 1}`, i === 0 ? 0 : (r >> (i * 3)) % 9, 1 + ((r >> (i * 4)) % 7)));
      for (const q of [1, 2, 3, 4]) {
        if (rrAmbiguous(jobs, q)) continue;
        checked++;
        expect(rrPreemptedFirst(jobs, q), `${seed} q${q}`).toEqual(roundRobin(jobs, q).gantt);
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});

/** Re-solve a generated prompt's algorithm from its label. */
function solve(prompt: string, jobs: PriorityJob[]): Schedule {
  if (prompt.startsWith("Non-preemptive SJF")) return sjf(jobs);
  if (prompt.startsWith("SRTF")) return srtf(jobs);
  if (prompt.startsWith("Non-preemptive priority")) return priority(jobs);
  if (prompt.startsWith("Preemptive priority")) return priority(jobs, { preemptive: true });
  const q = /^Round Robin, quantum (\d)/.exec(prompt);
  if (!q) throw new Error(prompt);
  // either RR convention: the generators only make workloads where they agree
  const g = roundRobin(jobs, Number(q[1]));
  expect(rrPreemptedFirst(jobs, Number(q[1]))).toEqual(g.gantt);
  return g;
}

describe("Clocktower generators", () => {
  it("averages: the answer is the re-solved metric, for every algorithm and metric", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const q = schedAverage.make(seed) as NumericQ;
      expect(questionProblems(q)).toEqual([]);
      const jobs = parseTable(q.code!);
      expect(jobs.length).toBeGreaterThanOrEqual(3);
      expect(new Set(jobs.map((j) => j.burst)).size).toBe(jobs.length);
      const s = solve(q.prompt, jobs);
      const metric = /average (\w+) time/.exec(q.prompt)![1] as "waiting" | "turnaround" | "response";
      // independently: waiting = turnaround − burst, response = first run − arrival
      const per = jobs.map((j, i) => {
        const first = Math.min(...s.gantt.filter((b) => b.name === j.name).map((b) => b.start));
        const tat = s.completion[i] - j.arrival;
        return metric === "turnaround" ? tat : metric === "waiting" ? tat - j.burst : first - j.arrival;
      });
      expect(q.answer).toBeCloseTo(per.reduce((a, b) => a + b, 0) / jobs.length, 9);
      expect(q.gantt).toEqual(s.gantt);
      if (metric === "response") expect(q.prompt).toMatch(/^(SRTF|Preemptive priority|Round Robin)/);
      expect(grade(q, { kind: "numeric", value: String(Math.round(q.answer * 100) / 100) })).toBe(true);
      seen.add(`${q.prompt.split(/[ ,(]/)[0]}:${metric}`);
    }
    expect(seen).toEqual(
      new Set(["Non-preemptive:waiting", "Non-preemptive:turnaround", "SRTF:waiting", "SRTF:turnaround", "SRTF:response", "Preemptive:waiting", "Preemptive:turnaround", "Preemptive:response", "Round:waiting", "Round:turnaround", "Round:response"]),
    );
  });

  it("completion: the named job finishes when the re-solved chart says, and it's usually a preempted one", () => {
    let split = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const q = schedFinish.make(seed) as NumericQ;
      expect(questionProblems(q)).toEqual([]);
      const jobs = parseTable(q.code!);
      const s = solve(q.prompt, jobs);
      const name = /At what time does (P\d) finish/.exec(q.prompt)![1];
      const blocks = s.gantt.filter((b) => b.name === name);
      expect(q.answer).toBe(Math.max(...blocks.map((b) => b.end)));
      if (blocks.length > 1) split++;
    }
    expect(split).toBeGreaterThan(200);
  });

  it("which algorithm: exactly one choice draws the shown chart, and every answer comes up", () => {
    const answers = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = schedWhich.make(seed) as McqQ;
      expect(questionProblems(q)).toEqual([]);
      expect([...q.options].sort()).toEqual(WHICH_ALGOS.map((a) => a.label).sort());
      const jobs = [...q.prompt.matchAll(/(P\d) arrives at (\d+), burst (\d+)/g)].map((m) => job(m[1], Number(m[2]), Number(m[3])));
      const draws = q.options.filter((o) => {
        const run = { FCFS: fcfs, "Non-preemptive SJF": sjf, SRTF: srtf, "Round Robin (q = 2)": (j: Job[]) => roundRobin(j, 2) }[o]!;
        return ganttText(run(jobs).gantt) === ganttText(q.chart!);
      });
      expect(draws).toEqual([q.options[q.answer]]);
      for (const o of q.options) if (o !== draws[0]) expect(q.explain).toMatch(new RegExp(`${o.replace(/[()]/g, "\\$&")} would run P\\d \\d+–\\d+`));
      expect(q.explain).not.toContain("null");
      expect(rrPreemptedFirst(jobs, 2)).toEqual(roundRobin(jobs, 2).gantt);
      answers.add(q.options[q.answer]);
    }
    expect(answers.size).toBe(4);
  });
});

describe("Clocktower battles draw from the pool", () => {
  it("six distinct pool questions, deterministic per seed, every question asked over many battles", () => {
    const keys = new Set([...pool.authored.map(cardKey), ...pool.generators.map((g) => g.id)]);
    const qs = gymBattleQuestions("scheduling", 3, {}, T);
    expect(qs).toHaveLength(BATTLE_TURNS);
    expect(gymBattleQuestions("scheduling", 3, {}, T)).toEqual(qs);
    const asked = new Set<string>();
    for (let s = 0; s < 200; s++)
      for (const q of gymBattleQuestions("scheduling", s, {}, T)) {
        expect(keys).toContain(cardKey(q));
        asked.add(cardKey(q));
      }
    expect(asked).toEqual(keys);
  });

  function play(qs: Question[], pattern: boolean[], player: Fighter) {
    const gym = GYMS.find((g) => g.id === "scheduling")!;
    let s = reducer(initialState(player, bossFighter(gym), qs.length), { type: "ready" });
    for (let i = 0; s.phase === "ask"; i++) {
      s = reducer(s, { type: "answer", correct: pattern[i] ?? false, power: qs[i].move.power, seconds: 30, moveType: qs[i].move.type, counterType: gym.type });
      s = reducer(s, { type: "next" });
    }
    return s.phase;
  }

  // only the boss set's own Timer Tick (io) is super effective here; the new questions stay scheduler-typed
  it("keeps Chronogolem balanced for any draw: the weakest six win with a slip, the strongest lose with three misses", () => {
    const all = [...pool.authored, ...pool.generators.map((g) => g.make(1))].sort((a, b) => a.move.power - b.move.power);
    const weakest = all.slice(0, BATTLE_TURNS);
    const strongest = all.slice(-BATTLE_TURNS);
    for (const p of STARTERS.flatMap((s) => [starterFighter(s), starterFighter(s, xpForLevel(7))])) {
      expect(play(weakest, weakest.map(() => true), p), p.name).toBe("victory");
      for (let slip = 0; slip < BATTLE_TURNS; slip++) expect(play(weakest, weakest.map((_, i) => i !== slip), p), `${p.name} slip ${slip}`).toBe("victory");
      expect(play(strongest, [true, true, true, false, false, false], p), p.name).toBe("defeat");
    }
  });
});
