/**
 * A Leitner spaced-repetition box. Every question (or generator) has a card
 * in box 1–5 (a new card starts in box 1). A right answer moves the card up one box and schedules it
 * further out; a wrong one sends it back to box 1, due again straight away.
 * Pure: the caller passes the clock.
 */
import type { Question } from "./question";

export const BOXES = 5;
export const DAY = 24 * 60 * 60 * 1000;
/** Days until a card in box n (1-based) is due again: box 1 is due at once. */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14] as const;

export interface Card {
  /** 1..BOXES */
  box: number;
  /** epoch ms when the card is next due */
  due: number;
}

export type Deck = Record<string, Card>;

/**
 * The card key for a question: a generated problem (id `gen#seed`) shares one
 * card per generator, so practising FCFS is tracked as one skill.
 */
export const cardKey = (q: Pick<Question, "id">) => q.id.split("#")[0];

/** The card after an answer at time `now`. */
export function review(card: Card | undefined, correct: boolean, now: number): Card {
  const box = correct ? Math.min(BOXES, (card?.box ?? 1) + 1) : 1;
  return { box, due: now + INTERVAL_DAYS[box - 1] * DAY };
}

export const isDue = (card: Card | undefined, now: number) => !!card && card.due <= now;

/** Keys of the cards due at `now`, lowest box first, then the longest overdue. */
export function dueKeys(deck: Deck, now: number): string[] {
  return Object.keys(deck)
    .filter((k) => isDue(deck[k], now))
    .sort((a, b) => deck[a].box - deck[b].box || deck[a].due - deck[b].due || (a < b ? -1 : 1));
}

/** How many cards sit in each box (index 0 is box 1). */
export function boxCounts(deck: Deck): number[] {
  const out = Array<number>(BOXES).fill(0);
  for (const c of Object.values(deck)) out[c.box - 1]++;
  return out;
}

/** The earliest due time among cards not yet due, or null. */
export function nextDue(deck: Deck, now: number): number | null {
  let best: number | null = null;
  for (const c of Object.values(deck)) if (c.due > now && (best === null || c.due < best)) best = c.due;
  return best;
}

/**
 * A battle's question order: due cards first (lowest box, most overdue), then
 * questions never answered (in their given order), then the rest by how soon
 * they come due. Stable, so a fresh save keeps the authored order.
 */
export function dueFirst<Q extends Pick<Question, "id">>(questions: readonly Q[], deck: Deck, now: number): Q[] {
  const rank = (q: Q) => {
    const c = deck[cardKey(q)];
    if (!c) return [1, 0, 0];
    return c.due <= now ? [0, c.box, c.due] : [2, c.due, 0];
  };
  return questions
    .map((q, i) => ({ q, i, r: rank(q) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.r[2] - b.r[2] || a.i - b.i)
    .map((e) => e.q);
}

/** A deck read from storage, dropping malformed cards. */
export function parseDeck(v: unknown): Deck {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Deck = {};
  for (const [k, c] of Object.entries(v)) {
    if (!c || typeof c !== "object") continue;
    const { box, due } = c as Partial<Card>;
    if (typeof box === "number" && Number.isInteger(box) && box >= 1 && box <= BOXES && typeof due === "number" && Number.isFinite(due)) out[k] = { box, due };
  }
  return out;
}
