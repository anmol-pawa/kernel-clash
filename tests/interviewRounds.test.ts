import { describe, expect, it } from "vitest";
import { buildRound, roundLength, roundOf, topicOf } from "@/content/interviewTopics";
import { kindOf } from "@/game/engine/question";
import { LOOP_SHAPE, ROUND_IDS, TOPIC_GYMS, INTERVIEW_TOPICS, loopVerdict, roundResults, studyPlan, type Answered, type InterviewTopic, type RoundKind } from "@/game/engine/interview";
import { GYMS } from "@/content/gyms";

const ans = (topic: InterviewTopic, correct: boolean, round?: RoundKind, id = `${topic}-${round}-${correct}-${Math.random()}`): Answered => ({ id, topic, round, correct, seconds: 5, limit: 60 });

describe("buildRound", () => {
  it("asks the declared number of distinct questions for every round, deterministically", () => {
    for (const id of ROUND_IDS) {
      for (const seed of [1, 2, 3, 42, 99]) {
        const qs = buildRound(id, seed);
        expect(qs, `${id} ${seed}`).toHaveLength(roundLength(id));
        expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
        expect(buildRound(id, seed).map((q) => q.id)).toEqual(qs.map((q) => q.id));
      }
    }
  });

  it("keeps each stand-alone round to its own question kinds", () => {
    expect(buildRound("concurrency", 5).every((q) => ["bugspot", "fill"].includes(kindOf(q)))).toBe(true);
    expect(buildRound("incident", 5).every((q) => kindOf(q) === "incident")).toBe(true);
    expect(buildRound("design", 5).every((q) => roundOf(q) === "design")).toBe(true);
    expect(buildRound("fundamentals", 5).every((q) => roundOf(q) === "fundamentals")).toBe(true);
  });

  it("asks each design's steps question followed by its follow-up", () => {
    for (const seed of [1, 2, 3, 4]) {
      const qs = buildRound("design", seed);
      expect(qs[0].id.split("-")[1]).toBe(qs[1].id.split("-")[1]);
      expect(qs[2].id.split("-")[1]).toBe(qs[3].id.split("-")[1]);
      expect(qs[0].id.split("-")[1]).not.toBe(qs[2].id.split("-")[1]);
      expect(kindOf(qs[0])).toBe("order");
    }
  });

  it("makes the full loop one short round of each kind, in order", () => {
    const qs = buildRound("full", 11);
    const kinds = qs.map(roundOf);
    expect(kinds).toEqual([...Array(LOOP_SHAPE.fundamentals).fill("fundamentals"), ...Array(LOOP_SHAPE.concurrency).fill("concurrency"), ...Array(LOOP_SHAPE.incident).fill("incident"), ...Array(LOOP_SHAPE.design).fill("design")]);
    expect(qs.every((q) => topicOf(q) !== undefined)).toBe(true);
  });
});

describe("loop verdict", () => {
  const r = (round: RoundKind, correct: number, total: number) => ({ round, correct, total });
  it("hires on 75% with no weak round, leans on 55% with one, otherwise no hire", () => {
    expect(loopVerdict([r("fundamentals", 4, 4), r("concurrency", 2, 2), r("incident", 1, 1), r("design", 1, 2)])).toBe("Hire");
    expect(loopVerdict([r("fundamentals", 4, 4), r("concurrency", 2, 2), r("incident", 0, 1), r("design", 2, 2)])).toBe("Lean hire");
    expect(loopVerdict([r("fundamentals", 3, 4), r("concurrency", 1, 2), r("incident", 0, 1), r("design", 1, 2)])).toBe("Lean hire");
    expect(loopVerdict([r("fundamentals", 2, 4), r("concurrency", 0, 2), r("incident", 0, 1), r("design", 2, 2)])).toBe("No hire");
    expect(loopVerdict([])).toBe("No hire");
  });
});

describe("round results and study plan", () => {
  it("groups answers by round, treating an untagged answer as fundamentals", () => {
    const rr = roundResults([ans("Memory", true), ans("Memory", false, "fundamentals"), ans("Processes", true, "incident")]);
    expect(rr).toEqual([{ round: "fundamentals", correct: 1, total: 2 }, { round: "incident", correct: 1, total: 1 }]);
  });

  it("lists missed topics worst first and links real gyms", () => {
    const plan = studyPlan([ans("Memory", true), ans("Memory", false), ans("Processes", false), ans("I/O and Linux", true)]);
    expect(plan.map((p) => p.topic)).toEqual(["Processes", "Memory"]);
    expect(studyPlan([ans("Memory", true)])).toEqual([]);
    for (const t of INTERVIEW_TOPICS) for (const g of TOPIC_GYMS[t]) expect(GYMS.some((x) => x.id === g.gym), g.gym).toBe(true);
  });
});
