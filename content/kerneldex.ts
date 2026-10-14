import type { MoveType } from "@/game/engine/types";
import { GYMS } from "./gyms";
import { EVOLVE_GYM, STARTERS } from "./starters";

/**
 * The Kerneldex: every creature in the region, in dex order (each starter
 * followed by its evolution, then the wild Glitchit, then each gym's trainer
 * creature, if it has one, followed by its boss).
 * A creature is SEEN once you've met it and CAUGHT once its data is recorded:
 * your partner (in each form it has taken) and every creature you've beaten.
 */
export interface DexEntry {
  /** 1-based dex number */
  no: number;
  /** creature art id in `CREATURES` */
  id: string;
  name: string;
  type: MoveType;
  blurb: string;
  kind: "starter" | "evolved" | "wild" | "trainer" | "boss";
  /** where it's found */
  where: string;
  /** the gym it guards (trainers and bosses) */
  gym?: string;
  /** the starter it belongs to (starters and their evolutions) */
  starter?: string;
}

export type DexStatus = "unknown" | "seen" | "caught";

/** The parts of a save the Kerneldex reads. */
export interface DexSave {
  starter: string | null;
  badges: readonly string[];
  evolved: readonly string[];
  seen: readonly string[];
  caught: readonly string[];
}

const evolveGym = GYMS.find((g) => g.id === EVOLVE_GYM)!;

const GLITCHIT: Omit<DexEntry, "no"> = {
  id: "glitchit",
  name: "Glitchit",
  type: "process",
  blurb: "A software bug that scuttles through untested code. When it twitches, its body tears into scanlines like a race condition caught mid-write.",
  kind: "wild",
  where: "Wild: practice battles",
};

export const KERNELDEX: DexEntry[] = [
  ...STARTERS.flatMap((s): Omit<DexEntry, "no">[] => [
    { id: s.id, name: s.name, type: s.type, blurb: s.blurb, kind: "starter", where: "Partner choice", starter: s.id },
    { id: s.evolution.id, name: s.evolution.name, type: s.type, blurb: s.evolution.blurb, kind: "evolved", where: `Evolves from ${s.name} at the ${evolveGym.name}`, starter: s.id },
  ]),
  GLITCHIT,
  ...GYMS.flatMap((g): Omit<DexEntry, "no">[] => [
    ...(g.trainer ? [{ id: g.trainer.name.toLowerCase(), name: g.trainer.name, type: g.type, blurb: g.trainer.blurb, kind: "trainer" as const, where: `Guards the ${g.name} before ${g.boss.name}`, gym: g.id }] : []),
    { id: g.boss.name.toLowerCase(), name: g.boss.name, type: g.type, blurb: g.boss.blurb, kind: "boss", where: `Boss of the ${g.name}`, gym: g.id },
  ]),
].map((e, i) => ({ ...e, no: i + 1 }));

export const DEX_IDS = new Set(KERNELDEX.map((e) => e.id));

export const dexEntry = (id: string) => KERNELDEX.find((e) => e.id === id);

/**
 * How far a save has got with one creature. Older saves catch up: a chosen
 * partner and its evolution are caught, a gym's boss is caught once its badge
 * is earned (and so is its trainer, beaten on the way), and all three starters
 * were seen on the choice screen.
 */
export function dexStatus(e: DexEntry, s: DexSave): DexStatus {
  const partner = e.starter !== undefined && e.starter === s.starter;
  const caught =
    s.caught.includes(e.id) ||
    (partner && e.kind === "starter") ||
    (partner && e.kind === "evolved" && s.evolved.includes(e.starter!)) ||
    ((e.kind === "boss" || e.kind === "trainer") && s.badges.includes(e.gym!));
  if (caught) return "caught";
  if (s.seen.includes(e.id) || (e.kind === "starter" && s.starter !== null)) return "seen";
  return "unknown";
}

/** Seen (including caught) and caught totals. */
export function dexCounts(s: DexSave) {
  const st = KERNELDEX.map((e) => dexStatus(e, s));
  return { seen: st.filter((x) => x !== "unknown").length, caught: st.filter((x) => x === "caught").length, total: KERNELDEX.length };
}
