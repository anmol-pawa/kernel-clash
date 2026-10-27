import { describe, expect, it } from "vitest";
import { POOLS } from "@/content/pools";
import { answerText, questionProblems, type BugSpotQ, type Question } from "@/game/engine/question";

describe("whole question bank audit", () => {
  const generators = Object.values(POOLS).flatMap((p) => p.generators);

  it("authored ids are unique across every gym pool", () => {
    const ids = Object.values(POOLS).flatMap((p) => p.authored.map((q) => q.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("generator ids are unique and don't collide with authored ids", () => {
    const authored = new Set(Object.values(POOLS).flatMap((p) => p.authored.map((q) => q.id)));
    const ids = generators.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(authored.has(id), id).toBe(false);
  });

  it("every generator is deterministic and well-formed over 40 seeds", () => {
    for (const g of generators) {
      for (let seed = 1; seed <= 40; seed++) {
        const q = g.make(seed);
        expect(questionProblems(q), `${g.id} seed ${seed}`).toEqual([]);
        expect(q.explain.length, `${g.id} seed ${seed}`).toBeGreaterThan(20);
        expect(answerText(q).length, `${g.id} seed ${seed}`).toBeGreaterThan(0);
        expect(g.make(seed), `${g.id} seed ${seed}`).toEqual(q);
      }
    }
  });

  const authored = Object.values(POOLS).flatMap((p) => p.authored);

  it("every authored question is well-formed, with a real explanation and a readable answer", () => {
    for (const q of authored) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(q.explain.trim().length, q.id).toBeGreaterThan(20);
      expect(answerText(q).length, q.id).toBeGreaterThan(0);
    }
  });

  // The kinds with keyed option slots, which must not all sit in one place.
  const slotsOf: Record<string, (q: Question) => number[]> = {
    mcq: (q) => (q.kind === undefined || q.kind === "mcq" ? [q.answer] : []),
    fill: (q) => (q.kind === "fill" ? q.blanks.map((b) => b.answer) : []),
    incident: (q) => (q.kind === "incident" ? q.steps.map((s) => s.answer) : []),
  };

  for (const [kind, slots] of Object.entries(slotsOf)) {
    it(`${kind} answers are not parked in one slot`, () => {
      const all = authored.flatMap(slots);
      expect(all.length).toBeGreaterThan(5);
      const counts = new Map<number, number>();
      for (const s of all) counts.set(s, (counts.get(s) ?? 0) + 1);
      expect(counts.size, kind).toBeGreaterThan(1);
      expect(Math.max(...counts.values()) / all.length, kind).toBeLessThanOrEqual(0.6);
    });
  }

  it("bug-spot questions key different lines and never every line", () => {
    const spots = authored.filter((q): q is BugSpotQ => q.kind === "bugspot");
    expect(spots.length).toBeGreaterThan(3);
    expect(new Set(spots.flatMap((q) => q.answer)).size).toBeGreaterThan(3);
    for (const q of spots) expect(q.answer.length, q.id).toBeLessThan(q.lines.length);
  });

  it("every incident step justifies its answer", () => {
    for (const q of authored) {
      if (q.kind === "incident") for (const s of q.steps) expect(s.why.trim().length, q.id).toBeGreaterThan(15);
    }
  });
});
