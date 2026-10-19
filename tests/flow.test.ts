import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { lessonsOf } from "@/content/lessons";
import { TRAINER_BATTLES } from "@/game/world/gymBattle";
import { gymFlow } from "@/game/world/progress";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

const boot = GYMS[0];
const bootLessons = lessonsOf(boot.id).map((l) => l.id);
const at = (over: Partial<typeof DEFAULT_SAVE>) => ({ ...DEFAULT_SAVE, ...over });

describe("gym flow: lessons → trainers → boss", () => {
  it("a fresh save starts the Bootstrap Gym on its lessons, with the boss locked", () => {
    const f = gymFlow(boot, DEFAULT_SAVE);
    expect(f).toEqual({ state: "open", lessons: { done: 0, total: bootLessons.length }, trainers: { won: 0, total: TRAINER_BATTLES }, bossReady: false, step: "lessons" });
    expect(bootLessons.length).toBe(5);
  });

  it("lessons are recommended, not required: trainer wins alone open the boss", () => {
    expect(gymFlow(boot, at({ trainers: { [boot.id]: 1 } })).bossReady).toBe(false);
    const f = gymFlow(boot, at({ trainers: { [boot.id]: 2 } }));
    expect(f.bossReady).toBe(true);
    expect(f.step).toBe("lessons");
  });

  it("steps through trainers then boss once the lessons are done", () => {
    const lessons = bootLessons;
    expect(gymFlow(boot, at({ lessons })).step).toBe("trainers");
    expect(gymFlow(boot, at({ lessons, trainers: { [boot.id]: 1 } })).step).toBe("trainers");
    const f = gymFlow(boot, at({ lessons, trainers: { [boot.id]: 2 } }));
    expect(f.step).toBe("boss");
    expect(f.trainers).toEqual({ won: 2, total: 2 });
  });

  it("a cleared gym is always ready for a rematch, even from a save made before trainer battles", () => {
    const f = gymFlow(boot, at({ badges: [boot.id] }));
    expect(f).toMatchObject({ state: "cleared", step: "cleared", bossReady: true, trainers: { won: 0, total: 2 } });
  });

  it("a locked gym's boss is never ready, whatever the trainer count", () => {
    const f = gymFlow(GYMS[1], at({ trainers: { [GYMS[1].id]: 2 } }));
    expect(f).toMatchObject({ state: "locked", step: "locked", bossReady: false });
  });

  it("a gym with no trainer and no lessons goes straight to its boss", () => {
    const g = GYMS.find((x) => !x.trainer && lessonsOf(x.id).length === 0)!;
    const prior = GYMS.filter((x) => x.n < g.n).map((x) => x.id);
    expect(gymFlow(g, at({ badges: prior }))).toEqual({ state: "open", lessons: { done: 0, total: 0 }, trainers: { won: 0, total: 0 }, bossReady: true, step: "boss" });
  });

  it("clamps out-of-range trainer counts and ignores lessons from other gyms", () => {
    expect(gymFlow(boot, at({ trainers: { [boot.id]: 9 } })).trainers.won).toBe(2);
    expect(gymFlow(boot, at({ trainers: { [boot.id]: -3 } })).trainers.won).toBe(0);
    expect(gymFlow(boot, at({ lessons: ["not-a-lesson"] })).lessons.done).toBe(0);
  });

  it("follows a saved game through the whole gym", () => {
    const s = parseSave(JSON.stringify({ ...DEFAULT_SAVE, starter: DEFAULT_SAVE.starter, lessons: bootLessons.slice(0, 3), trainers: { [boot.id]: 1 } }));
    const f = gymFlow(boot, s);
    expect(f).toMatchObject({ lessons: { done: 3, total: 5 }, trainers: { won: 1, total: 2 }, bossReady: false, step: "lessons" });
  });
});
