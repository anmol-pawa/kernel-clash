import { describe, expect, it } from "vitest";
import { TOOLKIT_QUESTIONS } from "@/content/toolkitQuestions";
import { POOLS } from "@/content/pools";
import { INTERVIEW_QUESTIONS, topicOf } from "@/content/interviewTopics";
import { grade, kindOf, questionProblems, type McqQ, type MultiQ, type NumericQ, type OrderQ } from "@/game/engine/question";
import { cfsShares, cpusInMask, canOpenFd, SIGNALS, UNCATCHABLE } from "@/game/sim/linuxtools";

const find = (id: string) => TOOLKIT_QUESTIONS.find((q) => q.id === id)!;

describe("toolkit questions", () => {
  it("are well-formed, unique, in the interview pool and topic-mapped", () => {
    expect(TOOLKIT_QUESTIONS.length).toBe(12);
    expect(new Set(TOOLKIT_QUESTIONS.map((q) => q.id)).size).toBe(12);
    for (const q of TOOLKIT_QUESTIONS) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(POOLS.interview.authored.map((x) => x.id), q.id).toContain(q.id);
      expect(INTERVIEW_QUESTIONS.map((x) => x.id), q.id).toContain(q.id);
      expect(topicOf(q), q.id).toBeTruthy();
    }
  });

  it("does not always put the right MCQ answer in the same slot", () => {
    const mcq = TOOLKIT_QUESTIONS.filter((q): q is McqQ => kindOf(q) === "mcq");
    expect(new Set(mcq.map((q) => q.answer)).size).toBeGreaterThanOrEqual(3);
    for (const q of mcq) expect(q.options).toHaveLength(4);
  });

  it("grades the key right and a wrong answer wrong", () => {
    for (const q of TOOLKIT_QUESTIONS) {
      switch (kindOf(q)) {
        case "mcq": {
          const m = q as McqQ;
          expect(grade(m, { kind: "mcq", choice: m.answer }), q.id).toBe(true);
          expect(grade(m, { kind: "mcq", choice: (m.answer + 1) % 4 }), q.id).toBe(false);
          break;
        }
        case "multi": {
          const m = q as MultiQ;
          expect(grade(m, { kind: "multi", choices: [...m.answers] }), q.id).toBe(true);
          expect(grade(m, { kind: "multi", choices: [m.answers[0]] }), q.id).toBe(false);
          break;
        }
        case "numeric": {
          const n = q as NumericQ;
          expect(grade(n, { kind: "numeric", value: String(n.answer) }), q.id).toBe(true);
          expect(grade(n, { kind: "numeric", value: String(n.answer + 7) }), q.id).toBe(false);
          break;
        }
        case "order": {
          const o = q as OrderQ;
          expect(grade(o, { kind: "order", order: o.steps.map((_, i) => i) }), q.id).toBe(true);
          expect(grade(o, { kind: "order", order: o.steps.map((_, i) => o.steps.length - 1 - i) }), q.id).toBe(false);
          break;
        }
        default:
          throw new Error(`unexpected kind for ${q.id}`);
      }
    }
  });

  it("keys agree with the simulator facts", () => {
    expect((find("tk-nice-share") as NumericQ).answer).toBeCloseTo(cfsShares([0, 5])[0] * 100, 0);
    expect((find("tk-ulimit") as NumericQ).answer).toBe(1023);
    expect(canOpenFd(1023, 1024)).toBe(true);
    expect(canOpenFd(1024, 1024)).toBe(false);
    const taskset = find("tk-taskset") as McqQ;
    expect(cpusInMask("0x5")).toEqual([0, 2]);
    expect(taskset.options[taskset.answer]).toBe("CPUs 0 and 2");
    const sig = find("tk-signals") as MultiQ;
    expect(sig.answers.map((i) => sig.options[i].split(" ")[0]).sort()).toEqual([...UNCATCHABLE].sort());
    for (const i of sig.answers) expect(sig.options[i]).toContain(`(${SIGNALS[sig.options[i].split(" ")[0]]})`);
  });
});
