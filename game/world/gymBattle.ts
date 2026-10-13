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
