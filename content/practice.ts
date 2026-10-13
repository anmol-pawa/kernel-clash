import type { Question } from "@/game/engine/question";
import { DEMO_QUESTIONS } from "./demo";
import { fcfsAverage, forkPrints } from "./generators";
import { PCB_CONTENTS, SYSCALL_STEPS } from "./questionSamples";

/**
 * The practice battle's questions: one of every kind, with generated
 * problems built from `seed` (the partner's XP, so each win brings new ones).
 */
export function practiceQuestions(seed: number): Question[] {
  const [mode, fork, state, pcb, syscall] = DEMO_QUESTIONS;
  // a battle usually lasts about four turns, so the first four cover every kind
  return [mode, PCB_CONTENTS, fcfsAverage.make(seed), SYSCALL_STEPS, forkPrints.make(seed), fork, state, pcb, syscall];
}
