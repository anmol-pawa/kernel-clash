/** Move types, one per curriculum strand. */
export const MOVE_TYPES = ["process", "scheduler", "sync", "memory", "storage", "io"] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

/** Signature colour per type, used by move effects and type badges. */
export const TYPE_COLOR: Record<MoveType, number> = {
  process: 0x5eead4,
  scheduler: 0xfbbf24,
  sync: 0xf472b6,
  memory: 0x818cf8,
  storage: 0xa3e635,
  io: 0xfb923c,
};

/**
 * The type chart. Each entry is a super-effective (2×) matchup, and the
 * reason it holds is a real OS fact, shown after the hit. The reverse of every
 * matchup is resisted (½×): the defender's strength is the attacker's
 * weakness. Everything else is neutral (1×).
 */
export const SUPER_EFFECTIVE: { attack: MoveType; defend: MoveType; why: string }[] = [
  { attack: "io", defend: "scheduler", why: "A hardware interrupt takes the CPU from whatever the scheduler picked." },
  { attack: "scheduler", defend: "process", why: "A preemptive scheduler can take the CPU from a running process at any time." },
  { attack: "scheduler", defend: "sync", why: "Preempting a thread that holds a lock stalls every thread waiting on it." },
  { attack: "process", defend: "memory", why: "Every process needs its own frames: too many processes and memory runs out (thrashing)." },
  { attack: "memory", defend: "storage", why: "The page cache serves repeat reads from RAM without touching the disk." },
  { attack: "storage", defend: "process", why: "Swapping moves a whole process out of memory onto the disk." },
  { attack: "sync", defend: "process", why: "A lock makes racing processes wait their turn for the critical section." },
  { attack: "sync", defend: "io", why: "A semaphore lets only one request at a time use the device." },
];

export type Effect = 0.5 | 1 | 2;

/** How effective a move of type `attack` is against a creature of type `defend`. */
export function effectiveness(attack: MoveType, defend: MoveType | undefined): Effect {
  if (!defend) return 1;
  if (SUPER_EFFECTIVE.some((m) => m.attack === attack && m.defend === defend)) return 2;
  if (SUPER_EFFECTIVE.some((m) => m.attack === defend && m.defend === attack)) return 0.5;
  return 1;
}

/** The battle line for a hit's effectiveness (none when neutral). */
export function effectMessage(attack: MoveType, defend: MoveType | undefined): string | undefined {
  const e = effectiveness(attack, defend);
  if (e === 2) return "It's super effective!";
  if (e === 0.5) return "It's not very effective…";
  return undefined;
}

/** Why a matchup is super effective (undefined unless it is). */
export const superReason = (attack: MoveType, defend: MoveType | undefined) =>
  SUPER_EFFECTIVE.find((m) => m.attack === attack && m.defend === defend)?.why;
