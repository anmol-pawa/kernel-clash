import { describe, expect, it } from "vitest";
import { FILL_QUESTIONS } from "@/content/fillQuestions";
import { INTERVIEW_QUESTIONS, TOPIC_OF } from "@/content/interviewTopics";
import { limitFor } from "@/game/engine/interview";
import { fillCode, grade, questionProblems } from "@/game/engine/question";

/** The code that must fill each blank, so a mis-keyed answer can't pass. */
const CORRECT: Record<string, string[]> = {
  "fill-bb-sem": ["sem_wait(&empty)", "sem_post(&full)"],
  "fill-bb-cv": ["while", "pthread_cond_signal(&not_full)"],
  "fill-rw": ["1", "sem_wait(&rw)"],
  "fill-philosophers": ["a > b", "sem_post(&fork[a])"],
  "fill-barrier": ["pthread_cond_broadcast(&all)", "pthread_cond_wait(&all, &m)"],
  "fill-once": ["!done", "done = 1"],
};

describe("classic fill problems", () => {
  it("has the six roadmap problems with unique ids", () => {
    expect(FILL_QUESTIONS).toHaveLength(6);
    expect(new Set(FILL_QUESTIONS.map((q) => q.id)).size).toBe(6);
    expect(Object.keys(CORRECT).sort()).toEqual(FILL_QUESTIONS.map((q) => q.id).sort());
  });

  for (const q of FILL_QUESTIONS) {
    it(`${q.id}: well-formed, and only the keyed code grades right`, () => {
      expect(questionProblems(q)).toEqual([]);
      const want = CORRECT[q.id];
      expect(q.blanks.map((b) => b.options[b.answer])).toEqual(want);
      const right = q.blanks.map((b) => b.answer);
      expect(grade(q, { kind: "fill", choices: right })).toBe(true);
      q.blanks.forEach((b, i) => {
        b.options.forEach((_, o) => {
          if (o === b.answer) return;
          const wrong = right.slice();
          wrong[i] = o;
          expect(grade(q, { kind: "fill", choices: wrong }), `blank ${i + 1} option ${o}`).toBe(false);
        });
      });
      expect(fillCode(q, right).join("\n")).not.toMatch(/___\d___/);
    });
  }

  it("keeps the answer from always being the first option", () => {
    const slots = FILL_QUESTIONS.flatMap((q) => q.blanks.map((b) => b.answer));
    expect(new Set(slots).size).toBeGreaterThan(1);
  });

  it("is in the Kernel Summit pool, with a topic and a 90 s limit", () => {
    for (const q of FILL_QUESTIONS) {
      expect(INTERVIEW_QUESTIONS).toContain(q);
      expect(TOPIC_OF[q.id], q.id).toBeDefined();
      expect(limitFor(q)).toBe(90);
    }
  });
});
