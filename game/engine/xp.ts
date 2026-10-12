/**
 * Experience and levels. A "medium-fast" cubic curve: reaching level L takes
 * L³ total XP, so each level costs a little more than the last.
 */

/** Total XP needed to reach `level`. */
export const xpForLevel = (level: number) => level ** 3;

/** XP for beating a foe: scales with its level; bosses give 1.5×. */
export function xpYield(foeLevel: number, boss = false): number {
  return Math.floor((64 * foeLevel * (boss ? 1.5 : 1)) / 7);
}

/** Level reached with `total` XP (never below 1). */
export function levelFor(total: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= total) l++;
  return l;
}

/** Progress (0–1) through the current level, for the XP bar. */
export function xpProgress(total: number): number {
  const l = levelFor(total);
  const lo = xpForLevel(l);
  return (total - lo) / (xpForLevel(l + 1) - lo);
}
