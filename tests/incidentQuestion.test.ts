import { describe, expect, it } from "vitest";
import { INCIDENT_QUESTIONS } from "@/content/incidentQuestions";
import { INTERVIEW_QUESTIONS, topicOf } from "@/content/interviewTopics";
import { answerText, correctionText, grade, kindOf, questionProblems, type IncidentQ } from "@/game/engine/question";

const base = INCIDENT_QUESTIONS[0];
const mk = (over: Partial<IncidentQ>): IncidentQ => ({ ...base, ...over });
const key = (q: IncidentQ) => q.steps.map((s) => s.answer);

describe("incident (production debugging)", () => {
  it("grades every chained step exactly", () => {
    expect(kindOf(base)).toBe("incident");
    expect(grade(base, { kind: "incident", choices: key(base) })).toBe(true);
    const wrong = key(base).map((a, i) => (i === 1 ? (a + 1) % base.steps[i].options.length : a));
    expect(grade(base, { kind: "incident", choices: wrong })).toBe(false);
    expect(grade(base, { kind: "incident", choices: key(base).slice(1) })).toBe(false);
    expect(grade(base, { kind: "mcq", choice: 0 })).toBe(false);
  });

  it("states the diagnosis after a wrong answer", () => {
    expect(answerText(base)).toContain("(1) Disk I/O");
    expect(correctionText(base)).toMatch(/^The diagnosis is \(1\)/);
  });

  it("rejects malformed incidents", () => {
    expect(questionProblems(mk({ steps: base.steps.slice(0, 1) }))).toContain("incident needs 2–3 steps");
    expect(questionProblems(mk({ outputs: [] }))).toContain("incident needs 1–3 tool outputs");
    expect(questionProblems(mk({ steps: [{ ...base.steps[0], answer: 9 }, base.steps[1]] }))).toContain("step answer out of range");
    expect(questionProblems(mk({ steps: [{ ...base.steps[0], why: " " }, base.steps[1]] }))).toContain("each step needs a question and a justification");
    expect(questionProblems(mk({ outputs: [{ cmd: "ps", text: Array(20).fill("x").join("\n") }] }))).toContain("tool output over 14 lines");
  });

  it("authored incidents are well-formed, justified and topic-tagged", () => {
    for (const q of INCIDENT_QUESTIONS) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(INTERVIEW_QUESTIONS).toContain(q);
      expect(topicOf(q), q.id).toBeTruthy();
    }
  });

  it("the I/O-wait scenario's numbers back its keyed answers", () => {
    const text = base.outputs.map((o) => o.text).join("\n");
    const cpu = /(\d+\.\d) us,\s+(\d+\.\d) sy,.*?(\d+\.\d) id,\s+(\d+\.\d) wa/.exec(text)!;
    const [us, sy, , wa] = [1, 2, 3, 4].map((i) => Number(cpu[i]));
    expect(us + sy).toBeLessThan(10); // CPU is not the bottleneck
    expect(wa).toBeGreaterThan(50); // the wait is on I/O
    expect(text).toMatch(/Swap:\s+4096 total,\s+4096 free/); // not swapping
    expect(text).toMatch(/0 zombie/);
    expect(text).toMatch(/14 D /);
  });
});
