/** Move types, one per curriculum strand. The type chart arrives with roadmap 1.2. */
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
