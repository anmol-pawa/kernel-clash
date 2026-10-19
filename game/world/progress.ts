import { GYMS, type Gym } from "@/content/gyms";
import { lessonsOf } from "@/content/lessons";
import { TRAINER_BATTLES } from "./gymBattle";

export type GymState = "cleared" | "open" | "locked";

/** Gyms are cleared in order: a gym opens once every earlier gym's badge is earned. */
export function gymState(gym: Gym, badges: readonly string[]): GymState {
  if (badges.includes(gym.id)) return "cleared";
  return GYMS.filter((g) => g.n < gym.n).every((g) => badges.includes(g.id)) ? "open" : "locked";
}

/** The gym the player should take on next, or null once every badge is earned. */
export function nextGym(badges: readonly string[]): Gym | null {
  return GYMS.find((g) => gymState(g, badges) === "open") ?? null;
}

/** Award a gym's badge (idempotent; keeps badges in map order). */
export function earnBadge(badges: readonly string[], gymId: string): string[] {
  if (!GYMS.some((g) => g.id === gymId)) throw new Error(`unknown gym ${gymId}`);
  const set = new Set([...badges, gymId]);
  return GYMS.filter((g) => set.has(g.id)).map((g) => g.id);
}

/** Where a player stands in a gym: lessons, then trainer battles, then the boss. */
export type GymFlow = {
  state: GymState;
  lessons: { done: number; total: number };
  /** total is 0 for gyms with no trainer */
  trainers: { won: number; total: number };
  /** the boss takes the challenge: the gym is open and its trainer battles are won (or it's already cleared) */
  bossReady: boolean;
  /** the step to do next; lessons are recommended, not required, so an open gym with lessons left still says "lessons" */
  step: "locked" | "lessons" | "trainers" | "boss" | "cleared";
};

export function gymFlow(gym: Gym, save: { badges: readonly string[]; lessons: readonly string[]; trainers: Readonly<Record<string, number>> }): GymFlow {
  const state = gymState(gym, save.badges);
  const ls = lessonsOf(gym.id);
  const lessons = { done: ls.filter((l) => save.lessons.includes(l.id)).length, total: ls.length };
  const total = gym.trainer ? TRAINER_BATTLES : 0;
  const trainers = { won: Math.min(total, Math.max(0, Math.floor(save.trainers[gym.id] ?? 0))), total };
  const bossReady = state === "cleared" || (state === "open" && trainers.won >= total);
  const step =
    state === "locked" ? "locked" : state === "cleared" ? "cleared" : lessons.done < lessons.total ? "lessons" : trainers.won < total ? "trainers" : "boss";
  return { state, lessons, trainers, bossReady, step };
}
