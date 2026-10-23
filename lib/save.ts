"use client";
/**
 * Progress lives in localStorage (per browser). Everything is wrapped in
 * try/catch so private windows and blocked storage just mean "no saves".
 * Adapted from Query Clash's save.
 */
import { useSyncExternalStore } from "react";
import { DEX_IDS, dexEntry, dexStatus } from "@/content/kerneldex";
import { LESSON_IDS } from "@/content/lessons";
import { GYMS } from "@/content/gyms";
import { START_XP, STARTERS } from "@/content/starters";
import { NO_DAILY, finishDaily, isDayKey, DAILY_LENGTH, type DailyState } from "@/game/engine/daily";
import { parseDeck, review, type Deck } from "@/game/engine/leitner";
import { TRAINER_BATTLES } from "@/game/world/gymBattle";

export interface SaveData {
  version: 1;
  /** gym ids whose badge has been earned, in map order */
  badges: string[];
  /** gym id the player last selected on the map */
  lastGym: string | null;
  /** the starter creature id chosen on a new save (null until chosen) */
  starter: string | null;
  /** total XP per creature id (a creature that has never battled isn't listed) */
  xp: Record<string, number>;
  /** starter ids that have evolved */
  evolved: string[];
  /** Kerneldex: creature ids met in battle */
  seen: string[];
  /** Kerneldex: creature ids whose data is recorded (beaten in battle) */
  caught: string[];
  /** Leitner box: a card per question key (generated problems share their generator's card) */
  leitner: Deck;
  /** lesson ids whose quick check has been passed */
  lessons: string[];
  /** trainer battles won per gym id (0 to TRAINER_BATTLES; gyms with no wins aren't listed) */
  trainers: Record<string, number>;
  /** best mock-interview result (null until one is finished) */
  interviewBest: InterviewBest | null;
  /** daily-challenge streak and last result */
  daily: DailyState;
}

export interface InterviewBest {
  points: number;
  max: number;
  correct: number;
  total: number;
}

const KEY = "kernel-clash-save-v1";

export const DEFAULT_SAVE: SaveData = { version: 1, badges: [], lastGym: null, starter: null, xp: {}, evolved: [], seen: [], caught: [], leitner: {}, lessons: [], trainers: {}, interviewBest: null, daily: NO_DAILY };

let cache: SaveData | null = null;
const listeners = new Set<() => void>();

/** Highest XP total a save may hold (Lv100). */
const MAX_XP = 100 ** 3;

function parseXp(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[k] = Math.min(MAX_XP, Math.floor(n));
  return out;
}

/** Trainer wins for gyms that have a trainer, clamped to TRAINER_BATTLES. */
function parseTrainers(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v))
    if (typeof n === "number" && Number.isFinite(n) && n >= 1 && GYMS.some((g) => g.id === k && g.trainer)) out[k] = Math.min(TRAINER_BATTLES, Math.floor(n));
  return out;
}

function parseInterviewBest(v: unknown): InterviewBest | null {
  if (!v || typeof v !== "object") return null;
  const { points, max, correct, total } = v as Record<string, unknown>;
  const ok = [points, max, correct, total].every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0);
  if (!ok) return null;
  const b = { points, max, correct, total } as InterviewBest;
  return b.total > 0 && b.correct <= b.total && b.points <= b.max ? b : null;
}

function parseDaily(v: unknown): DailyState {
  if (!v || typeof v !== "object") return NO_DAILY;
  const { last, score, streak, best } = v as Record<string, unknown>;
  const int = (n: unknown, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  if (!isDayKey(last) || !int(score, DAILY_LENGTH) || !int(streak, 100000) || !int(best, 100000) || streak < 1 || best < streak) return NO_DAILY;
  return { last, score, streak, best };
}

/** A list of known Kerneldex ids, de-duplicated. */
const parseDex = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((e): e is string => typeof e === "string" && DEX_IDS.has(e)))] : []);

/** Merge stored JSON onto the defaults, dropping anything malformed. */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return { ...DEFAULT_SAVE };
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...DEFAULT_SAVE,
      badges: Array.isArray(d.badges) ? [...new Set(d.badges.filter((b): b is string => typeof b === "string" && GYMS.some((g) => g.id === b)))] : [],
      lastGym: typeof d.lastGym === "string" ? d.lastGym : null,
      starter: typeof d.starter === "string" && STARTERS.some((s) => s.id === d.starter) ? d.starter : null,
      xp: parseXp(d.xp),
      evolved: Array.isArray(d.evolved) ? [...new Set(d.evolved.filter((e): e is string => typeof e === "string" && STARTERS.some((s) => s.id === e)))] : [],
      seen: parseDex(d.seen),
      caught: parseDex(d.caught),
      leitner: parseDeck(d.leitner),
      lessons: Array.isArray(d.lessons) ? [...new Set(d.lessons.filter((e): e is string => typeof e === "string" && LESSON_IDS.has(e)))] : [],
      trainers: parseTrainers(d.trainers),
      interviewBest: parseInterviewBest(d.interviewBest),
      daily: parseDaily(d.daily),
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

function load(): SaveData {
  if (cache) return cache;
  try {
    cache = parseSave(localStorage.getItem(KEY));
  } catch {
    cache = { ...DEFAULT_SAVE };
  }
  return cache;
}

export function getSave(): SaveData {
  return typeof window === "undefined" ? DEFAULT_SAVE : load();
}

export function updateSave(fn: (s: SaveData) => SaveData) {
  cache = fn(load());
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/** A creature's total XP (a partner that hasn't battled yet starts at `START_XP`). */
export const xpOf = (s: SaveData, id: string) => s.xp[id] ?? START_XP;

/** Record a creature's new XP total (never lowers it). */
export function saveXp(id: string, total: number) {
  updateSave((s) => ({ ...s, xp: { ...s.xp, [id]: Math.max(xpOf(s, id), Math.floor(total)) } }));
}

/** Mark a starter as evolved. */
export function saveEvolved(id: string) {
  updateSave((s) => (s.evolved.includes(id) ? s : { ...s, evolved: [...s.evolved, id] }));
}

/** Record a creature as seen in the Kerneldex. */
export function markSeen(id: string) {
  if (!getSave().seen.includes(id)) updateSave((s) => ({ ...s, seen: [...s.seen, id] }));
}

/** Record a creature as caught (and seen). Returns true when the Kerneldex didn't already count it as caught. */
export function markCaught(id: string): boolean {
  const before = getSave();
  const entry = dexEntry(id);
  if (!entry || before.caught.includes(id)) return false;
  const fresh = dexStatus(entry, before) !== "caught";
  updateSave((s) => ({ ...s, seen: s.seen.includes(id) ? s.seen : [...s.seen, id], caught: [...s.caught, id] }));
  return fresh;
}

/** Move a question's Leitner card after an answer. */
export function recordAnswer(key: string, correct: boolean, now = Date.now()) {
  updateSave((s) => ({ ...s, leitner: { ...s.leitner, [key]: review(s.leitner[key], correct, now) } }));
}

/** Mark a lesson as finished. */
export function saveLessonDone(id: string) {
  updateSave((s) => (s.lessons.includes(id) ? s : { ...s, lessons: [...s.lessons, id] }));
}

/** Trainer battles won in a gym. */
export const trainerWins = (s: SaveData, gymId: string) => s.trainers[gymId] ?? 0;

/** Count a trainer battle win (never past TRAINER_BATTLES). Returns the new count. */
export function saveTrainerWin(gymId: string): number {
  updateSave((s) => ({ ...s, trainers: { ...s.trainers, [gymId]: Math.min(TRAINER_BATTLES, trainerWins(s, gymId) + 1) } }));
  return trainerWins(getSave(), gymId);
}

/** Keep a finished mock interview if it beats the best so far (by points). Returns true for a new best. */
export function saveInterview(r: InterviewBest): boolean {
  const best = getSave().interviewBest;
  if (best && best.points >= r.points) return false;
  updateSave((s) => ({ ...s, interviewBest: r }));
  return true;
}

/** Record a finished daily challenge (once per day). Returns true when it counted. */
export function saveDaily(today: string, score: number): boolean {
  const before = getSave().daily;
  const after = finishDaily(before, today, score);
  if (after === before) return false;
  updateSave((s) => ({ ...s, daily: after }));
  return true;
}

export function resetSave() {
  updateSave(() => ({ ...DEFAULT_SAVE }));
}

export function useSave(): SaveData {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSave,
    () => DEFAULT_SAVE,
  );
}
