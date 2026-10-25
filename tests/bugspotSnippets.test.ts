import { describe, expect, it } from "vitest";
import { BUGSPOT_QUESTIONS } from "@/content/bugspotQuestions";
import { INTERVIEW_QUESTIONS, TOPIC_OF } from "@/content/interviewTopics";
import { limitFor } from "@/game/engine/interview";
import { grade, questionProblems } from "@/game/engine/question";

/** What the keyed line(s) of each snippet must contain, so a mis-indexed key can't pass. */
const KEYED: Record<string, RegExp[]> = {
  "bs-counter": [/^\s*counter\+\+;$/],
  "bs-toctou": [/access\(path, W_OK\)/, /fopen\(path/],
  "bs-cond-if": [/^\s*if \(items == 0\)$/],
  "bs-lock-order": [/pthread_mutex_lock\(&b\)/],
  "bs-early-return": [/^\s*return -1;$/],
  "bs-dcl": [/if \(cfg == NULL\) \{$/, /cfg = load_config\(\)/],
  "bs-lost-signal": [/pthread_cond_signal/, /pthread_cond_wait/],
  "bs-ring-index": [/in = in \+ 1;/],
  "bs-fork-fail": [/waitpid\(pid/],
  "bs-double-close": [/close\(in\);/],
};

describe("bug-spotting snippets", () => {
  it("has the ten roadmap snippets with unique ids", () => {
    expect(BUGSPOT_QUESTIONS).toHaveLength(10);
    expect(new Set(BUGSPOT_QUESTIONS.map((q) => q.id)).size).toBe(10);
    expect(Object.keys(KEYED).sort()).toEqual(BUGSPOT_QUESTIONS.map((q) => q.id).sort());
  });

  for (const q of BUGSPOT_QUESTIONS) {
    it(`${q.id}: well-formed, and exactly the keyed lines are the bug`, () => {
      expect(questionProblems(q)).toEqual([]);
      const want = KEYED[q.id];
      expect(q.answer).toHaveLength(want.length);
      q.answer.forEach((i, n) => expect(q.lines[i], `line ${i}`).toMatch(want[n]));
      expect(grade(q, { kind: "bugspot", lines: [...q.answer].reverse() })).toBe(true);
      for (let i = 0; i < q.lines.length; i++) {
        if (q.lines[i].trim() === "" || q.answer.includes(i)) continue;
        expect(grade(q, { kind: "bugspot", lines: [i] }), `line ${i} alone`).toBe(false);
        expect(grade(q, { kind: "bugspot", lines: [...q.answer, i] }), `extra line ${i}`).toBe(false);
      }
      expect(grade(q, { kind: "bugspot", lines: [] })).toBe(false);
    });
  }

  it("is in the Kernel Summit pool, with a topic and a 90 s limit", () => {
    for (const q of BUGSPOT_QUESTIONS) {
      expect(INTERVIEW_QUESTIONS).toContain(q);
      expect(TOPIC_OF[q.id], q.id).toBeDefined();
      expect(limitFor(q)).toBe(90);
    }
  });
});
