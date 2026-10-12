import { GYMS, type Gym } from "@/content/gyms";

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
