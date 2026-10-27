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

  const outputOf = (id: string) => INCIDENT_QUESTIONS.find((q) => q.id === id)!.outputs.map((o) => o.text).join("\n");
  const num = (m: RegExpExecArray | null, i = 1) => Number(m![i]);

  it("the OOM scenario's numbers back its keyed answers", () => {
    const text = outputOf("inc-oom");
    const mem = /Mem:\s+(\d+)\s+(\d+)\s+(\d+)\s+\d+\s+(\d+)\s+(\d+)/.exec(text);
    const [total, used, free, cache, avail] = [1, 2, 3, 4, 5].map((i) => num(mem, i));
    expect(used + free + cache).toBe(total); // free's columns add up
    expect(avail).toBeLessThan(total * 0.02); // nothing reclaimable
    expect(text).toMatch(/Swap:\s+0\s+0\s+0/); // no swap to fall back on
    const rssKb = num(/anon-rss:(\d+)kB/.exec(text));
    expect(rssKb / 1024 / 1024).toBeGreaterThan(total / 1024 - 2); // the victim held nearly all RAM
    expect(num(/\s(\d+)\s+3011 indexer/.exec(text)) / 1024 / 1024).toBeGreaterThan(14); // the new process already grew again
  });

  it("the zombie scenario's PIDs really are exhausted", () => {
    const text = outputOf("inc-zombies");
    const counts = [...text.matchAll(/^\s+(\d+) ([RSZ])$/gm)].map((m) => [m[2], Number(m[1])] as const);
    const live = counts.filter(([s]) => s !== "Z").reduce((a, [, n]) => a + n, 0);
    const zombies = counts.find(([s]) => s === "Z")![1];
    const pidMax = num(/^(\d{5})$/m.exec(text));
    expect(live + zombies).toBeLessThanOrEqual(pidMax);
    expect(pidMax - (live + zombies)).toBeLessThan(10);
    expect(text).toContain("<defunct>");
    expect(text).toMatch(/\b2210 Sl\b/); // the parent is alive but not reaping
    expect(text).toMatch(/\d+\s+2210 Z/); // every zombie names it as parent
  });

  it("the pool deadlock scenario shows idle CPU, blocked workers and a full pool", () => {
    const text = outputOf("inc-pool-deadlock");
    expect(num(/(\d+\.\d) id/.exec(text))).toBeGreaterThan(95);
    const waiting = (text.match(/pool-1-worker-\d+$/gm) ?? []).length;
    const poolSize = num(/pool size (\d+)/.exec(text));
    expect(waiting).toBe(poolSize); // every worker is blocked
    expect(text).toMatch(/all \d+ busy/);
    expect(text).toContain("Future.get");
  });
});
