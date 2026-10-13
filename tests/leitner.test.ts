import { describe, expect, it } from "vitest";
import { DEMO_QUESTIONS } from "@/content/demo";
import { GENERATORS, fcfsAverage } from "@/content/generators";
import { GYMS } from "@/content/gyms";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { bankQuestion, cardLabel, inBank, liveDeck, reviewQuestions } from "@/content/questionBank";
import { SAMPLE_QUESTIONS } from "@/content/questionSamples";
import { BOXES, DAY, INTERVAL_DAYS, boxCounts, cardKey, dueFirst, dueKeys, isDue, nextDue, parseDeck, review, type Deck } from "@/game/engine/leitner";
import { questionProblems } from "@/game/engine/question";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

const T = 1_700_000_000_000;

describe("review (moving a card)", () => {
  it("files a first right answer in box 2, due a day later", () => {
    expect(review(undefined, true, T)).toEqual({ box: 2, due: T + DAY });
  });
  it("files a first wrong answer in box 1, due at once", () => {
    expect(review(undefined, false, T)).toEqual({ box: 1, due: T });
  });
  it("moves up one box per right answer with growing intervals, capped at the last box", () => {
    let c = review(undefined, false, T);
    const boxes: number[] = [];
    for (let i = 0; i < 6; i++) {
      c = review(c, true, T);
      boxes.push(c.box);
      expect(c.due).toBe(T + INTERVAL_DAYS[c.box - 1] * DAY);
    }
    expect(boxes).toEqual([2, 3, 4, 5, 5, 5]);
    expect([...INTERVAL_DAYS].every((d, i) => i === 0 || d > INTERVAL_DAYS[i - 1])).toBe(true);
    expect(INTERVAL_DAYS).toHaveLength(BOXES);
  });
  it("sends any card back to box 1 on a wrong answer", () => {
    expect(review({ box: 5, due: T - DAY }, false, T)).toEqual({ box: 1, due: T });
  });
});

describe("due cards", () => {
  const deck: Deck = {
    a: { box: 3, due: T - 5 * DAY },
    b: { box: 1, due: T },
    c: { box: 1, due: T - DAY },
    d: { box: 4, due: T + 2 * DAY },
    e: { box: 2, due: T + DAY },
  };
  it("lists due cards lowest box first, then most overdue", () => {
    expect(dueKeys(deck, T)).toEqual(["c", "b", "a"]);
    expect(isDue(deck.d, T)).toBe(false);
    expect(isDue(undefined, T)).toBe(false);
  });
  it("counts cards per box and finds the next due time", () => {
    expect(boxCounts(deck)).toEqual([2, 1, 1, 1, 0]);
    expect(nextDue(deck, T)).toBe(T + DAY);
    expect(nextDue({}, T)).toBeNull();
  });
  it("orders a battle: due first, then never answered in authored order, then by soonest due", () => {
    const qs = ["n1", "d", "a", "e", "n2", "c"].map((id) => ({ id }));
    expect(dueFirst(qs, deck, T).map((q) => q.id)).toEqual(["c", "a", "n1", "n2", "e", "d"]);
    expect(dueFirst(qs, {}, T)).toEqual(qs);
  });
  it("shares one card per generator", () => {
    expect(cardKey(fcfsAverage.make(7))).toBe("gen-fcfs-avg");
    expect(cardKey(fcfsAverage.make(8))).toBe(cardKey(fcfsAverage.make(9)));
    expect(cardKey(DEMO_QUESTIONS[0])).toBe(DEMO_QUESTIONS[0].id);
  });
});

describe("parseDeck and the save", () => {
  it("drops malformed cards", () => {
    expect(parseDeck(null)).toEqual({});
    expect(parseDeck([1])).toEqual({});
    expect(parseDeck({ ok: { box: 2, due: T }, zero: { box: 0, due: T }, six: { box: 6, due: T }, half: { box: 1.5, due: T }, nodue: { box: 1 }, str: "x", nan: { box: 1, due: Number.NaN } })).toEqual({ ok: { box: 2, due: T } });
  });
  it("starts empty and survives a round trip", () => {
    expect(DEFAULT_SAVE.leitner).toEqual({});
    expect(parseSave(JSON.stringify({ badges: [] })).leitner).toEqual({});
    const leitner = { "basics-irq": { box: 3, due: T } };
    expect(parseSave(JSON.stringify({ ...DEFAULT_SAVE, leitner })).leitner).toEqual(leitner);
  });
});

describe("question bank", () => {
  const authored = [...DEMO_QUESTIONS, ...SAMPLE_QUESTIONS, ...GYMS.flatMap((g) => GYM_QUESTIONS[g.id])];
  it("finds every authored question and generator by its card key", () => {
    for (const q of authored) {
      expect(inBank(cardKey(q))).toBe(true);
      expect(bankQuestion(cardKey(q), 1)).toBe(q);
      expect(cardLabel(cardKey(q))?.text).toBe(q.prompt);
    }
    for (const g of GENERATORS) {
      expect(bankQuestion(g.id, 42)?.id).toBe(`${g.id}#42`);
      expect(cardLabel(g.id)).toEqual({ from: "Generated", text: g.topic });
    }
    expect(inBank("gone")).toBe(false);
    expect(bankQuestion("gone", 1)).toBeNull();
    expect(cardLabel("gone")).toBeNull();
  });
  it("labels gym questions with their gym", () => {
    const g = GYMS[0];
    expect(cardLabel(cardKey(GYM_QUESTIONS[g.id][0]))?.from).toBe(g.name);
  });
  it("drops cards for questions the game no longer has", () => {
    expect(liveDeck({ gone: { box: 1, due: T }, "gen-fork-prints": { box: 2, due: T } })).toEqual({ "gen-fork-prints": { box: 2, due: T } });
  });
  it("builds a review battle from due keys: well-formed, capped, generators seeded", () => {
    const keys = ["gen-fcfs-avg", "gone", ...authored.map(cardKey)];
    const qs = reviewQuestions(keys, 10);
    expect(qs).toHaveLength(8);
    expect(qs[0].id).toBe("gen-fcfs-avg#10");
    expect(qs[1]).toBe(authored[0]);
    for (const q of qs) expect(questionProblems(q)).toEqual([]);
    expect(reviewQuestions(keys, 10).map((q) => q.prompt)).toEqual(qs.map((q) => q.prompt));
  });
});
