import type { Generator } from "@/game/engine/question";
import { BASICS_GENERATORS } from "./basicsGenerators";
import { PROCESS_GENERATORS } from "./processGenerators";
import { SCHEDULING_GENERATORS } from "./schedulingGenerators";

/** Every generator in the game (the Leitner bank finds generated cards here). */
export const GENERATORS: Generator[] = [...SCHEDULING_GENERATORS, ...PROCESS_GENERATORS, ...BASICS_GENERATORS];

export { forkPrints } from "./processGenerators";
export { fcfsAverage } from "./schedulingGenerators";
