import { describe, expect, it } from "vitest";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

const withBest = (b: unknown) => parseSave(JSON.stringify({ interviewBest: b }));

describe("saved mock-interview best", () => {
  it("is empty on a fresh save", () => {
    expect(DEFAULT_SAVE.interviewBest).toBeNull();
    expect(parseSave(null).interviewBest).toBeNull();
    expect(parseSave("{}").interviewBest).toBeNull();
  });

  it("round-trips a valid result", () => {
    const b = { points: 112, max: 150, correct: 8, total: 10 };
    expect(withBest(b).interviewBest).toEqual(b);
  });

  it("drops malformed or impossible results", () => {
    expect(withBest("nope").interviewBest).toBeNull();
    expect(withBest({ points: 1, max: 150, correct: 1 }).interviewBest).toBeNull();
    expect(withBest({ points: -1, max: 150, correct: 1, total: 10 }).interviewBest).toBeNull();
    expect(withBest({ points: 10, max: 150, correct: 11, total: 10 }).interviewBest).toBeNull();
    expect(withBest({ points: 200, max: 150, correct: 10, total: 10 }).interviewBest).toBeNull();
    expect(withBest({ points: 0, max: 0, correct: 0, total: 0 }).interviewBest).toBeNull();
  });
});
