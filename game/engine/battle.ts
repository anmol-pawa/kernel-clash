/**
 * The battle state machine: a pure reducer with no rendering code.
 *
 *   intro → ask → (answer: hit | counter) → ask … → victory | defeat
 *
 * Each question is one turn: a right answer lands the player's move, a wrong
 * one lets the foe counter. The foe faints at 0 HP; running out of questions
 * with the foe still standing is a loss.
 */
import { counterDamage, moveDamage } from "./damage";
import { effectiveness, type Effect, type MoveType } from "./types";

export type Phase = "intro" | "ask" | "resolve" | "victory" | "defeat";

export interface Fighter {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  /** its type on the type chart (untyped creatures take neutral damage) */
  type?: MoveType;
}

export interface BattleStats {
  answered: number;
  correct: number;
  crits: number;
  bestStreak: number;
  damageDealt: number;
  damageTaken: number;
}

export type Outcome = { kind: "hit"; damage: number; crit: boolean; effect: Effect } | { kind: "counter"; damage: number; effect: Effect };

export interface BattleState {
  phase: Phase;
  turn: number;
  questions: number;
  player: Fighter;
  foe: Fighter;
  streak: number;
  last?: Outcome;
  stats: BattleStats;
}

export type Action =
  | { type: "start"; player: Fighter; foe: Fighter; questions: number }
  | { type: "ready" }
  /** `moveType` is the player's move; `counterType` the foe's counter-attack */
  | { type: "answer"; correct: boolean; power: number; seconds: number; moveType?: MoveType; counterType?: MoveType }
  | { type: "next" };

export const emptyStats = (): BattleStats => ({ answered: 0, correct: 0, crits: 0, bestStreak: 0, damageDealt: 0, damageTaken: 0 });

export function initialState(player: Fighter, foe: Fighter, questions: number): BattleState {
  return { phase: "intro", turn: 0, questions, player, foe, streak: 0, stats: emptyStats() };
}

export function reducer(s: BattleState, a: Action): BattleState {
  switch (a.type) {
    case "start":
      return initialState(a.player, a.foe, a.questions);
    case "ready":
      return s.phase === "intro" ? { ...s, phase: "ask" } : s;
    case "answer": {
      if (s.phase !== "ask") return s;
      const stats = { ...s.stats, answered: s.stats.answered + 1 };
      if (a.correct) {
        const effect = a.moveType ? effectiveness(a.moveType, s.foe.type) : 1;
        const r = moveDamage({ power: a.power, level: s.player.level, streak: s.streak, seconds: a.seconds, effect });
        const damage = Math.min(r.damage, s.foe.hp);
        const streak = s.streak + 1;
        return {
          ...s,
          phase: "resolve",
          foe: { ...s.foe, hp: s.foe.hp - damage },
          streak,
          last: { kind: "hit", damage, crit: r.crit, effect },
          stats: { ...stats, correct: stats.correct + 1, crits: stats.crits + (r.crit ? 1 : 0), bestStreak: Math.max(stats.bestStreak, streak), damageDealt: stats.damageDealt + damage },
        };
      }
      const counterType = a.counterType ?? s.foe.type;
      const effect = counterType ? effectiveness(counterType, s.player.type) : 1;
      const damage = Math.min(counterDamage(s.foe.level, effect), s.player.hp);
      return {
        ...s,
        phase: "resolve",
        player: { ...s.player, hp: s.player.hp - damage },
        streak: 0,
        last: { kind: "counter", damage, effect },
        stats: { ...stats, damageTaken: stats.damageTaken + damage },
      };
    }
    case "next": {
      if (s.phase !== "resolve") return s;
      if (s.foe.hp <= 0) return { ...s, phase: "victory" };
      if (s.player.hp <= 0) return { ...s, phase: "defeat" };
      const turn = s.turn + 1;
      if (turn >= s.questions) return { ...s, turn, phase: "defeat" };
      return { ...s, turn, phase: "ask", last: undefined };
    }
  }
}
