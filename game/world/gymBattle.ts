import type { Gym } from "@/content/gyms";
import type { Fighter } from "@/game/engine/battle";

/**
 * A gym boss's battle stats. Bosses get tougher along the map to keep pace
 * with a partner that levels up on boss wins: from Lv5 up to two levels past
 * the "par" level for a gym (the level reached by beating each earlier boss
 * once), three right answers never take the boss's HP, while a perfect run or
 * one early slip always does. The boss's counter-attack (10 + 1.5 × level,
 * doubled when super effective) never one-shots any full-HP starter.
 */
export function bossFighter(gym: Gym): Fighter {
  const hp = 150 + 10 * gym.n;
  return { name: gym.boss.name, level: 5 + gym.n, hp, maxHp: hp, type: gym.type };
}

/** Trainer battles to win in a gym before its boss takes the challenge. */
export const TRAINER_BATTLES = 2;
/** Questions in a trainer battle (a boss battle has six). */
export const TRAINER_TURNS = 4;

/**
 * The gym trainer's stats for battle `round` (1 or 2; rematches use round 2).
 * A warm-up before the boss: at Lv5–7, four questions from the gym's pool, a
 * perfect run or one slip anywhere always wins and two right answers never
 * do. The trainer's counter (10 + 1.5 × level) is about a quarter of a fresh
 * starter's HP.
 */
export function trainerFighter(gym: Gym, round: number): Fighter {
  if (!gym.trainer) throw new Error(`${gym.id} has no trainer`);
  const r = Math.min(Math.max(1, Math.floor(round)), TRAINER_BATTLES);
  const hp = 90 + 10 * r;
  return { name: gym.trainer.name, level: 2 + gym.n + r - 1, hp, maxHp: hp, type: gym.type };
}
