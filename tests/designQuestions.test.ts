import { describe, expect, it } from "vitest";
import { DESIGN_QUESTIONS } from "@/content/designQuestions";
import { POOLS } from "@/content/pools";
import { INTERVIEW_QUESTIONS, topicOf } from "@/content/interviewTopics";
import { grade, kindOf, questionProblems, type McqQ, type OrderQ } from "@/game/engine/question";
import { firstRunTimes, submitBurst } from "@/game/sim/designs";

const find = (id: string) => DESIGN_QUESTIONS.find((q) => q.id === id)!;

describe("design questions", () => {
  it("are seven designs, each an ordered-steps question plus a follow-up", () => {
    expect(DESIGN_QUESTIONS).toHaveLength(14);
    expect(DESIGN_QUESTIONS.filter((q) => kindOf(q) === "order")).toHaveLength(7);
    expect(DESIGN_QUESTIONS.filter((q) => kindOf(q) === "mcq")).toHaveLength(7);
    for (const q of DESIGN_QUESTIONS.filter((x) => kindOf(x) === "order")) {
      const stem = q.id.replace(/-steps$/, "");
      expect(DESIGN_QUESTIONS.some((x) => x.id.startsWith(stem + "-") && kindOf(x) === "mcq"), q.id).toBe(true);
    }
  });

  it("are well-formed, unique, in the interview pool and topic-mapped", () => {
    expect(new Set(DESIGN_QUESTIONS.map((q) => q.id)).size).toBe(14);
    for (const q of DESIGN_QUESTIONS) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(POOLS.interview.authored.map((x) => x.id), q.id).toContain(q.id);
      expect(INTERVIEW_QUESTIONS.map((x) => x.id), q.id).toContain(q.id);
      expect(topicOf(q), q.id).toBeTruthy();
    }
  });

  it("does not put the right MCQ answer in one slot", () => {
    const mcq = DESIGN_QUESTIONS.filter((q): q is McqQ => kindOf(q) === "mcq");
    expect(new Set(mcq.map((q) => q.answer)).size).toBeGreaterThanOrEqual(4);
  });

  it("grades the key right and a reversed order wrong", () => {
    for (const q of DESIGN_QUESTIONS) {
      if (kindOf(q) === "mcq") {
        const m = q as McqQ;
        expect(grade(m, { kind: "mcq", choice: m.answer }), q.id).toBe(true);
        expect(grade(m, { kind: "mcq", choice: (m.answer + 1) % 4 }), q.id).toBe(false);
      } else {
        const o = q as OrderQ;
        expect(grade(o, { kind: "order", order: o.steps.map((_, i) => i) }), q.id).toBe(true);
        expect(grade(o, { kind: "order", order: o.steps.map((_, i) => o.steps.length - 1 - i) }), q.id).toBe(false);
      }
    }
  });

  it("numbers in the prompts match the simulator", () => {
    expect(find("ds-sched-preempt").prompt).toContain(`t=${firstRunTimes([100, 5, 5], null)[2]}`);
    expect(find("ds-sched-preempt").prompt).toContain(`t=${firstRunTimes([100, 5, 5], 10)[2]}`);
    expect(submitBurst(8, 2, 3)).toEqual({ running: 2, queued: 3, rejected: 3 });
    expect(find("ds-pool-bound").prompt).toContain("2 run, 3 wait and 3 are rejected");
    const mq = find("ds-chat-select") as McqQ;
    expect(mq.options[mq.answer]).toContain("1024");
  });
});
