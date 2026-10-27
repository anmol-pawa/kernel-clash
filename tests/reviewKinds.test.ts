import { describe, expect, it } from "vitest";
import { BUGSPOT_QUESTIONS } from "@/content/bugspotQuestions";
import { FILL_QUESTIONS } from "@/content/fillQuestions";
import { INCIDENT_QUESTIONS } from "@/content/incidentQuestions";
import { dailyQuestions } from "@/content/daily";
import { cardLabel, inBank, liveDeck, reviewQuestions } from "@/content/questionBank";
import { cardKey, dueKeys, review, type Deck } from "@/game/engine/leitner";
import { questionProblems } from "@/game/engine/question";

const KINDS = { bugspot: BUGSPOT_QUESTIONS, fill: FILL_QUESTIONS, incident: INCIDENT_QUESTIONS };
const NOW = Date.UTC(2026, 9, 27);

describe("review queue and daily challenge cover the code-reading kinds", () => {
  for (const [kind, qs] of Object.entries(KINDS)) {
    it(`a wrong ${kind} answer is due at once and replayable in a review battle`, () => {
      const deck: Deck = {};
      for (const q of qs) deck[cardKey(q)] = review(deck[cardKey(q)], false, NOW);
      const live = liveDeck(deck);
      expect(Object.keys(live).length).toBe(qs.length);
      const due = dueKeys(live, NOW);
      expect(due.length).toBe(qs.length);
      for (const q of qs) {
        expect(inBank(q.id)).toBe(true);
        expect(cardLabel(q.id)?.text.length).toBeGreaterThan(10);
      }
      const replay = reviewQuestions(due, 1, qs.length);
      expect(replay.map((q) => q.id).sort()).toEqual(qs.map((q) => q.id).sort());
      for (const q of replay) {
        expect(q.kind).toBe(kind);
        expect(questionProblems(q)).toEqual([]);
      }
    });

    it(`the daily challenge draws ${kind} questions over a month`, () => {
      const seen = new Set<string>();
      for (let d = 1; d <= 31; d++) for (const q of dailyQuestions(`2026-10-${String(d).padStart(2, "0")}`)) if (q.kind === kind) seen.add(q.id);
      expect(seen.size).toBeGreaterThan(0);
    });
  }
});
