/**
 * The daily challenge, as pure functions: which day it is, the seed that day
 * gives, and how a finished challenge moves the streak. The screen only asks
 * the questions.
 */
export const DAILY_LENGTH = 5;

export interface DailyState {
  /** the day (YYYY-MM-DD) of the last finished challenge */
  last: string | null;
  /** the right answers out of DAILY_LENGTH on that day */
  score: number;
  /** consecutive days finished, as of `last` */
  streak: number;
  /** the longest streak so far */
  best: number;
}

export const NO_DAILY: DailyState = { last: null, score: 0, streak: 0, best: 0 };

const pad = (n: number) => String(n).padStart(2, "0");

/** The player's calendar day, as YYYY-MM-DD. */
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const isDayKey = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** The day before `key`. */
export function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The same questions for everyone on the same day: an FNV-1a hash of the key. */
export const daySeed = (key: string): number => [...key].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

export const playedToday = (s: DailyState, today: string) => s.last === today;

/** The streak to show on `today`: alive if the last challenge was today or yesterday, otherwise broken. */
export const liveStreak = (s: DailyState, today: string): number => (s.last === today || s.last === previousDay(today) ? s.streak : 0);

/** The state after finishing `today`'s challenge with `score` right. A second finish on the same day changes nothing. */
export function finishDaily(s: DailyState, today: string, score: number): DailyState {
  if (s.last === today) return s;
  const streak = (s.last === previousDay(today) ? s.streak : 0) + 1;
  return { last: today, score: Math.max(0, Math.min(DAILY_LENGTH, Math.floor(score))), streak, best: Math.max(s.best, streak) };
}
