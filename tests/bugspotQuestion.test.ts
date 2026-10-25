import { describe, expect, it } from "vitest";
import { answerText, correctionText, grade, kindOf, questionProblems, type BugSpotQ } from "@/game/engine/question";

const LINES = [
  "int counter = 0;",
  "",
  "void *worker(void *arg) {",
  "    for (int i = 0; i < 1000; i++) {",
  "        counter++;",
  "    }",
  "    return NULL;",
  "}",
  "",
  "int main(void) { /* start two workers, join both */ }",
];

const mk = (over: Partial<BugSpotQ>): BugSpotQ => ({ kind: "bugspot", id: "b", prompt: "p", explain: "e", lines: LINES, answer: [4], move: { name: "Bug Zap", type: "sync", power: 30 }, ...over });

describe("bugspot (tap the buggy lines)", () => {
  it("grades exactly the keyed lines, in any order", () => {
    const q = mk({});
    expect(kindOf(q)).toBe("bugspot");
    expect(questionProblems(q)).toEqual([]);
    expect(grade(q, { kind: "bugspot", lines: [4] })).toBe(true);
    expect(grade(q, { kind: "bugspot", lines: [4, 3] })).toBe(false);
    expect(grade(q, { kind: "bugspot", lines: [3] })).toBe(false);
    expect(grade(q, { kind: "bugspot", lines: [] })).toBe(false);
    expect(grade(q, { kind: "mcq", choice: 4 })).toBe(false);
    const two = mk({ answer: [4, 3] });
    expect(questionProblems(two)).toEqual([]);
    expect(grade(two, { kind: "bugspot", lines: [3, 4] })).toBe(true);
    expect(grade(two, { kind: "bugspot", lines: [4] })).toBe(false);
  });

  it("says where the bug is", () => {
    expect(answerText(mk({}))).toBe("line 5: counter++;");
    expect(answerText(mk({ answer: [4, 3] }))).toBe("line 4: for (int i = 0; i < 1000; i++) {; line 5: counter++;");
    expect(correctionText(mk({}))).toBe("The bug is at line 5: counter++;.");
  });

  it("rejects malformed snippets and keys", () => {
    expect(questionProblems(mk({ lines: LINES.slice(0, 5) }))).toContain("bugspot needs 8–15 lines");
    expect(questionProblems(mk({ lines: [...LINES, ...LINES] }))).toContain("bugspot needs 8–15 lines");
    expect(questionProblems(mk({ answer: [] }))).toContain("bugspot needs 1–3 buggy lines");
    expect(questionProblems(mk({ answer: [1, 2, 3, 4] }))).toContain("bugspot needs 1–3 buggy lines");
    expect(questionProblems(mk({ answer: [4, 4] }))).toContain("duplicate buggy lines");
    expect(questionProblems(mk({ answer: [99] }))).toContain("buggy line out of range");
    expect(questionProblems(mk({ answer: [1] }))).toContain("a blank line can't be the bug");
    expect(questionProblems(mk({ lines: [...LINES.slice(0, 9), "a\nb"] }))).toContain("each line must be a single line");
  });
});
