import { describe, expect, it } from "vitest";
import { STARTERS } from "@/content/starters";
import { effectiveness } from "@/game/engine/types";
import { CREATURES } from "@/game/sprites";
import { creatureProblems } from "@/lib/creature";

describe("starters", () => {
  it("are three distinct, typed creatures with art that meets the bar", () => {
    expect(STARTERS).toHaveLength(3);
    expect(new Set(STARTERS.map((s) => s.type)).size).toBe(3);
    for (const s of STARTERS) {
      const art = CREATURES.find((c) => c.id === s.id);
      expect(art?.name).toBe(s.name);
      expect(art?.boss).toBeFalsy();
      expect(creatureProblems(art!)).toEqual([]);
    }
  });

  it("form a type triangle: each beats the next and resists nothing it loses to", () => {
    for (let i = 0; i < 3; i++) {
      const a = STARTERS[i].type;
      const b = STARTERS[(i + 1) % 3].type;
      expect(effectiveness(a, b)).toBe(2);
      expect(effectiveness(b, a)).toBe(0.5);
    }
  });
});
