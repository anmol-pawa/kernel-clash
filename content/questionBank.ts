import type { Question } from "@/game/engine/question";
import { cardKey, type Deck } from "@/game/engine/leitner";
import { DEMO_QUESTIONS } from "./demo";
import { GENERATORS } from "./generators";
import { GYMS } from "./gyms";
import { GYM_QUESTIONS } from "./gymQuestions";
import { SAMPLE_QUESTIONS } from "./questionSamples";

/** Every authored question, keyed by its Leitner card key. */
const AUTHORED = new Map<string, { q: Question; from: string }>();
for (const q of DEMO_QUESTIONS) AUTHORED.set(cardKey(q), { q, from: "Practice" });
for (const q of SAMPLE_QUESTIONS) AUTHORED.set(cardKey(q), { q, from: "Practice" });
for (const g of GYMS) for (const q of GYM_QUESTIONS[g.id] ?? []) AUTHORED.set(cardKey(q), { q, from: g.name });
const GEN = new Map(GENERATORS.map((g) => [g.id, g]));

/** Whether a card key names a question the game still has. */
export const inBank = (key: string) => AUTHORED.has(key) || GEN.has(key);

/** A deck without cards for questions the game no longer has. */
export const liveDeck = (deck: Deck): Deck => Object.fromEntries(Object.entries(deck).filter(([k]) => inBank(k)));

/** The question behind a card: a generator's card makes a fresh problem from `seed`. */
export function bankQuestion(key: string, seed: number): Question | null {
  const a = AUTHORED.get(key);
  if (a) return a.q;
  return GEN.get(key)?.make(seed) ?? null;
}

/** A short label for the review list: where it comes from and what it asks. */
export function cardLabel(key: string): { from: string; text: string } | null {
  const a = AUTHORED.get(key);
  if (a) return { from: a.from, text: a.q.prompt };
  const g = GEN.get(key);
  return g ? { from: "Generated", text: g.topic } : null;
}

/** The questions for a review battle: the due cards (at most `max`), generators seeded from `seed`. */
export function reviewQuestions(keys: readonly string[], seed: number, max = 8): Question[] {
  return keys.flatMap((k, i) => bankQuestion(k, seed + i) ?? []).slice(0, max);
}
