import { describe, expect, it } from "vitest";
import { INTERVIEW_LENGTH, INTERVIEW_QUESTIONS, TOPIC_OF, mockInterview, topicOf } from "@/content/interviewTopics";
import { INTERVIEW_TOPICS, TIME_LIMIT, limitFor, pointsFor, scorecard, verdictFor, type Answered, type InterviewTopic } from "@/game/engine/interview";
import { kindOf } from "@/game/engine/question";
import { POOLS } from "@/content/pools";

const ans = (topic: InterviewTopic, correct: boolean, seconds = 10, limit = 40): Answered => ({ id: `${topic}-${correct}-${seconds}`, topic, correct, seconds, limit });

describe("interview topics", () => {
  it("tags every pool question with a topic, and no stray ids", () => {
    expect(INTERVIEW_QUESTIONS.map((q) => q.id).sort()).toEqual(POOLS.interview.authored.map((q) => q.id).sort());
    expect(Object.keys(TOPIC_OF).sort()).toEqual(INTERVIEW_QUESTIONS.map((q) => q.id).sort());
    for (const t of INTERVIEW_TOPICS) expect(INTERVIEW_QUESTIONS.filter((q) => topicOf(q) === t).length, t).toBeGreaterThanOrEqual(4);
  });
});

describe("buildInterview", () => {
  it("asks ten distinct questions, covering every topic, the same for the same seed", () => {
    const a = mockInterview(7);
    expect(a).toHaveLength(INTERVIEW_LENGTH);
    expect(new Set(a.map((q) => q.id)).size).toBe(INTERVIEW_LENGTH);
    expect(new Set(a.map(topicOf))).toEqual(new Set(INTERVIEW_TOPICS));
    expect(mockInterview(7).map((q) => q.id)).toEqual(a.map((q) => q.id));
  });

  it("balances topics (3, 3, 2, 2) and varies with the seed", () => {
    for (const seed of [1, 2, 3, 99]) {
      const counts = INTERVIEW_TOPICS.map((t) => mockInterview(seed).filter((q) => topicOf(q) === t).length).sort();
      expect(counts).toEqual([2, 2, 3, 3]);
    }
    expect(new Set([1, 2, 3, 4, 5].map((s) => mockInterview(s).map((q) => q.id).join())).size).toBeGreaterThan(1);
  });

  it("gives every kind in the pool a time limit", () => {
    for (const q of INTERVIEW_QUESTIONS) expect(limitFor(q), q.id).toBe(TIME_LIMIT[kindOf(q)]);
  });
});

describe("scoring", () => {
  it("awards 10 plus a speed bonus up to 5, and nothing for a wrong answer", () => {
    expect(pointsFor(ans("Memory", true, 0, 40))).toBe(15);
    expect(pointsFor(ans("Memory", true, 20, 40))).toBe(13); // half the time left: 10 + round(2.5)
    expect(pointsFor(ans("Memory", true, 40, 40))).toBe(10);
    expect(pointsFor(ans("Memory", true, 90, 40))).toBe(10);
    expect(pointsFor(ans("Memory", false, 0, 40))).toBe(0);
  });

  it("maps the share right to a verdict at 90 / 70 / 50 percent", () => {
    expect(verdictFor(9, 10)).toBe("Strong hire");
    expect(verdictFor(8, 10)).toBe("Hire");
    expect(verdictFor(7, 10)).toBe("Hire");
    expect(verdictFor(6, 10)).toBe("Maybe");
    expect(verdictFor(5, 10)).toBe("Maybe");
    expect(verdictFor(4, 10)).toBe("Not yet");
    expect(verdictFor(0, 0)).toBe("Not yet");
  });

  it("builds a scorecard with per-topic results and the weakest topic", () => {
    const sc = scorecard([ans("Memory", true, 0), ans("Memory", false), ans("Processes", true, 40), ans("I/O and Linux", false), ans("I/O and Linux", false)]);
    expect(sc.total).toBe(5);
    expect(sc.correct).toBe(2);
    expect(sc.points).toBe(15 + 10);
    expect(sc.max).toBe(75);
    expect(sc.topics).toEqual([
      { topic: "Processes", correct: 1, total: 1 },
      { topic: "Memory", correct: 1, total: 2 },
      { topic: "I/O and Linux", correct: 0, total: 2 },
    ]);
    expect(sc.weakest).toBe("I/O and Linux");
    expect(sc.verdict).toBe("Not yet");
  });

  it("has no weakest topic after a perfect run", () => {
    const sc = scorecard(INTERVIEW_TOPICS.map((t) => ans(t, true, 0)));
    expect(sc.weakest).toBeNull();
    expect(sc.points).toBe(60);
    expect(sc.verdict).toBe("Strong hire");
  });
});
