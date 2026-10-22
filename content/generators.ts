import type { Generator } from "@/game/engine/question";
import { BASICS_GENERATORS } from "./basicsGenerators";
import { DEADLOCK_GENERATORS } from "./deadlockGenerators";
import { MEMORY_GENERATORS } from "./memoryGenerators";
import { PROCESS_GENERATORS } from "./processGenerators";
import { SCHEDULING_GENERATORS } from "./schedulingGenerators";
import { STORAGE_GENERATORS } from "./storageGenerators";
import { SYNC_GENERATORS } from "./syncGenerators";
import { VIRTUAL_GENERATORS } from "./virtualGenerators";

/** Every generator in the game (the Leitner bank finds generated cards here). */
export const GENERATORS: Generator[] = [...SCHEDULING_GENERATORS, ...PROCESS_GENERATORS, ...BASICS_GENERATORS, ...SYNC_GENERATORS, ...DEADLOCK_GENERATORS, ...MEMORY_GENERATORS, ...VIRTUAL_GENERATORS, ...STORAGE_GENERATORS];

export { forkPrints } from "./processGenerators";
export { fcfsAverage } from "./schedulingGenerators";
