import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { BOSSES, CREATURES, EFFECTS, SCENERY, WORLD } from "@/game/sprites";
import { BYTLING_ART } from "@/game/sprites/bytling";
import { creatureProblems, type CreatureArt } from "@/lib/creature";
import { PixelCanvas, runs, type Grid } from "@/lib/pixel";

const SHEETS = [...CREATURES.flatMap((c) => [c.front, c.back]), ...EFFECTS, ...SCENERY, ...WORLD];

describe("sprite sheets", () => {
  for (const s of SHEETS)
    it(`${s.name}: frames are rectangular, same size, and use only palette colours`, () => {
      expect(s.idle.length).toBeGreaterThan(0);
      const h = s.idle[0].length;
      const w = s.idle[0][0].length;
      for (const f of [...s.idle, ...Object.values(s.anims ?? {}).flat()]) {
        expect(f.length).toBe(h);
        for (const row of f) {
          expect(row.length).toBe(w);
          for (const ch of row) if (ch !== ".") expect(s.palette, `colour ${ch}`).toHaveProperty(ch);
        }
      }
      for (const c of Object.values(s.palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
});

describe("battle creatures meet the art bar", () => {
  for (const c of CREATURES)
    it(`${c.name}: front + back, ≥64×64, 2–4 idle frames, attack + hurt, outlined`, () => {
      expect(creatureProblems(c)).toEqual([]);
    });

  it("ids are unique", () => {
    expect(new Set(CREATURES.map((c) => c.id)).size).toBe(CREATURES.length);
  });

  it("front and back sprites differ, and so do attack and hurt poses", () => {
    for (const c of CREATURES) {
      expect(c.front.idle[0].join("")).not.toBe(c.back.idle[0].join(""));
      for (const s of [c.front, c.back]) {
        expect(s.anims!.attack[0].join("")).not.toBe(s.idle[0].join(""));
        expect(s.anims!.hurt[0].join("")).not.toBe(s.idle[0].join(""));
      }
    }
  });

  it("Bytling's edge pixels are all outline", () => {
    for (const f of [BYTLING_ART.front.idle[0], BYTLING_ART.back.idle[0]]) {
      const at = (x: number, y: number) => f[y]?.[x] ?? ".";
      for (let y = 0; y < f.length; y++)
        for (let x = 0; x < f[0].length; x++)
          if (at(x, y) !== "." && [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes(".")) expect(at(x, y)).toBe("o");
    }
  });
});

describe("gym bosses", () => {
  it("each boss sprite belongs to a real gym and matches that gym's boss name", () => {
    for (const [id, art] of Object.entries(BOSSES)) {
      const gym = GYMS.find((g) => g.id === id);
      expect(gym, id).toBeDefined();
      expect(art.name).toBe(gym!.boss.name);
      expect(CREATURES).toContain(art);
    }
  });

  it("bosses are flagged and drawn at 96×96", () => {
    for (const art of Object.values(BOSSES)) {
      expect(art.boss).toBe(true);
      for (const s of [art.front, art.back]) {
        expect(s.idle[0].length).toBe(96);
        expect(s.idle[0][0].length).toBe(96);
      }
    }
  });

  it("gyms 1 and 2 have their bosses drawn", () => {
    expect(Object.keys(BOSSES)).toEqual(expect.arrayContaining(["basics", "processes"]));
  });
});

describe("creatureProblems", () => {
  const block = (w: number, h: number, ch = "a"): Grid => {
    const k = new PixelCanvas(w, h);
    k.rect(1, 1, w - 2, h - 2, ch);
    k.outline("o");
    return k.toGrid();
  };
  const good = (): CreatureArt => {
    const sheet = { name: "t", palette: { o: "#000000", a: "#ff0000", b: "#00ff00" }, idle: [block(64, 64), block(64, 64, "b")], anims: { attack: [block(64, 64)], hurt: [block(64, 64)] } };
    return { id: "t", name: "T", front: sheet, back: { ...sheet } };
  };

  it("accepts a sprite that meets the bar", () => expect(creatureProblems(good())).toEqual([]));

  it("flags small sprites, missing poses, frozen idles, bad colours and missing outlines", () => {
    const c = good();
    c.front = { ...c.front, idle: [block(40, 40), block(40, 40, "b")], anims: { attack: [block(40, 40)], hurt: [block(40, 40)] } };
    expect(creatureProblems(c).join()).toMatch(/under 64×64/);
    c.front = { ...good().front, anims: { attack: [block(64, 64)] } };
    expect(creatureProblems(c).join()).toMatch(/missing "hurt"/);
    c.front = { ...good().front, idle: [block(64, 64), block(64, 64)] };
    expect(creatureProblems(c).join()).toMatch(/identical/);
    c.front = { ...good().front, idle: [block(64, 64, "z"), block(64, 64)] };
    expect(creatureProblems(c).join()).toMatch(/"z" not in palette/);
    const bare = Array.from({ length: 64 }, () => "a".repeat(64));
    c.front = { ...good().front, idle: [bare, block(64, 64)] };
    expect(creatureProblems(c).join()).toMatch(/aren't outline/);
    expect(creatureProblems({ ...good(), boss: true }).join()).toMatch(/under 96×96/);
  });
});

describe("PixelCanvas", () => {
  it("mirrors, outlines and run-encodes", () => {
    const k = new PixelCanvas(4, 3);
    k.px(1, 1, "a");
    k.mirror();
    expect(k.toGrid()).toEqual(["....", ".aa.", "...."]);
    k.outline("o");
    expect(k.toGrid()).toEqual([".oo.", "oaao", ".oo."]);
    expect(runs(k.toGrid())).toEqual([
      { x: 1, y: 0, w: 2, c: "o" },
      { x: 0, y: 1, w: 1, c: "o" },
      { x: 1, y: 1, w: 2, c: "a" },
      { x: 3, y: 1, w: 1, c: "o" },
      { x: 1, y: 2, w: 2, c: "o" },
    ]);
  });
});
