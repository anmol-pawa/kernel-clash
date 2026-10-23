import { rng } from "@/lib/rng";
import { cardKey } from "@/game/engine/leitner";
import { DAILY_LENGTH, daySeed } from "@/game/engine/daily";
import type { Question } from "@/game/engine/question";
import { BANK_KEYS, bankQuestion } from "./questionBank";

/** The day's questions: a seeded draw of distinct cards from the whole bank (generated problems get a day-seeded instance). */
export function dailyQuestions(day: string, count = DAILY_LENGTH): Question[] {
  const seed = daySeed(day);
  const out: Question[] = [];
  for (const [i, key] of rng(seed).shuffle(BANK_KEYS).entries()) {
    const q = bankQuestion(key, seed + i);
    if (q && cardKey(q) === key) out.push(q);
    if (out.length === count) break;
  }
  return out;
}
