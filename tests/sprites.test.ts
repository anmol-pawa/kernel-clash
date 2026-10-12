import { describe, expect, it } from "vitest";
import { BYTLING } from "@/game/sprites/bytling";
import { PLATFORM, SKYLINE } from "@/game/sprites/scenery";
import { PixelCanvas, runs } from "@/lib/pixel";

const SHEETS = [BYTLING, PLATFORM, SKYLINE];

describe("sprite sheets", () => {
  for (const s of SHEETS)
    it(`${s.name}: frames are rectangular, same size, and use only palette colours`, () => {
      expect(s.idle.length).toBeGreaterThan(0);
      const h = s.idle[0].length;
      const w = s.idle[0][0].length;
      for (const f of s.idle) {
        expect(f.length).toBe(h);
        for (const row of f) {
          expect(row.length).toBe(w);
          for (const ch of row) if (ch !== ".") expect(s.palette, `colour ${ch}`).toHaveProperty(ch);
        }
      }
      for (const c of Object.values(s.palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });

  it("the mascot has a multi-frame idle and is outlined", () => {
    expect(BYTLING.idle.length).toBeGreaterThanOrEqual(2);
    expect(new Set(BYTLING.idle.map((f) => f.join("\n"))).size).toBeGreaterThan(1);
    // every filled pixel touching transparency is outline
    const f = BYTLING.idle[0];
    const at = (x: number, y: number) => f[y]?.[x] ?? ".";
    for (let y = 0; y < f.length; y++)
      for (let x = 0; x < f[0].length; x++)
        if (at(x, y) !== "." && [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes(".")) expect(at(x, y)).toBe("o");
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
