import { describe, expect, it } from "vitest";
import { levelFor, xpForLevel, xpProgress, xpYield } from "@/game/engine/xp";
import { typedLength } from "@/lib/typewriter";

describe("xp curve", () => {
  it("is cubic: level L needs L³ total XP", () => {
    expect([1, 2, 5, 10].map(xpForLevel)).toEqual([1, 8, 125, 1000]);
  });
  it("maps totals to levels at the exact thresholds", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(124)).toBe(4);
    expect(levelFor(125)).toBe(5);
    expect(levelFor(215)).toBe(5);
    expect(levelFor(216)).toBe(6);
  });
  it("reports progress through the current level", () => {
    expect(xpProgress(125)).toBe(0);
    expect(xpProgress(125 + 91 / 2)).toBeCloseTo(0.5);
  });
  it("yields more XP for higher-level foes and bosses", () => {
    expect(xpYield(4)).toBe(36);
    expect(xpYield(4, true)).toBe(54);
    expect(xpYield(7)).toBe(64);
  });
  it("levels the demo Bytling up after beating Glitchit", () => {
    const start = xpForLevel(5) + 70;
    expect(levelFor(start)).toBe(5);
    expect(levelFor(start + xpYield(4))).toBe(6);
  });
});

describe("typewriter", () => {
  it("reveals characters at the given rate and clamps to the text", () => {
    expect(typedLength("hello", 0, 45)).toBe(0);
    expect(typedLength("hello", 100, 20)).toBe(2);
    expect(typedLength("hello", 10_000, 45)).toBe(5);
    expect(typedLength("hello", -5, 45)).toBe(0);
  });
});
