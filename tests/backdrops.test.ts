import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { SCENERY } from "@/game/sprites";
import { BACKDROPS, CLOCKTOWER, FORK_GROVE, GRIDLOCK_GYM, HEAP_HARBOR, KERNEL_CITY, MUTEX_MARSH, backdropFor, type Backdrop } from "@/game/sprites/scenery";

const ALL: Backdrop[] = [...new Set(Object.values(BACKDROPS))];
const size = (s: { idle: string[][] }) => ({ w: s.idle[0][0].length, h: s.idle[0].length });

/** The creatures' platforms in stage coordinates (see HOME in game/render/stage.ts). */
const PLATFORMS = [
  { x: 250, y: 510, scale: 4 },
  { x: 700, y: 300, scale: 3 },
];

describe("battle backdrops", () => {
  it("every gym has a backdrop, and only gyms are keyed", () => {
    for (const g of GYMS) expect(BACKDROPS[g.id], g.id).toBeDefined();
    expect(Object.keys(BACKDROPS).sort()).toEqual(GYMS.map((g) => g.id).sort());
  });

  it("battles with no gym (wild, review) and unknown ids use kernel city", () => {
    expect(backdropFor()).toBe(KERNEL_CITY);
    expect(backdropFor("nowhere")).toBe(KERNEL_CITY);
    expect(backdropFor("basics")).toBe(KERNEL_CITY);
  });

  it("Fork Grove has its own scene: tree line, root platform, sky, fireflies and props", () => {
    expect(backdropFor("processes")).toBe(FORK_GROVE);
    expect(FORK_GROVE.horizon).not.toBe(KERNEL_CITY.horizon);
    expect(FORK_GROVE.platform).not.toBe(KERNEL_CITY.platform);
    expect(FORK_GROVE.sky).not.toEqual(KERNEL_CITY.sky);
    expect(FORK_GROVE.specks.kind).toBe("fireflies");
    expect(FORK_GROVE.props.length).toBeGreaterThan(5);
  });

  it("the Clocktower has its own scene: clock skyline, cog platform, dusk sky, stars and props", () => {
    expect(backdropFor("scheduling")).toBe(CLOCKTOWER);
    for (const other of [KERNEL_CITY, FORK_GROVE]) {
      expect(CLOCKTOWER.horizon).not.toBe(other.horizon);
      expect(CLOCKTOWER.platform).not.toBe(other.platform);
      expect(CLOCKTOWER.sky).not.toEqual(other.sky);
    }
    expect(CLOCKTOWER.specks.kind).toBe("stars");
    expect(new Set(CLOCKTOWER.props.map((p) => p.sheet)).size).toBeGreaterThanOrEqual(4);
  });

  it("Mutex Marsh has its own scene: marsh bank, lily-pad platform, night sky, fireflies and props", () => {
    expect(backdropFor("sync")).toBe(MUTEX_MARSH);
    for (const other of [KERNEL_CITY, FORK_GROVE, CLOCKTOWER]) {
      expect(MUTEX_MARSH.horizon).not.toBe(other.horizon);
      expect(MUTEX_MARSH.platform).not.toBe(other.platform);
      expect(MUTEX_MARSH.sky).not.toEqual(other.sky);
    }
    expect(MUTEX_MARSH.specks.kind).toBe("fireflies");
    expect(new Set(MUTEX_MARSH.props.map((p) => p.sheet)).size).toBeGreaterThanOrEqual(4);
  });

  it("Gridlock Gym has its own scene: dusk street, intersection platform, stars and props", () => {
    expect(backdropFor("deadlocks")).toBe(GRIDLOCK_GYM);
    for (const other of [KERNEL_CITY, FORK_GROVE, CLOCKTOWER, MUTEX_MARSH]) {
      expect(GRIDLOCK_GYM.horizon).not.toBe(other.horizon);
      expect(GRIDLOCK_GYM.platform).not.toBe(other.platform);
      expect(GRIDLOCK_GYM.sky).not.toEqual(other.sky);
    }
    expect(new Set(GRIDLOCK_GYM.props.map((p) => p.sheet)).size).toBeGreaterThanOrEqual(4);
  });

  it("Heap Harbor has its own scene: dusk quay, pier platform, stars and props", () => {
    expect(backdropFor("memory")).toBe(HEAP_HARBOR);
    for (const other of [KERNEL_CITY, FORK_GROVE, CLOCKTOWER, MUTEX_MARSH, GRIDLOCK_GYM]) {
      expect(HEAP_HARBOR.horizon).not.toBe(other.horizon);
      expect(HEAP_HARBOR.platform).not.toBe(other.platform);
      expect(HEAP_HARBOR.sky).not.toEqual(other.sky);
    }
    expect(new Set(HEAP_HARBOR.props.map((p) => p.sheet)).size).toBeGreaterThanOrEqual(4);
  });

  for (const b of ALL)
    it(`${b.name}: valid colours, tiling horizon, sheets reviewable in /dev/sprites`, () => {
      expect(b.sky.length).toBeGreaterThanOrEqual(4);
      for (const c of [...b.sky, b.specks.color, ...Object.values(b.ground)]) expect(Number.isInteger(c) && c >= 0 && c <= 0xffffff).toBe(true);
      // the stage tiles the horizon every 480px at 3×, so it must be 160 wide
      expect(size(b.horizon).w).toBe(160);
      for (const s of [b.horizon, b.platform, ...b.props.map((p) => p.sheet)]) expect(SCENERY, s.name).toContain(s);
    });

  for (const b of ALL)
    it(`${b.name}: props stand on the ground and stay clear of both platforms`, () => {
      for (const p of b.props) {
        const { w, h } = size(p.sheet);
        expect(p.y, p.sheet.name).toBeGreaterThan(232);
        expect(Number.isInteger(p.scale) && p.scale > 0).toBe(true);
        const box = { l: p.x - (w * p.scale) / 2, r: p.x + (w * p.scale) / 2, t: p.y - h * p.scale, b: p.y };
        for (const q of PLATFORMS) {
          const pw = (size(b.platform).w * q.scale) / 2;
          const ph = size(b.platform).h * q.scale;
          const overlaps = box.l < q.x + pw && box.r > q.x - pw && box.t < q.y && box.b > q.y - ph;
          expect(overlaps, `${p.sheet.name} at ${p.x},${p.y}`).toBe(false);
        }
      }
    });
});
