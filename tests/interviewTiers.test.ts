import { describe, expect, it } from "vitest";
import { INTERVIEW_QUESTIONS, buildRound, roundOf, tierOf, topicOf } from "@/content/interviewTopics";
import { TIER_OF } from "@/content/interviewTiers";
import { INTERVIEW_TOPICS, TIERS, tierResults, type Answered } from "@/game/engine/interview";

describe("interview tiers", () => {
  it("only tags questions that exist", () => {
    const ids = new Set(INTERVIEW_QUESTIONS.map((q) => q.id));
    for (const id of Object.keys(TIER_OF)) expect(ids.has(id), id).toBe(true);
  });

  it("has easy, medium and hard questions in every topic's fundamentals pool", () => {
    for (const topic of INTERVIEW_TOPICS) {
      for (const tier of TIERS) {
        const n = INTERVIEW_QUESTIONS.filter((q) => roundOf(q) === "fundamentals" && topicOf(q) === topic && tierOf(q) === tier).length;
        expect(n, `${topic} ${tier}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("has every tier across the whole bank and in each non-fundamentals round", () => {
    for (const tier of TIERS) expect(INTERVIEW_QUESTIONS.some((q) => tierOf(q) === tier)).toBe(true);
    for (const r of ["concurrency", "incident", "design"] as const) {
      const tiers = new Set(INTERVIEW_QUESTIONS.filter((q) => roundOf(q) === r).map(tierOf));
      expect(tiers.size, r).toBeGreaterThanOrEqual(2);
    }
  });

  it("draws a mix of tiers in a fundamentals interview, whatever the seed", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const tiers = new Set(buildRound("fundamentals", seed).map(tierOf));
      expect(tiers.size, `seed ${seed}`).toBe(3);
    }
  });

  it("groups answers by tier, treating an untagged answer as medium", () => {
    const a = (tier: Answered["tier"], correct: boolean): Answered => ({ id: "x", topic: "Memory", tier, correct, seconds: 1, limit: 60 });
    expect(tierResults([a("easy", true), a(undefined, false), a("medium", true), a("hard", false)])).toEqual([
      { tier: "easy", correct: 1, total: 1 },
      { tier: "medium", correct: 1, total: 2 },
      { tier: "hard", correct: 0, total: 1 },
    ]);
  });
});
