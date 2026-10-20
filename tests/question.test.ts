import { describe, expect, it } from "vitest";
import { DEMO_QUESTIONS } from "@/content/demo";
import { fcfsAverage, forkPrints, GENERATORS } from "@/content/generators";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { PCB_CONTENTS, SAMPLE_QUESTIONS, SYSCALL_STEPS } from "@/content/questionSamples";
import { answerText, chartOf, grade, kindOf, parseNumber, questionProblems, scrambled, unitsOf, type GanttQ, type NumericQ, type Question } from "@/game/engine/question";
import { runForks } from "@/game/sim/fork";
import { fcfs, ganttText } from "@/game/sim/scheduling";
import { rng } from "@/lib/rng";

const move = { name: "Test", type: "process" as const, power: 30 };

describe("parseNumber", () => {
  it("reads integers, decimals, negatives and fractions", () => {
    expect(parseNumber("17")).toBe(17);
    expect(parseNumber(" 5.5 ")).toBe(5.5);
    expect(parseNumber(".5")).toBe(0.5);
    expect(parseNumber("3.")).toBe(3);
    expect(parseNumber("-2")).toBe(-2);
    expect(parseNumber("17/3")).toBeCloseTo(5.6667, 3);
    expect(parseNumber("1,000")).toBe(1000);
  });
  it("rejects things that aren't numbers", () => {
    for (const s of ["", " ", "abc", "1e3x", "5/0", "--1", "1.2.3", "ms"]) expect(parseNumber(s)).toBeNull();
  });
});

describe("grade", () => {
  it("grades MCQs (including the original data without a kind)", () => {
    const q = DEMO_QUESTIONS[1];
    expect(kindOf(q)).toBe("mcq");
    expect(grade(q, { kind: "mcq", choice: q.answer })).toBe(true);
    expect(grade(q, { kind: "mcq", choice: (q.answer + 1) % 4 })).toBe(false);
  });
  it("grades select-all: every right option and nothing else", () => {
    const q = PCB_CONTENTS;
    expect(grade(q, { kind: "multi", choices: [5, 2, 1, 0] })).toBe(true);
    expect(grade(q, { kind: "multi", choices: [0, 1, 2] })).toBe(false);
    expect(grade(q, { kind: "multi", choices: [0, 1, 2, 5, 3] })).toBe(false);
    expect(grade(q, { kind: "multi", choices: [] })).toBe(false);
  });
  it("grades numbers within the tolerance", () => {
    const q: NumericQ = { kind: "numeric", id: "n", prompt: "?", explain: "!", move, answer: 17 / 3 };
    expect(grade(q, { kind: "numeric", value: "5.67" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "17/3" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "5.6" })).toBe(false);
    expect(grade(q, { kind: "numeric", value: "" })).toBe(false);
    const exact: NumericQ = { ...q, answer: 8, tolerance: 0 };
    expect(grade(exact, { kind: "numeric", value: "8" })).toBe(true);
    expect(grade(exact, { kind: "numeric", value: "8.01" })).toBe(false);
  });
  it("grades order-the-steps", () => {
    expect(grade(SYSCALL_STEPS, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(SYSCALL_STEPS, { kind: "order", order: [1, 0, 2, 3, 4] })).toBe(false);
    expect(grade(SYSCALL_STEPS, { kind: "order", order: [0, 1, 2, 3] })).toBe(false);
  });
  it("a response of the wrong kind is wrong", () => {
    expect(grade(SYSCALL_STEPS, { kind: "mcq", choice: 0 })).toBe(false);
    expect(grade(DEMO_QUESTIONS[0], { kind: "numeric", value: "1" })).toBe(false);
  });
});

describe("gantt build questions", () => {
  // Silberschatz's SJF example (P4 3, P1 6, P3 7, P2 8, all at 0)
  const sjfChart = [
    { name: "P4", start: 0, end: 3 },
    { name: "P1", start: 3, end: 9 },
    { name: "P3", start: 9, end: 16 },
    { name: "P2", start: 16, end: 24 },
  ];
  const q: GanttQ = { kind: "gantt", id: "g", prompt: "Build the SJF chart", explain: "x", jobs: ["P1", "P2", "P3", "P4"], answer: sjfChart, move };

  it("expands charts to time units and merges them back", () => {
    expect(unitsOf([{ name: "P1", start: 0, end: 2 }, { name: null, start: 2, end: 3 }, { name: "P2", start: 3, end: 4 }])).toEqual(["P1", "P1", null, "P2"]);
    expect(chartOf(["P1", "P1", null, "P2", "P2", "P1"])).toEqual([
      { name: "P1", start: 0, end: 2 },
      { name: null, start: 2, end: 3 },
      { name: "P2", start: 3, end: 5 },
      { name: "P1", start: 5, end: 6 },
    ]);
    expect(chartOf(unitsOf(sjfChart))).toEqual(sjfChart);
    expect(chartOf([])).toEqual([]);
  });

  it("grades the chart unit by unit", () => {
    const right = unitsOf(sjfChart);
    expect(grade(q, { kind: "gantt", units: right })).toBe(true);
    // FCFS order instead (P1 first) is wrong
    expect(grade(q, { kind: "gantt", units: unitsOf([{ name: "P1", start: 0, end: 6 }, { name: "P2", start: 6, end: 14 }, { name: "P3", start: 14, end: 21 }, { name: "P4", start: 21, end: 24 }]) })).toBe(false);
    // one unit off, one short, one too long, idle in place of a job
    const swapped = [...right];
    [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
    expect(grade(q, { kind: "gantt", units: swapped })).toBe(false);
    expect(grade(q, { kind: "gantt", units: right.slice(0, -1) })).toBe(false);
    expect(grade(q, { kind: "gantt", units: [...right, "P2"] })).toBe(false);
    expect(grade(q, { kind: "gantt", units: [null, ...right.slice(1)] })).toBe(false);
    expect(grade(q, { kind: "order", order: [0, 1, 2] })).toBe(false);
    expect(answerText(q)).toBe("P4 0–3 | P1 3–9 | P3 9–16 | P2 16–24");
  });

  it("flags malformed charts", () => {
    expect(questionProblems(q)).toEqual([]);
    const bad = (answer: GanttQ["answer"], jobs: GanttQ["jobs"] = q.jobs) => questionProblems({ ...q, answer, jobs });
    expect(bad([{ name: "P1", start: 1, end: 3 }, { name: "P2", start: 3, end: 4 }], ["P1", "P2"])).toContain("chart must start at 0");
    expect(bad([{ name: "P1", start: 0, end: 3 }, { name: "P2", start: 4, end: 5 }], ["P1", "P2"])).toContain("chart must be contiguous whole units");
    expect(bad([{ name: "P1", start: 0, end: 1.5 }, { name: "P2", start: 1.5, end: 3 }], ["P1", "P2"])).toContain("chart must be contiguous whole units");
    expect(bad([{ name: "P1", start: 0, end: 1 }, { name: "P1", start: 1, end: 2 }, { name: "P2", start: 2, end: 3 }], ["P1", "P2"])).toContain("chart blocks must be merged");
    expect(bad([{ name: "P1", start: 0, end: 1 }, { name: "P9", start: 1, end: 2 }], ["P1", "P2"])).toEqual(expect.arrayContaining(["chart names a job not in jobs", "a job never runs"]));
    expect(bad([{ name: "P1", start: 0, end: 20 }, { name: "P2", start: 20, end: 25 }], ["P1", "P2"])).toContain("chart too long to build by tapping");
    expect(bad(sjfChart, ["P1"])).toContain("gantt needs 2–5 jobs");
  });
});

describe("answerText", () => {
  it("states the right answer for each kind", () => {
    expect(answerText(DEMO_QUESTIONS[1])).toBe("0");
    expect(answerText(PCB_CONTENTS)).toBe("Program counter, Saved CPU registers, Process state, List of open files");
    expect(answerText({ kind: "numeric", id: "n", prompt: "?", explain: "!", move, answer: 17 / 3, unit: "ms" })).toBe("5.67 ms");
    expect(answerText(SYSCALL_STEPS)).toMatch(/^1\. The program puts .* 5\. Return-from-trap/);
  });
});

describe("scrambled", () => {
  it("is a permutation that is never already in order, and stable per seed", () => {
    for (let seed = 0; seed < 300; seed++) {
      const s = scrambled(SYSCALL_STEPS, seed);
      expect([...s].sort()).toEqual([0, 1, 2, 3, 4]);
      expect(grade(SYSCALL_STEPS, { kind: "order", order: s })).toBe(false);
      expect(scrambled(SYSCALL_STEPS, seed)).toEqual(s);
    }
  });
});

describe("question data", () => {
  const all: Question[] = [...DEMO_QUESTIONS, ...Object.values(GYM_QUESTIONS).flat(), ...SAMPLE_QUESTIONS];
  it("every authored question is well-formed, with unique ids", () => {
    for (const q of all) expect(questionProblems(q), q.id).toEqual([]);
    const gymIds = [...Object.values(GYM_QUESTIONS).flat(), ...SAMPLE_QUESTIONS].map((q) => q.id);
    expect(new Set(gymIds).size).toBe(gymIds.length);
  });
  it("questionProblems catches bad data", () => {
    expect(questionProblems({ ...PCB_CONTENTS, answers: [9] })).toContain("answer out of range");
    expect(questionProblems({ ...SYSCALL_STEPS, steps: ["a", "a", "b"] })).toContain("duplicate steps");
    expect(questionProblems({ ...DEMO_QUESTIONS[0], answer: 4 })).toContain("answer out of range");
  });
});

describe("rng", () => {
  it("is deterministic per seed and stays in range", () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 100; i++) {
      const x = a.int(3, 7);
      expect(x).toBe(b.int(3, 7));
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(7);
    }
  });
});

describe("FCFS simulator (Silberschatz §5.3.1)", () => {
  it("P1 24, P2 3, P3 3 in that order: average wait 17 ms", () => {
    const s = fcfs([
      { name: "P1", arrival: 0, burst: 24 },
      { name: "P2", arrival: 0, burst: 3 },
      { name: "P3", arrival: 0, burst: 3 },
    ]);
    expect(ganttText(s.gantt)).toBe("P1 0–24 | P2 24–27 | P3 27–30");
    expect(s.waiting).toEqual([0, 24, 27]);
    expect(s.avgWaiting).toBe(17);
    expect(s.avgTurnaround).toBe(27);
  });
  it("arriving P2, P3, P1: average wait drops to 3 ms (the convoy effect)", () => {
    const s = fcfs([
      { name: "P2", arrival: 0, burst: 3 },
      { name: "P3", arrival: 0, burst: 3 },
      { name: "P1", arrival: 0, burst: 24 },
    ]);
    expect(s.avgWaiting).toBe(3);
  });
  it("idles until a late arrival", () => {
    const s = fcfs([
      { name: "P1", arrival: 0, burst: 2 },
      { name: "P2", arrival: 5, burst: 3 },
    ]);
    expect(ganttText(s.gantt)).toBe("P1 0–2 | idle 2–5 | P2 5–8");
    expect(s.waiting).toEqual([0, 0]);
    expect(s.response).toEqual([0, 0]);
  });
});

describe("fork simulator", () => {
  it("fork(); fork(); fork(); gives 8 processes (Silberschatz exercise 3.2)", () => {
    expect(runForks(["fork", "fork", "fork"]).processes).toBe(8);
  });
  it("for (i = 0; i < 4; i++) fork(); gives 16 processes (Silberschatz exercise 3.12)", () => {
    expect(runForks(["fork", "fork", "fork", "fork"]).processes).toBe(16);
  });
  it("fork(); printf; fork(); printf prints 2 + 4 = 6 lines", () => {
    expect(runForks(["fork", "print", "fork", "print"])).toEqual({ processes: 4, prints: 6 });
    expect(runForks(["print"])).toEqual({ processes: 1, prints: 1 });
  });
});

describe("generators", () => {
  it("are deterministic, well-formed and solved correctly for many seeds", () => {
    for (const g of GENERATORS) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = g.make(seed);
        expect(q.id).toBe(`${g.id}#${seed}`);
        expect(questionProblems(q), q.id).toEqual([]);
        expect(g.make(seed)).toEqual(q);
        if (q.kind === "numeric") {
          // the rounded answer shown to players is accepted
          expect(grade(q, { kind: "numeric", value: answerText(q).replace(` ${q.unit ?? ""}`, "") }), q.id).toBe(true);
        } else if (q.kind === "multi") {
          expect(grade(q, { kind: "multi", choices: q.answers }), q.id).toBe(true);
          // a select-all always has something to leave unticked
          expect(q.answers.length, q.id).toBeLessThan(q.options.length);
        } else if (q.kind === "order") {
          expect(grade(q, { kind: "order", order: q.steps.map((_, i) => i) }), q.id).toBe(true);
        } else if (q.kind === "gantt") {
          expect(grade(q, { kind: "gantt", units: unitsOf(q.answer) }), q.id).toBe(true);
        }
      }
    }
  });
  it("FCFS questions agree with an independent hand computation", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = fcfsAverage.make(seed) as NumericQ;
      const rows = q.code!.split("\n").slice(1).map((l) => l.trim().split(/\s+/));
      const jobs = rows.map(([, a, b]) => ({ arrival: Number(a), burst: Number(b) }));
      // jobs are listed in arrival order, so FCFS runs them top to bottom
      let t = 0;
      const per = jobs.map((j) => {
        t = Math.max(t, j.arrival) + j.burst;
        return q.prompt.includes("waiting") ? t - j.arrival - j.burst : t - j.arrival;
      });
      expect(q.answer).toBeCloseTo(per.reduce((a, b) => a + b, 0) / jobs.length, 9);
    }
  });
  it("fork questions match 2^k per printf", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = forkPrints.make(seed) as NumericQ;
      let alive = 1;
      let prints = 0;
      for (const line of q.code!.split("\n")) {
        if (line === "fork();") alive *= 2;
        else prints += alive;
      }
      expect(q.answer).toBe(prints);
    }
  });
  it("vary across seeds", () => {
    for (const g of GENERATORS) expect(new Set([...Array(30).keys()].map((s) => JSON.stringify(g.make(s + 1)))).size).toBeGreaterThan(10);
  });
});

describe("practice battle questions", () => {
  it("has one of every kind, all well-formed, and new generated problems per seed", async () => {
    const { practiceQuestions } = await import("@/content/practice");
    const qs = practiceQuestions(21);
    expect(new Set(qs.map(kindOf))).toEqual(new Set(["mcq", "multi", "numeric", "order"]));
    for (const q of qs) expect(questionProblems(q), q.id).toEqual([]);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    expect(practiceQuestions(21)).toEqual(qs);
    expect(practiceQuestions(300).map((q) => q.id)).not.toEqual(qs.map((q) => q.id));
  });
});
