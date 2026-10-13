"use client";
/**
 * Progress lives in localStorage (per browser). Everything is wrapped in
 * try/catch so private windows and blocked storage just mean "no saves".
 * Adapted from Query Clash's save.
 */
import { useSyncExternalStore } from "react";
import { START_XP, STARTERS } from "@/content/starters";

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
}

const KEY = "kernel-clash-save-v1";

export const DEFAULT_SAVE: SaveData = { version: 1, badges: [], lastGym: null, starter: null, xp: {}, evolved: [] };

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

/** Merge stored JSON onto the defaults, dropping anything malformed. */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return { ...DEFAULT_SAVE };
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...DEFAULT_SAVE,
      badges: Array.isArray(d.badges) ? d.badges.filter((b): b is string => typeof b === "string") : [],
      lastGym: typeof d.lastGym === "string" ? d.lastGym : null,
      starter: typeof d.starter === "string" && STARTERS.some((s) => s.id === d.starter) ? d.starter : null,
      xp: parseXp(d.xp),
      evolved: Array.isArray(d.evolved) ? [...new Set(d.evolved.filter((e): e is string => typeof e === "string" && STARTERS.some((s) => s.id === e)))] : [],
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
