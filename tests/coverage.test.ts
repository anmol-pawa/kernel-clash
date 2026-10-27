import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { INTERVIEW_QUESTIONS } from "@/content/interviewTopics";
import { LESSONS } from "@/content/lessons";
import { POOLS } from "@/content/pools";
import { CONTAINER_QUESTIONS } from "@/content/containerQuestions";
import { cpuMax, memoryMax } from "@/game/sim/containers";
import { leaks, OLD_X86, nestedWalkRefs, preCopy } from "@/game/sim/virt";
import { grade, kindOf, questionProblems, type McqQ, type NumericQ } from "@/game/engine/question";

const doc = readFileSync("docs/COVERAGE.md", "utf8");
const rows = doc.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| ---") && !l.startsWith("| Topic"));
const ticks = [...rows.join("\n").matchAll(/`([^`]+)`/g)].map((m) => m[1]);

const lessonIds = new Set(LESSONS.map((l) => l.id));
const questionIds = new Set(INTERVIEW_QUESTIONS.map((q) => q.id));
const generatorIds = new Set(Object.values(POOLS).flatMap((p) => p.generators.map((g) => g.id)));
const everyQuestionId = new Set([...questionIds, ...Object.values(POOLS).flatMap((p) => p.authored.map((q) => q.id))]);

describe("coverage matrix", () => {
  it("names only things that exist", () => {
    expect(ticks.length).toBeGreaterThan(100);
    for (const t of ticks) {
      if (t.includes("<")) continue;
      if (t.startsWith("game/") || t.startsWith("tests/") || t.startsWith("content/")) expect(existsSync(t), t).toBe(true);
      else if (t.startsWith("gen-")) expect(generatorIds.has(t), t).toBe(true);
      else if (/^(basics|processes|scheduling|sync|deadlocks|memory|virtual|storage|containers|virt|atomics|alloc|io)-/.test(t)) expect(lessonIds.has(t), t).toBe(true);
      else expect(everyQuestionId.has(t), t).toBe(true);
    }
  });

  it("gives every topic at least two example questions that exist", () => {
    expect(rows.length).toBe(15);
    for (const row of rows) {
      const cells = row.split("|").map((c) => c.trim());
      const ids = [...(cells[5] ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      expect(ids.length, cells[1]).toBeGreaterThanOrEqual(2);
      expect(ids.filter((i) => everyQuestionId.has(i)).length, cells[1]).toBe(ids.length);
    }
  });
});

describe("container, virtualization and NUMA questions", () => {
  const find = (id: string) => CONTAINER_QUESTIONS.find((q) => q.id === id)!;

  it("are well-formed, unique, in the interview pool and mapped", () => {
    expect(CONTAINER_QUESTIONS).toHaveLength(10);
    expect(new Set(CONTAINER_QUESTIONS.map((q) => q.id)).size).toBe(10);
    for (const q of CONTAINER_QUESTIONS) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(questionIds.has(q.id), q.id).toBe(true);
      expect(POOLS.interview.authored.map((x) => x.id), q.id).toContain(q.id);
    }
  });

  it("grade the key right and a wrong answer wrong", () => {
    for (const q of CONTAINER_QUESTIONS) {
      if (kindOf(q) === "numeric") {
        const n = q as NumericQ;
        expect(grade(n, { kind: "numeric", value: String(n.answer) }), q.id).toBe(true);
        expect(grade(n, { kind: "numeric", value: String(n.answer + 7) }), q.id).toBe(false);
      } else {
        const m = q as McqQ;
        expect(m.options).toHaveLength(4);
        expect(grade(m, { kind: "mcq", choice: m.answer }), q.id).toBe(true);
        expect(grade(m, { kind: "mcq", choice: (m.answer + 1) % 4 }), q.id).toBe(false);
      }
    }
    expect(new Set(CONTAINER_QUESTIONS.filter((q) => kindOf(q) === "mcq").map((q) => (q as McqQ).answer)).size).toBeGreaterThanOrEqual(3);
  });

  it("agree with the simulators and textbook values", () => {
    expect((find("ct-cpu-throttle") as NumericQ).answer).toBe(12.5);
    expect(cpuMax(50000, 100000, 4, 8).throttledUs).toBe(87500);
    expect((find("ct-copy-up") as NumericQ).answer).toBe(100);
    expect((find("ct-nested-walk") as NumericQ).answer).toBe(19);
    expect(nestedWalkRefs(4, 4)).toBe(24);
    const oom = memoryMax(512, [{ name: "worker", anonMB: 300 }, { name: "sidecar", anonMB: 250 }], 100);
    expect(oom).toMatchObject({ reclaimedMB: 100, killed: ["worker"] });
    const mq = find("ct-memory-max") as McqQ;
    expect(mq.options[mq.answer]).toContain("worker");
    expect(leaks(OLD_X86).map((i) => i.name)).toEqual(["POPF"]);
    expect(preCopy(16384, 1200, 1000, 64).converges).toBe(false);
  });
});
