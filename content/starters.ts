import type { Fighter } from "@/game/engine/battle";
import type { MoveType } from "@/game/engine/types";
import { levelFor, xpForLevel } from "@/game/engine/xp";

/**
 * The three starters. Their types form a closed loop in the type chart, so
 * every starter beats one of the others and loses to the third:
 * process > memory (thrashing), memory > storage (the page cache) and
 * storage > process (swapping).
 */
export interface Starter {
  /** creature art id in `CREATURES` */
  id: string;
  name: string;
  type: MoveType;
  blurb: string;
  /** max HP at Lv5. Every gym boss's counter, even a super-effective one, must leave a full-HP starter standing. */
  hp: number;
  /** max HP gained per level-up */
  hpGrowth: number;
  /** the form it evolves into at the evolution milestone */
  evolution: Evolution;
}

/** A starter's evolved form: same type, new art, name and blurb. */
export interface Evolution {
  /** creature art id in `CREATURES` */
  id: string;
  name: string;
  blurb: string;
}

/** Starters evolve when they win this gym's badge (the third gym, scheduling). */
export const EVOLVE_GYM = "scheduling";

export const STARTERS: Starter[] = [
  { id: "bytling", name: "Bytling", type: "process", blurb: "A quick little process-sprite. Its gem is a program counter that never stops ticking.", hp: 60, hpGrowth: 3,
    evolution: { id: "threadrake", name: "Threadrake", blurb: "A process grown into a drake. Its tail splits into three threads that share one address space, so it can work on three things at once." } },
  { id: "ramster", name: "Ramster", type: "memory", blurb: "Stuffs its cheek pouches like a cache, so the things it needs most are always close at hand.", hp: 68, hpGrowth: 4,
    evolution: { id: "gigahoard", name: "Gigahoard", blurb: "Hugs two RAM sticks for dual-channel bandwidth, and its pouches hold a two-level cache: a small, fast L1 inside a bigger, slower L2." } },
  { id: "spinnail", name: "Spinnail", type: "storage", blurb: "Slow to seek but never forgets: everything it learns is written to the platter on its back.", hp: 64, hpGrowth: 3,
    evolution: { id: "raidsnail", name: "Raidsnail", blurb: "Its shell is a mirrored pair of platters (RAID 1): every block is written to both, so it survives losing either disk." } },
];

export const STARTER_LEVEL = 5;
/** A new partner starts part-way through Lv5, so its first win levels it up. */
export const START_XP = xpForLevel(STARTER_LEVEL) + 70;

/** The chosen starter, or Bytling for a save that hasn't chosen yet. */
export const starterById = (id: string | null | undefined): Starter => STARTERS.find((s) => s.id === id) ?? STARTERS[0];

/** Level for a starter's total XP (never below the starting level). */
export const starterLevel = (xp: number) => Math.max(STARTER_LEVEL, levelFor(xp));

/** Max HP at `level`: base HP plus the starter's growth for every level past Lv5. */
export const starterMaxHp = (s: Starter, level: number) => s.hp + s.hpGrowth * Math.max(0, level - STARTER_LEVEL);

/** The starter as a battle fighter at full HP, at the level its XP has reached. */
export function starterFighter(s: Starter, xp = START_XP): Fighter {
  const level = starterLevel(xp);
  const hp = starterMaxHp(s, level);
  return { name: s.name, level, hp, maxHp: hp, type: s.type };
}

export interface LevelUp {
  level: number;
  /** max HP before and after */
  from: number;
  to: number;
}

/** Every level gained going from `before` to `after` total XP, with the max HP growth at each. */
export function levelUps(s: Starter, before: number, after: number): LevelUp[] {
  const out: LevelUp[] = [];
  for (let l = starterLevel(before) + 1; l <= starterLevel(after); l++) out.push({ level: l, from: starterMaxHp(s, l - 1), to: starterMaxHp(s, l) });
  return out;
}
