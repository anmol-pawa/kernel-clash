import type { Fighter } from "@/game/engine/battle";
import type { MoveType } from "@/game/engine/types";

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
}

export const STARTERS: Starter[] = [
  { id: "bytling", name: "Bytling", type: "process", blurb: "A quick little process-sprite. Its gem is a program counter that never stops ticking.", hp: 60 },
  { id: "ramster", name: "Ramster", type: "memory", blurb: "Stuffs its cheek pouches like a cache, so the things it needs most are always close at hand.", hp: 68 },
  { id: "spinnail", name: "Spinnail", type: "storage", blurb: "Slow to seek but never forgets: everything it learns is written to the platter on its back.", hp: 64 },
];

export const STARTER_LEVEL = 5;

/** The chosen starter, or Bytling for a save that hasn't chosen yet. */
export const starterById = (id: string | null | undefined): Starter => STARTERS.find((s) => s.id === id) ?? STARTERS[0];

/** The starter as a battle fighter at full HP. */
export function starterFighter(s: Starter): Fighter {
  return { name: s.name, level: STARTER_LEVEL, hp: s.hp, maxHp: s.hp, type: s.type };
}
