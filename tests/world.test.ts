import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { MOVE_TYPES } from "@/game/engine/types";
import { BADGES, GYM_H, GYM_SPOTS, GYM_W, MAP_H, MAP_W, OVERWORLD } from "@/game/sprites/overworld";
import { earnBadge, gymState, nextGym } from "@/game/world/progress";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

describe("gyms", () => {
  it("has nine gyms numbered 1–9 with unique ids, bosses and badges", () => {
    expect(GYMS.map((g) => g.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const key of ["id", "name", "badge"] as const) expect(new Set(GYMS.map((g) => g[key])).size).toBe(9);
    expect(new Set(GYMS.map((g) => g.boss.name)).size).toBe(9);
    for (const g of GYMS) {
      expect(MOVE_TYPES).toContain(g.type);
      expect(g.topics.length).toBeGreaterThan(0);
      for (const c of g.ramp) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("gym progression", () => {
  it("opens only gym 1 on a fresh save", () => {
    expect(GYMS.map((g) => gymState(g, []))).toEqual(["open", ...Array(8).fill("locked")]);
    expect(nextGym([])?.id).toBe("basics");
  });

  it("opens the next gym as each badge is earned, and finishes after nine", () => {
    let badges: string[] = [];
    for (const g of GYMS) {
      expect(nextGym(badges)?.id).toBe(g.id);
      badges = earnBadge(badges, g.id);
      expect(gymState(g, badges)).toBe("cleared");
    }
    expect(nextGym(badges)).toBeNull();
  });

  it("earnBadge is idempotent, keeps map order, and rejects unknown gyms", () => {
    expect(earnBadge(["processes"], "basics")).toEqual(["basics", "processes"]);
    expect(earnBadge(["basics"], "basics")).toEqual(["basics"]);
    expect(() => earnBadge([], "nope")).toThrow();
  });

  it("a gym with a gap before it stays locked", () => {
    const sync = GYMS.find((g) => g.id === "sync")!;
    expect(gymState(sync, ["basics", "scheduling"])).toBe("locked");
  });
});

describe("save", () => {
  it("parses missing, broken and partial saves safely", () => {
    expect(parseSave(null)).toEqual(DEFAULT_SAVE);
    expect(parseSave("{not json")).toEqual(DEFAULT_SAVE);
    expect(parseSave(JSON.stringify({ badges: ["basics", 3], lastGym: 5 }))).toEqual({ ...DEFAULT_SAVE, badges: ["basics"] });
  });

  it("keeps a chosen starter and drops an unknown one", () => {
    expect(parseSave(JSON.stringify({ starter: "ramster" })).starter).toBe("ramster");
    expect(parseSave(JSON.stringify({ starter: "pikachu" })).starter).toBeNull();
    expect(parseSave(JSON.stringify({ starter: 3 })).starter).toBeNull();
    expect(DEFAULT_SAVE.starter).toBeNull();
  });
});

describe("region map art", () => {
  it("is the declared size, and every gym building sits fully on the map", () => {
    expect(OVERWORLD.idle[0].length).toBe(MAP_H);
    expect(OVERWORLD.idle[0][0].length).toBe(MAP_W);
    expect(GYM_SPOTS).toHaveLength(GYMS.length);
    for (const [x, y] of GYM_SPOTS) {
      expect(x - GYM_W / 2 - 1).toBeGreaterThanOrEqual(0);
      expect(x + GYM_W / 2 + 1).toBeLessThanOrEqual(MAP_W);
      expect(y - GYM_H - 1).toBeGreaterThanOrEqual(0);
      expect(y + 5).toBeLessThanOrEqual(MAP_H);
    }
  });

  it("gym buildings don't overlap each other", () => {
    GYM_SPOTS.forEach(([ax, ay], i) =>
      GYM_SPOTS.slice(i + 1).forEach(([bx, by]) => expect(Math.abs(ax - bx) >= GYM_W + 2 || Math.abs(ay - by) >= GYM_H + 4).toBe(true)),
    );
  });

  it("has a filled, outlined badge per gym", () => {
    expect(BADGES).toHaveLength(9);
    for (const b of BADGES) {
      const filled = b.idle[0].join("").replace(/\./g, "").length;
      expect(filled).toBeGreaterThan(60);
    }
  });
});
