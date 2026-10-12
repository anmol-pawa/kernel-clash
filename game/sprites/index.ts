import type { CreatureArt } from "@/lib/creature";
import type { SpriteSheet } from "@/lib/pixel";
import { BYTLING_ART } from "./bytling";
import { BIT_ORB, IMPACT } from "./effects";
import { GLITCHIT_ART } from "./glitchit";
import { BADGES, GYM_SHEETS, MAP_MARKER, OVERWORLD } from "./overworld";
import { PLATFORM, SKYLINE } from "./scenery";

/** Every battle creature, in Kerneldex order. */
export const CREATURES: CreatureArt[] = [BYTLING_ART, GLITCHIT_ART];

/** Move effects and scenery sheets. */
export const EFFECTS: SpriteSheet[] = [BIT_ORB, IMPACT];
export const SCENERY: SpriteSheet[] = [PLATFORM, SKYLINE];

/** Overworld sheets: the map marker, the nine badges and gym buildings, and the region map itself. */
export const WORLD: SpriteSheet[] = [MAP_MARKER, ...BADGES, ...GYM_SHEETS, OVERWORLD];
