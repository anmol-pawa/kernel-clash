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
 * A warm-up before the boss: two levels under it, four questions from the
 * gym's pool, and a partner from the gym's par level to two levels past it
 * wins with a perfect run or one slip anywhere but never with two right
 * answers (HP 100/110 in the first gym, +5 per gym after). The trainer's
 * counter (10 + 1.5 × level) is under a third of a par partner's HP, or
 * under 60% when it's super effective, so one slip never decides the battle.
 * Trainers stop growing after the third gym (Lv5/Lv6, HP 110/120): a
 * super-effective counter against Bytling would otherwise outgrow its HP.
 * Their HP resumes growing at the seventh gym (+10 past the sixth gym, then flat):
 * partners there out-level the capped HP and would win with two right answers.
 */
export function trainerFighter(gym: Gym, round: number): Fighter {
  if (!gym.trainer) throw new Error(`${gym.id} has no trainer`);
  const r = Math.min(Math.max(1, Math.floor(round)), TRAINER_BATTLES);
  const n = Math.min(gym.n, 3);
  const hp = 90 + 10 * r + 5 * (n - 1) + 10 * Math.min(1, Math.max(0, gym.n - 6));
  return { name: gym.trainer.name, level: 2 + n + r - 1, hp, maxHp: hp, type: gym.type };
}
