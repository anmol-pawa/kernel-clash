import type { Gym } from "@/content/gyms";
import type { Fighter } from "@/game/engine/battle";

/**
 * A gym boss's battle stats. Bosses get tougher along the map but stay
 * beatable by the starter until XP and levels arrive (roadmap 1.3): HP needs
 * four of the six questions right (with streak bonus) to win, and the
 * boss's counter-attack ( 10 + 1.5 × level ) never one-shots a full-HP starter.
 */
export function bossFighter(gym: Gym): Fighter {
  const hp = 120 + 5 * gym.n;
  return { name: gym.boss.name, level: 5 + gym.n, hp, maxHp: hp, type: gym.type };
}
