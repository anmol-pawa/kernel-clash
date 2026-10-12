"use client";
/**
 * Progress lives in localStorage (per browser). Everything is wrapped in
 * try/catch so private windows and blocked storage just mean "no saves".
 * Adapted from Query Clash's save.
 */
import { useSyncExternalStore } from "react";

export interface SaveData {
  version: 1;
  /** gym ids whose badge has been earned, in map order */
  badges: string[];
  /** gym id the player last selected on the map */
  lastGym: string | null;
}

const KEY = "kernel-clash-save-v1";

export const DEFAULT_SAVE: SaveData = { version: 1, badges: [], lastGym: null };

let cache: SaveData | null = null;
const listeners = new Set<() => void>();

/** Merge stored JSON onto the defaults, dropping anything malformed. */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return { ...DEFAULT_SAVE };
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...DEFAULT_SAVE,
      badges: Array.isArray(d.badges) ? d.badges.filter((b): b is string => typeof b === "string") : [],
      lastGym: typeof d.lastGym === "string" ? d.lastGym : null,
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
