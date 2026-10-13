import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { EVOLVE_GYM, STARTERS, starterById, starterFighter } from "@/content/starters";
import { effectiveness } from "@/game/engine/types";
import { CREATURES, EVOLVED_ART, STARTER_ART } from "@/game/sprites";
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

  it("become typed fighters at full HP, with Bytling as the fallback", () => {
    for (const s of STARTERS) expect(starterFighter(s)).toMatchObject({ name: s.name, type: s.type, hp: s.hp, maxHp: s.hp, level: 5 });
    expect(starterById("spinnail").name).toBe("Spinnail");
    expect(starterById(null).id).toBe("bytling");
    expect(starterById("nope").id).toBe("bytling");
  });
});

describe("starter evolutions", () => {
  it("each starter has a distinct evolved form whose art meets the bar and differs from the starter's", () => {
    expect(new Set(STARTERS.map((s) => s.evolution.id)).size).toBe(3);
    for (const s of STARTERS) {
      const art = EVOLVED_ART[s.evolution.id];
      expect(art?.name).toBe(s.evolution.name);
      expect(CREATURES).toContain(art);
      expect(creatureProblems(art)).toEqual([]);
      expect(STARTERS.map((x) => x.id)).not.toContain(s.evolution.id);
      // same canvas size, so the evolve morph can cross-fade silhouettes in place
      const base = STARTER_ART[s.id].front.idle[0];
      expect(art.front.idle[0].length).toBe(base.length);
      expect(art.front.idle[0][0].length).toBe(base[0].length);
      expect(art.front.idle[0].join("")).not.toBe(base.join(""));
      expect(s.evolution.blurb.length).toBeGreaterThan(20);
    }
  });

  it("the evolution milestone is a real gym that isn't the first", () => {
    const i = GYMS.findIndex((g) => g.id === EVOLVE_GYM);
    expect(i).toBeGreaterThan(0);
  });
});
