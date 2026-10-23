import { describe, expect, it } from "vitest";
import { POOLS } from "@/content/pools";
import { answerText, questionProblems } from "@/game/engine/question";

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
});
