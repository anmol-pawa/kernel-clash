import { describe, expect, it } from "vitest";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";
import { GYMS } from "@/content/gyms";

describe("parseSave hardening", () => {
  it("falls back to the defaults for empty, non-JSON and non-object input", () => {
    for (const raw of [null, "", "{", "not json", "null", "42", "true", '"str"', "[]", "[1,2]"]) {
      expect(parseSave(raw)).toEqual(DEFAULT_SAVE);
    }
  });

  it("drops wrongly-typed fields instead of throwing", () => {
    const s = parseSave(
      JSON.stringify({ badges: "x", lastGym: 5, starter: {}, xp: [1], evolved: 3, seen: null, caught: "a", leitner: 7, lessons: {}, trainers: [], interviewBest: "no", daily: 1 }),
    );
    expect(s).toEqual(DEFAULT_SAVE);
  });

  it("keeps only known, de-duplicated badges", () => {
    const id = GYMS[0].id;
    const s = parseSave(JSON.stringify({ badges: [id, id, "not-a-gym", 3, null] }));
    expect(s.badges).toEqual([id]);
  });

  it("clamps and sanitises numbers", () => {
    const s = parseSave(JSON.stringify({ xp: { a: -5, b: 1e12, c: "9", d: 12.7, e: null } }));
    expect(s.xp).toEqual({ b: 100 ** 3, d: 12 });
  });

  it("round-trips a default save", () => {
    expect(parseSave(JSON.stringify(DEFAULT_SAVE))).toEqual(DEFAULT_SAVE);
  });
});
