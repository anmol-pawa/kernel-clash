import type { Starter } from "@/content/starters";
import type { CreatureArt } from "@/lib/creature";
import type { SpriteSheet } from "@/lib/pixel";
import { BYTLING_ART } from "./bytling";
import { CHRONOGOLEM_ART } from "./chronogolem";
import { CYCLOWL_ART } from "./cyclowl";
import { DEADLOCRAB_ART } from "./deadlocrab";
import { DISKRAKEN_ART } from "./diskraken";
import { BIT_ORB, IMPACT } from "./effects";
import { FORKUPINE_ART } from "./forkupine";
import { GIGAHOARD_ART } from "./gigahoard";
import { GLITCHIT_ART } from "./glitchit";
import { HEAPOTAMUS_ART } from "./heapotamus";
import { HYDRAFORK_ART } from "./hydrafork";
import { PAGOLIN_ART } from "./pagolin";
import { SEEKMOLE_ART } from "./seekmole";
import { SWAPLOTH_ART } from "./swaploth";
import { KERNELORD_ART } from "./kernelord";
import { MUTEXA_ART } from "./mutexa";
import { BADGES, GYM_SHEETS, MAP_MARKER, OVERWORLD } from "./overworld";
import { RAIDSNAIL_ART } from "./raidsnail";
import { RAMSTER_ART } from "./ramster";
import { SPINNAIL_ART } from "./spinnail";
import { SYSCALLOW_ART } from "./syscallow";
import { HEAD_POST, PEAK_HORIZON, PLATTER_PLATFORM, PLATTER_STACK, SLATE_ROCK, TRACK_SCORE, CARD_PILE, GLOW_SHROOMS, MOSS_PATCH, PAGE_TREE, STUMP_PLATFORM, SWAP_HORIZON, SWAP_SIGN, BOLLARD, CONTAINER_STACK, CRATE, HARBOR_HORIZON, PIER_PLATFORM, PLANKS, ASPHALT, CONE, CROSSING_PLATFORM, GRIDLOCK_HORIZON, STANDOFF_CARS, TRAFFIC_LIGHT, CLOCK_LAMP, CLOCK_SKYLINE, COBBLES, COG_PLATFORM, GROVE_BUSH, GROVE_ROOTS, GROVE_SHROOMS, GROVE_TREES, GROVE_TUFT, HOURGLASS, LILY_PADS, LOCK_POST, MARSH_HORIZON, MARSH_REEDS, PAD_PLATFORM, PLATFORM, PLAZA_COG, ROOT_PLATFORM, SIGNAL_POST, SKYLINE } from "./scenery";
import { SEMAFROG_ART } from "./semafrog";
import { THREADRAKE_ART } from "./threadrake";
import { THRASHMOTH_ART } from "./thrashmoth";
import { TORTICK_ART } from "./tortick";
import { TRAPJAW_ART } from "./trapjaw";

/** Every battle creature, in Kerneldex order. */
export const CREATURES: CreatureArt[] = [BYTLING_ART, THREADRAKE_ART, RAMSTER_ART, GIGAHOARD_ART, SPINNAIL_ART, RAIDSNAIL_ART, GLITCHIT_ART, SYSCALLOW_ART, TRAPJAW_ART, FORKUPINE_ART, HYDRAFORK_ART, TORTICK_ART, CHRONOGOLEM_ART, SEMAFROG_ART, MUTEXA_ART, CYCLOWL_ART, DEADLOCRAB_ART, PAGOLIN_ART, HEAPOTAMUS_ART, SWAPLOTH_ART, THRASHMOTH_ART, SEEKMOLE_ART, DISKRAKEN_ART, KERNELORD_ART];

/** Gym bosses (96×96), keyed by gym id. */
export const BOSSES: Record<string, CreatureArt> = { basics: TRAPJAW_ART, processes: HYDRAFORK_ART, scheduling: CHRONOGOLEM_ART, sync: MUTEXA_ART, deadlocks: DEADLOCRAB_ART, memory: HEAPOTAMUS_ART, virtual: THRASHMOTH_ART, storage: DISKRAKEN_ART, interview: KERNELORD_ART };

/** Gym trainer creatures (64×64), keyed by gym id: the gyms that have trainer battles. */
export const TRAINERS: Record<string, CreatureArt> = { basics: SYSCALLOW_ART, processes: FORKUPINE_ART, scheduling: TORTICK_ART, sync: SEMAFROG_ART, deadlocks: CYCLOWL_ART, memory: PAGOLIN_ART, virtual: SWAPLOTH_ART, storage: SEEKMOLE_ART };

/** Move effects and scenery sheets. */
export const EFFECTS: SpriteSheet[] = [BIT_ORB, IMPACT];
export const SCENERY: SpriteSheet[] = [PLATFORM, SKYLINE, ROOT_PLATFORM, GROVE_TREES, GROVE_ROOTS, GROVE_BUSH, GROVE_SHROOMS, GROVE_TUFT, COG_PLATFORM, CLOCK_SKYLINE, PLAZA_COG, CLOCK_LAMP, HOURGLASS, COBBLES, MARSH_HORIZON, MARSH_REEDS, LILY_PADS, SIGNAL_POST, LOCK_POST, PAD_PLATFORM, GRIDLOCK_HORIZON, TRAFFIC_LIGHT, STANDOFF_CARS, CONE, ASPHALT, CROSSING_PLATFORM, HARBOR_HORIZON, CONTAINER_STACK, BOLLARD, CRATE, PLANKS, PIER_PLATFORM, SWAP_HORIZON, PAGE_TREE, SWAP_SIGN, CARD_PILE, GLOW_SHROOMS, MOSS_PATCH, STUMP_PLATFORM, PEAK_HORIZON, PLATTER_STACK, HEAD_POST, SLATE_ROCK, TRACK_SCORE, PLATTER_PLATFORM];

/** Overworld sheets: the map marker, the nine badges and gym buildings, and the region map itself. */
export const WORLD: SpriteSheet[] = [MAP_MARKER, ...BADGES, ...GYM_SHEETS, OVERWORLD];

/** The three starters' art, keyed by creature id. */
export const STARTER_ART: Record<string, CreatureArt> = { bytling: BYTLING_ART, ramster: RAMSTER_ART, spinnail: SPINNAIL_ART };

/** The starters' evolved forms' art, keyed by creature id. */
export const EVOLVED_ART: Record<string, CreatureArt> = { threadrake: THREADRAKE_ART, gigahoard: GIGAHOARD_ART, raidsnail: RAIDSNAIL_ART };

/** The partner's art in its current form. */
export const partnerArt = (s: Starter, evolved: boolean): CreatureArt => (evolved ? EVOLVED_ART[s.evolution.id] : STARTER_ART[s.id]);
