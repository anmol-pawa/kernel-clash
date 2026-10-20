import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { POOLS, gymBattleQuestions } from "@/content/pools";
import { START_XP, STARTERS, starterFighter } from "@/content/starters";
import { initialState, reducer, type Fighter } from "@/game/engine/battle";
import { counterDamage } from "@/game/engine/damage";
import { effectiveness } from "@/game/engine/types";
import { levelFor, xpForLevel, xpYield } from "@/game/engine/xp";
import { TRAINER_BATTLES, TRAINER_TURNS, bossFighter, trainerFighter } from "@/game/world/gymBattle";
import { DEFAULT_SAVE, parseSave, trainerWins } from "@/lib/save";

const T = 1_700_000_000_000;
const trainerGyms = GYMS.filter((g) => g.trainer);
/** XP a partner has on reaching gym n: the start plus one win over each earlier boss (a gym is locked until the one before is cleared). */
const parXp = (n: number) => START_XP + GYMS.slice(0, n - 1).reduce((t, g) => t + xpYield(bossFighter(g).level, true), 0);

/** Play a trainer battle on these questions with a right/wrong pattern. */
function play(gymId: string, round: number, qs: { move: { power: number; type: string } }[], pattern: boolean[], player: Fighter) {
  const gym = GYMS.find((g) => g.id === gymId)!;
  let s = reducer(initialState(player, trainerFighter(gym, round), qs.length), { type: "ready" });
  for (let i = 0; s.phase === "ask"; i++) {
    s = reducer(s, { type: "answer", correct: pattern[i] ?? false, power: qs[i].move.power, seconds: 30, moveType: qs[i].move.type as never, counterType: gym.type });
    s = reducer(s, { type: "next" });
  }
  return s;
}

describe("trainer fighters", () => {
  it("Forkupine is the Fork Grove Gym's trainer: process type, Lv4 then Lv5, 5 HP sturdier than Syscallow", () => {
    const gym = GYMS.find((g) => g.id === "processes")!;
    expect(trainerFighter(gym, 1)).toEqual({ name: "Forkupine", level: 4, hp: 105, maxHp: 105, type: "process" });
    expect(trainerFighter(gym, 2)).toEqual({ name: "Forkupine", level: 5, hp: 115, maxHp: 115, type: "process" });
  });

  it("Syscallow is the Bootstrap Gym's trainer: io type, Lv3 then Lv4, weaker than the boss", () => {
    const gym = GYMS[0];
    expect(trainerFighter(gym, 1)).toEqual({ name: "Syscallow", level: 3, hp: 100, maxHp: 100, type: "io" });
    expect(trainerFighter(gym, 2)).toEqual({ name: "Syscallow", level: 4, hp: 110, maxHp: 110, type: "io" });
    // rematches (and junk rounds) clamp to the battles that exist
    expect(trainerFighter(gym, 3)).toEqual(trainerFighter(gym, 2));
    expect(trainerFighter(gym, 0)).toEqual(trainerFighter(gym, 1));
    for (const g of trainerGyms)
      for (let r = 1; r <= TRAINER_BATTLES; r++) {
        expect(trainerFighter(g, r).level).toBeLessThan(bossFighter(g).level);
        expect(trainerFighter(g, r).maxHp).toBeLessThan(bossFighter(g).maxHp);
      }
  });

  it("gyms without a trainer have no trainer fighter", () => {
    expect(() => trainerFighter(GYMS.find((g) => !g.trainer)!, 1)).toThrow();
  });

  it("every gym with a trainer has a question pool to draw from", () => {
    for (const g of trainerGyms) expect(POOLS[g.id], g.id).toBeDefined();
  });

  it("every trainer has its own retreat and hold-on lines (Forkupine doesn't fly)", () => {
    for (const g of trainerGyms) {
      const { retreats, holdsOn } = g.trainer!;
      expect(retreats, g.id).toMatch(/^[a-z][a-z ]+[a-z]$/);
      expect(holdsOn, g.id).toMatch(/^[a-z][a-z ]+[a-z]$/);
    }
    expect(new Set(trainerGyms.map((g) => g.trainer!.retreats)).size).toBe(trainerGyms.length);
    expect(new Set(trainerGyms.map((g) => g.trainer!.holdsOn)).size).toBe(trainerGyms.length);
    expect(GYMS.find((g) => g.id === "processes")!.trainer).toMatchObject({ retreats: "curls up under its quills", holdsOn: "is still bristling" });
  });
});

describe("trainer battle questions", () => {
  it("asks TRAINER_TURNS questions from the gym's pool, due cards first", () => {
    const deck = { "num-basics-mbr": { box: 1, due: T - 1 } };
    for (let s = 0; s < 20; s++) {
      const qs = gymBattleQuestions("basics", s, deck, T, TRAINER_TURNS);
      expect(qs).toHaveLength(TRAINER_TURNS);
      expect(qs[0].id).toBe("num-basics-mbr");
      expect(new Set(qs.map((q) => q.id)).size).toBe(TRAINER_TURNS);
    }
    // deterministic per seed
    expect(gymBattleQuestions("basics", 7, {}, T, TRAINER_TURNS).map((q) => q.id)).toEqual(gymBattleQuestions("basics", 7, {}, T, TRAINER_TURNS).map((q) => q.id));
  });
});

describe("trainer balance for any draw", () => {
  for (const g of trainerGyms) {
    const pool = POOLS[g.id];
    const all = [...pool.authored, ...pool.generators.map((x) => x.make(1))].sort((a, b) => a.move.power - b.move.power);
    const weakest = all.slice(0, TRAINER_TURNS);
    const strongest = all.slice(-TRAINER_TURNS);
    // a partner at the gym's par level, and one that has ground two levels past the boss's first win
    const par = parXp(g.n);
    const players = STARTERS.flatMap((s) => [starterFighter(s, par), starterFighter(s, xpForLevel(levelFor(par + xpYield(bossFighter(g).level, true)) + 1))]);

    it(`${g.id}: a perfect run and one slip anywhere always win`, () => {
      for (let r = 1; r <= TRAINER_BATTLES; r++)
        for (const p of players) {
          expect(play(g.id, r, weakest, weakest.map(() => true), p).phase).toBe("victory");
          for (let slip = 0; slip < TRAINER_TURNS; slip++) expect(play(g.id, r, weakest, weakest.map((_, i) => i !== slip), p).phase, `${p.name} Lv${p.level} r${r} slip ${slip}`).toBe("victory");
        }
    });

    it(`${g.id}: two right answers never win`, () => {
      for (let r = 1; r <= TRAINER_BATTLES; r++)
        for (const p of players) {
          expect(play(g.id, r, strongest, [true, true, false, false], p).phase, `${p.name} Lv${p.level} r${r}`).toBe("defeat");
          expect(play(g.id, r, strongest, [false, false, true, true], p).phase).toBe("defeat");
        }
    });

    it(`${g.id}: the trainer's counter is under a third of a par partner's HP (half when super effective)`, () => {
      for (let r = 1; r <= TRAINER_BATTLES; r++)
        for (const s of STARTERS) {
          const effect = effectiveness(g.type, s.type);
          expect((effect > 1 ? 2 : 3) * counterDamage(trainerFighter(g, r).level, effect), `${s.name} r${r}`).toBeLessThan(starterFighter(s, par).maxHp);
        }
    });

    it(`${g.id}: both trainer wins don't push a par partner past the boss's balance range`, () => {
      const xp = par + [1, 2].reduce((t, r) => t + xpYield(trainerFighter(g, r).level), 0);
      expect(levelFor(xp)).toBeLessThanOrEqual(levelFor(par) + 2);
    });
  }
});

describe("saved trainer wins", () => {
  it("counts wins per gym with a trainer, clamped, dropping junk", () => {
    expect(DEFAULT_SAVE.trainers).toEqual({});
    const s = parseSave(JSON.stringify({ trainers: { basics: 5, processes: 1, scheduling: 1, nowhere: 1, x: "2" } }));
    expect(s.trainers).toEqual({ basics: TRAINER_BATTLES, processes: 1 });
    expect(parseSave(JSON.stringify({ trainers: { basics: 1.7 } })).trainers).toEqual({ basics: 1 });
    expect(parseSave(JSON.stringify({ trainers: { basics: 0 } })).trainers).toEqual({});
    expect(parseSave(JSON.stringify({ trainers: [1] })).trainers).toEqual({});
    expect(trainerWins(parseSave(null), "basics")).toBe(0);
    expect(trainerWins(parseSave(JSON.stringify({ trainers: { basics: 1 } })), "basics")).toBe(1);
  });
});
