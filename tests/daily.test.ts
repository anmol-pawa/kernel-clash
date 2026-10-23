import { describe, expect, it } from "vitest";
import { dailyQuestions } from "@/content/daily";
import { BANK_KEYS } from "@/content/questionBank";
import { DAILY_LENGTH, NO_DAILY, dayKey, daySeed, finishDaily, isDayKey, liveStreak, playedToday, previousDay } from "@/game/engine/daily";
import { cardKey } from "@/game/engine/leitner";
import { questionProblems } from "@/game/engine/question";
import { parseSave } from "@/lib/save";

describe("days", () => {
  it("formats the local calendar day", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });

  it("finds the previous day across month, year and leap boundaries", () => {
    expect(previousDay("2026-10-23")).toBe("2026-10-22");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2024-03-01")).toBe("2024-02-29");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });

  it("validates day keys", () => {
    expect(isDayKey("2026-10-23")).toBe(true);
    for (const bad of ["2026-02-30", "2026-13-01", "26-10-23", "", 5, null]) expect(isDayKey(bad)).toBe(false);
  });

  it("seeds each day differently but the same day identically", () => {
    expect(daySeed("2026-10-23")).toBe(daySeed("2026-10-23"));
    expect(daySeed("2026-10-23")).not.toBe(daySeed("2026-10-24"));
  });
});

describe("streaks", () => {
  it("starts at 1 and grows on consecutive days", () => {
    let s = finishDaily(NO_DAILY, "2026-10-20", 3);
    expect(s).toEqual({ last: "2026-10-20", score: 3, streak: 1, best: 1 });
    s = finishDaily(s, "2026-10-21", 5);
    s = finishDaily(s, "2026-10-22", 0);
    expect(s).toMatchObject({ streak: 3, best: 3, score: 0 });
  });

  it("ignores a second finish on the same day", () => {
    const s = finishDaily(NO_DAILY, "2026-10-20", 3);
    expect(finishDaily(s, "2026-10-20", 5)).toBe(s);
    expect(playedToday(s, "2026-10-20")).toBe(true);
    expect(playedToday(s, "2026-10-21")).toBe(false);
  });

  it("resets after a missed day but keeps the best", () => {
    let s = finishDaily(finishDaily(NO_DAILY, "2026-10-20", 5), "2026-10-21", 5);
    expect(liveStreak(s, "2026-10-21")).toBe(2);
    expect(liveStreak(s, "2026-10-22")).toBe(2);
    expect(liveStreak(s, "2026-10-23")).toBe(0);
    s = finishDaily(s, "2026-10-23", 4);
    expect(s).toMatchObject({ streak: 1, best: 2 });
  });

  it("clamps the score", () => {
    expect(finishDaily(NO_DAILY, "2026-10-20", 99).score).toBe(DAILY_LENGTH);
    expect(finishDaily(NO_DAILY, "2026-10-20", -3).score).toBe(0);
  });
});

describe("the daily questions", () => {
  const days = Array.from({ length: 60 }, (_, i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`);

  it("are the same for a day and well-formed", () => {
    for (const day of days) {
      const qs = dailyQuestions(day);
      expect(qs, day).toHaveLength(DAILY_LENGTH);
      expect(dailyQuestions(day).map((q) => q.id)).toEqual(qs.map((q) => q.id));
      expect(new Set(qs.map(cardKey)).size).toBe(DAILY_LENGTH);
      for (const q of qs) {
        expect(BANK_KEYS, q.id).toContain(cardKey(q));
        expect(questionProblems(q), q.id).toEqual([]);
      }
    }
  });

  it("vary from day to day", () => {
    const sets = new Set(days.map((d) => dailyQuestions(d).map((q) => q.id).join()));
    expect(sets.size).toBeGreaterThan(50);
  });
});

describe("saved daily state", () => {
  it("is empty by default and round-trips a valid state", () => {
    expect(parseSave(null).daily).toEqual(NO_DAILY);
    const d = { last: "2026-10-20", score: 4, streak: 3, best: 5 };
    expect(parseSave(JSON.stringify({ daily: d })).daily).toEqual(d);
  });

  it("drops malformed states", () => {
    for (const bad of ["x", { last: "nope", score: 1, streak: 1, best: 1 }, { last: "2026-10-20", score: 6, streak: 1, best: 1 }, { last: "2026-10-20", score: 1, streak: 0, best: 0 }, { last: "2026-10-20", score: 1, streak: 3, best: 2 }, { last: "2026-10-20", score: 1.5, streak: 1, best: 1 }])
      expect(parseSave(JSON.stringify({ daily: bad })).daily).toEqual(NO_DAILY);
  });
});
