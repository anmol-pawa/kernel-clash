import type { CreatureArt } from "@/lib/creature";
import type { SpriteSheet } from "@/lib/pixel";
import { BYTLING_ART } from "./bytling";
import { CHRONOGOLEM_ART } from "./chronogolem";
import { DEADLOCRAB_ART } from "./deadlocrab";
import { DISKRAKEN_ART } from "./diskraken";
import { BIT_ORB, IMPACT } from "./effects";
import { GLITCHIT_ART } from "./glitchit";
import { HEAPOTAMUS_ART } from "./heapotamus";
import { HYDRAFORK_ART } from "./hydrafork";
import { KERNELORD_ART } from "./kernelord";
import { MUTEXA_ART } from "./mutexa";
import { BADGES, GYM_SHEETS, MAP_MARKER, OVERWORLD } from "./overworld";
import { RAMSTER_ART } from "./ramster";
import { SPINNAIL_ART } from "./spinnail";
import { PLATFORM, SKYLINE } from "./scenery";
import { THRASHMOTH_ART } from "./thrashmoth";
import { TRAPJAW_ART } from "./trapjaw";

/** Every battle creature, in Kerneldex order. */
export const CREATURES: CreatureArt[] = [BYTLING_ART, RAMSTER_ART, SPINNAIL_ART, GLITCHIT_ART, TRAPJAW_ART, HYDRAFORK_ART, CHRONOGOLEM_ART, MUTEXA_ART, DEADLOCRAB_ART, HEAPOTAMUS_ART, THRASHMOTH_ART, DISKRAKEN_ART, KERNELORD_ART];

/** Gym bosses (96×96), keyed by gym id. */
export const BOSSES: Record<string, CreatureArt> = { basics: TRAPJAW_ART, processes: HYDRAFORK_ART, scheduling: CHRONOGOLEM_ART, sync: MUTEXA_ART, deadlocks: DEADLOCRAB_ART, memory: HEAPOTAMUS_ART, virtual: THRASHMOTH_ART, storage: DISKRAKEN_ART, interview: KERNELORD_ART };

/** Move effects and scenery sheets. */
export const EFFECTS: SpriteSheet[] = [BIT_ORB, IMPACT];
export const SCENERY: SpriteSheet[] = [PLATFORM, SKYLINE];

/** Overworld sheets: the map marker, the nine badges and gym buildings, and the region map itself. */
export const WORLD: SpriteSheet[] = [MAP_MARKER, ...BADGES, ...GYM_SHEETS, OVERWORLD];

/** The three starters' art, keyed by creature id. */
export const STARTER_ART: Record<string, CreatureArt> = { bytling: BYTLING_ART, ramster: RAMSTER_ART, spinnail: SPINNAIL_ART };
