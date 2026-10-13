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
}

export const STARTERS: Starter[] = [
  { id: "bytling", name: "Bytling", type: "process", blurb: "A quick little process-sprite. Its gem is a program counter that never stops ticking." },
  { id: "ramster", name: "Ramster", type: "memory", blurb: "Stuffs its cheek pouches like a cache, so the things it needs most are always close at hand." },
  { id: "spinnail", name: "Spinnail", type: "storage", blurb: "Slow to seek but never forgets: everything it learns is written to the platter on its back." },
];
