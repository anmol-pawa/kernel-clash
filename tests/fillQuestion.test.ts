import { describe, expect, it } from "vitest";
import { answerText, correctionText, fillCode, fillParts, grade, kindOf, questionProblems, type FillQ } from "@/game/engine/question";

const LINES = [
  "void producer(void) {",
  "    while (1) {",
  "        ___1___;",
  "        sem_wait(&mutex);",
  "        put(item);",
  "        sem_post(&mutex);",
  "        ___2___;",
  "    }",
  "}",
];

const mk = (over: Partial<FillQ>): FillQ => ({
  kind: "fill",
  id: "f",
  prompt: "p",
  explain: "e",
  lines: LINES,
  blanks: [
    { options: ["sem_wait(&empty)", "sem_wait(&full)", "sem_post(&empty)"], answer: 0 },
    { options: ["sem_post(&empty)", "sem_post(&full)", "sem_wait(&full)"], answer: 1 },
  ],
  move: { name: "Patch", type: "sync", power: 30 },
  ...over,
});

describe("fill (complete the code)", () => {
  it("splits lines at blanks", () => {
    expect(fillParts("a ___1___ b ___2___")).toEqual(["a ", { blank: 0 }, " b ", { blank: 1 }]);
    expect(fillParts("plain")).toEqual(["plain"]);
  });

  it("grades every blank exactly", () => {
    const q = mk({});
    expect(kindOf(q)).toBe("fill");
    expect(questionProblems(q)).toEqual([]);
    expect(grade(q, { kind: "fill", choices: [0, 1] })).toBe(true);
    expect(grade(q, { kind: "fill", choices: [0, 0] })).toBe(false);
    expect(grade(q, { kind: "fill", choices: [1, 1] })).toBe(false);
    expect(grade(q, { kind: "fill", choices: [0] })).toBe(false);
    expect(grade(q, { kind: "mcq", choice: 0 })).toBe(false);
  });

  it("fills in the chosen code and explains the answer", () => {
    const q = mk({});
    expect(fillCode(q, [0, 1])[2]).toBe("        sem_wait(&empty);");
    expect(fillCode(q, [0, 1])[6]).toBe("        sem_post(&full);");
    expect(answerText(q)).toBe("(1) sem_wait(&empty); (2) sem_post(&full)");
    expect(correctionText(q)).toBe("The blanks are (1) sem_wait(&empty); (2) sem_post(&full).");
  });

  it("rejects malformed programs", () => {
    const q = mk({});
    expect(questionProblems(mk({ lines: LINES.slice(0, 3) }))).toContain("fill needs 5–16 lines");
    expect(questionProblems(mk({ blanks: [q.blanks[0]] }))).toContain("blanks must be numbered 1..n, each appearing once");
    expect(questionProblems(mk({ lines: LINES.map((l) => l.replace("___2___", "___1___")) }))).toContain("blanks must be numbered 1..n, each appearing once");
    expect(questionProblems(mk({ blanks: [{ options: ["a", "b"], answer: 0 }, q.blanks[1]] }))).toContain("each blank needs 3–4 options");
    expect(questionProblems(mk({ blanks: [{ options: ["a", "a", "b"], answer: 0 }, q.blanks[1]] }))).toContain("duplicate options in a blank");
    expect(questionProblems(mk({ blanks: [{ options: ["a", "b", "c"], answer: 3 }, q.blanks[1]] }))).toContain("blank answer out of range");
    expect(questionProblems(mk({ blanks: [] }))).toContain("fill needs 1–3 blanks");
  });
});
