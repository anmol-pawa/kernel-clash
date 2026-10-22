import type { Generator } from "@/game/engine/question";
import { BASICS_GENERATORS } from "./basicsGenerators";
import { DEADLOCK_GENERATORS } from "./deadlockGenerators";
import { MEMORY_GENERATORS } from "./memoryGenerators";
import { PROCESS_GENERATORS } from "./processGenerators";
import { SCHEDULING_GENERATORS } from "./schedulingGenerators";
import { SYNC_GENERATORS } from "./syncGenerators";

/** Every generator in the game (the Leitner bank finds generated cards here). */
export const GENERATORS: Generator[] = [...SCHEDULING_GENERATORS, ...PROCESS_GENERATORS, ...BASICS_GENERATORS, ...SYNC_GENERATORS, ...DEADLOCK_GENERATORS, ...MEMORY_GENERATORS];

export { forkPrints } from "./processGenerators";
export { fcfsAverage } from "./schedulingGenerators";
