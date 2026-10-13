import { describe, expect, it } from "vitest";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { EVOLVE_GYM, EVOLVE_HP, START_XP, STARTERS, isEvolved, levelUps, partnerForm, shouldEvolve, starterById, starterFighter, starterLevel, starterMaxHp } from "@/content/starters";
import { initialState, reducer, type BattleState, type Fighter } from "@/game/engine/battle";
import { counterDamage } from "@/game/engine/damage";
import { effectiveness } from "@/game/engine/types";
import { levelFor, xpForLevel, xpYield } from "@/game/engine/xp";
import { bossFighter } from "@/game/world/gymBattle";
import { DEFAULT_SAVE, parseSave, xpOf } from "@/lib/save";

/** XP a partner has on reaching gym `n` by beating each earlier boss once (no grinding). */
const parXp = (n: number) => START_XP + GYMS.slice(0, n - 1).reduce((t, g) => t + xpYield(bossFighter(g).level, true), 0);

function play(gymId: string, pattern: boolean[], player: Fighter): BattleState {
  const gym = GYMS.find((g) => g.id === gymId)!;
  const qs = GYM_QUESTIONS[gymId];
  let s = reducer(initialState(player, bossFighter(gym), qs.length), { type: "ready" });
  for (let i = 0; s.phase === "ask"; i++) {
    s = reducer(s, { type: "answer", correct: pattern[i] ?? false, power: qs[i].move.power, seconds: 30, moveType: qs[i].move.type, counterType: gym.type });
    s = reducer(s, { type: "next" });
  }
  return s;
}

describe("starter levels", () => {
  it("a new partner starts at Lv5 and its first boss win levels it up", () => {
    expect(starterLevel(START_XP)).toBe(5);
    expect(starterLevel(START_XP + xpYield(bossFighter(GYMS[0]).level, true))).toBe(6);
  });

  it("max HP grows by the starter's growth per level", () => {
    const ram = starterById("ramster");
    expect(starterMaxHp(ram, 5)).toBe(68);
    expect(starterMaxHp(ram, 6)).toBe(72);
    expect(starterMaxHp(ram, 10)).toBe(88);
    // never below base HP, even for a tampered save
    expect(starterMaxHp(ram, 1)).toBe(68);
    for (const s of STARTERS) expect(s.hpGrowth).toBeGreaterThan(0);
  });

  it("builds fighters at the level their XP has reached", () => {
    const byt = starterById("bytling");
    expect(starterFighter(byt)).toMatchObject({ level: 5, hp: 60, maxHp: 60 });
    expect(starterFighter(byt, xpForLevel(8))).toMatchObject({ level: 8, hp: 69, maxHp: 69, type: "process" });
    expect(starterFighter(byt, 0).level).toBe(5);
  });

  it("lists every level gained in one win, with the HP growth at each", () => {
    const spin = starterById("spinnail");
    expect(levelUps(spin, START_XP, START_XP + 10)).toEqual([]);
    expect(levelUps(spin, xpForLevel(6) - 1, xpForLevel(8))).toEqual([
      { level: 6, from: 64, to: 67 },
      { level: 7, from: 67, to: 70 },
      { level: 8, from: 70, to: 73 },
    ]);
  });

  it("par levels climb along the map from boss XP alone", () => {
    const levels = GYMS.map((g) => levelFor(parXp(g.n)));
    expect(levels[0]).toBe(5);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    expect(levels[8]).toBeGreaterThan(levels[0] + 3);
  });
});

describe("boss balance from par level to par + 2", () => {
  /** every starter at the gym's par level and two levels past it (a little grinding), evolved too past the evolution gym */
  const evolveN = GYMS.find((g) => g.id === EVOLVE_GYM)!.n;
  const atPar = (n: number) =>
    STARTERS.flatMap((s) =>
      (n > evolveN ? [false, true] : [false]).flatMap((ev) => [starterFighter(s, parXp(n), ev), starterFighter(s, xpForLevel(levelFor(parXp(n)) + 2), ev)]),
    );

  it("the par set includes evolved partners after the evolution gym", () => {
    expect(atPar(evolveN + 1).some((p) => p.name === "Threadrake")).toBe(true);
    expect(atPar(evolveN).some((p) => p.name === "Threadrake")).toBe(false);
  });

  it("a perfect run and one early slip still win", () => {
    for (const g of GYMS)
      for (const p of atPar(g.n)) {
        expect(play(g.id, [true, true, true, true, true, true], p).phase, `${p.name} Lv${p.level} ${g.id}`).toBe("victory");
        expect(play(g.id, [false, true, true, true, true, true], p).phase, `${p.name} Lv${p.level} ${g.id}`).toBe("victory");
      }
  });

  it("three right answers are still not enough", () => {
    for (const g of GYMS) for (const p of atPar(g.n)) expect(play(g.id, [true, true, true, false, false, false], p).phase, `${p.name} Lv${p.level} ${g.id}`).toBe("defeat");
  });

  it("no boss counter one-shots a full-HP starter at par", () => {
    for (const g of GYMS) for (const p of atPar(g.n)) expect(counterDamage(bossFighter(g).level, effectiveness(g.type, p.type!))).toBeLessThan(p.maxHp);
  });
});

describe("saved XP", () => {
  it("keeps per-creature totals and drops junk", () => {
    expect(DEFAULT_SAVE.xp).toEqual({});
    const s = parseSave(JSON.stringify({ xp: { ramster: 300.7, bytling: -4, spinnail: "9", x: Infinity } }));
    expect(s.xp).toEqual({ ramster: 300 });
    expect(parseSave(JSON.stringify({ xp: [1, 2] })).xp).toEqual({});
    expect(parseSave(JSON.stringify({ xp: { ramster: 1e12 } })).xp.ramster).toBe(100 ** 3);
  });

  it("reads a partner that hasn't battled as the starting XP", () => {
    const s = parseSave(JSON.stringify({ starter: "ramster", xp: { ramster: 400 } }));
    expect(xpOf(s, "ramster")).toBe(400);
    expect(xpOf(s, "spinnail")).toBe(START_XP);
  });
});

describe("evolution", () => {
  const byt = starterById("bytling");

  it("an evolved partner keeps its type and level, takes its new name and gains a little max HP", () => {
    const xp = xpForLevel(9);
    const base = starterFighter(byt, xp);
    const evo = starterFighter(byt, xp, true);
    expect(evo).toMatchObject({ name: "Threadrake", level: 9, type: "process" });
    expect(evo.maxHp - base.maxHp).toBe(EVOLVE_HP);
    expect(evo.hp).toBe(evo.maxHp);
    expect(starterMaxHp(byt, 9, true)).toBe(60 + 3 * 4 + EVOLVE_HP);
    expect(partnerForm(byt, false).name).toBe("Bytling");
    expect(partnerForm(byt, true).id).toBe("threadrake");
  });

  it("level-ups after evolving keep the bonus", () => {
    expect(levelUps(byt, xpForLevel(9), xpForLevel(10), true)).toEqual([{ level: 10, from: 72 + EVOLVE_HP, to: 75 + EVOLVE_HP }]);
  });

  it("evolves once the save holds the evolution gym's badge, and only once", () => {
    expect(shouldEvolve(byt, ["basics", "processes"], [])).toBe(false);
    expect(shouldEvolve(byt, ["basics", "processes", EVOLVE_GYM], [])).toBe(true);
    // an older save that already held the badge catches up on its next gym win
    expect(shouldEvolve(byt, ["basics", "processes", EVOLVE_GYM, "sync"], [])).toBe(true);
    expect(shouldEvolve(byt, ["basics", "processes", EVOLVE_GYM], ["bytling"])).toBe(false);
    // evolution is per starter
    expect(shouldEvolve(starterById("ramster"), [EVOLVE_GYM], ["bytling"])).toBe(true);
    expect(isEvolved(byt, ["bytling"])).toBe(true);
  });

  it("the HP bump is small: under one boss counter at the evolution gym", () => {
    const g = GYMS.find((x) => x.id === EVOLVE_GYM)!;
    expect(EVOLVE_HP).toBeGreaterThan(0);
    expect(EVOLVE_HP).toBeLessThan(counterDamage(bossFighter(g).level, 1));
  });

  it("saves the evolved flag, dropping junk and duplicates", () => {
    expect(DEFAULT_SAVE.evolved).toEqual([]);
    expect(parseSave(JSON.stringify({ evolved: ["ramster", "ramster", "threadrake", 3, "nope"] })).evolved).toEqual(["ramster"]);
    expect(parseSave(JSON.stringify({ evolved: "ramster" })).evolved).toEqual([]);
    expect(parseSave(JSON.stringify({ badges: ["basics"] })).evolved).toEqual([]);
  });
});
