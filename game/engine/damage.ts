/**
 * Damage model for question battles. A correct answer lands the move:
 *   power × level factor × streak bonus × type effectiveness, critical on a
 *   fast answer during a streak.
 * A wrong answer lets the foe counter-attack instead.
 */
export interface MoveInput {
  power: number;
  level: number;
  /** consecutive correct answers before this one */
  streak: number;
  /** seconds taken to answer */
  seconds: number;
  /** type-chart multiplier (½, 1 or 2) */
  effect?: number;
}

export interface MoveResult {
  damage: number;
  crit: boolean;
}

/** A fast answer (under 6 s) after a streak of two or more is a critical hit. */
export const isCrit = (i: MoveInput) => i.streak >= 2 && i.seconds < 6;

export function moveDamage(i: MoveInput): MoveResult {
  const levelM = 1 + (Math.max(1, i.level) - 1) * 0.05;
  const streakM = 1 + 0.1 * Math.min(i.streak, 5);
  const crit = isCrit(i);
  return { damage: Math.max(1, Math.round(i.power * levelM * streakM * (crit ? 1.5 : 1) * (i.effect ?? 1))), crit };
}

/** Damage a foe deals when the player answers wrongly. */
export const counterDamage = (foeLevel: number, effect = 1) => Math.round((10 + foeLevel * 1.5) * effect);
