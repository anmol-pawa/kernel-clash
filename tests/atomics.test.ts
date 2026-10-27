import { describe, expect, it } from "vitest";
import { MESSAGE_PASSING, MESSAGE_PASSING_RELEASE, STORE_BUFFERING, STORE_BUFFERING_FENCED, abaScenario, outcomes } from "@/game/sim/atomics";

describe("ABA on a lock-free stack", () => {
  it("an untagged stale CAS succeeds and makes a freed node the head", () => {
    const r = abaScenario(false);
    expect(r.casSucceeded).toBe(true);
    expect(r.head).toBe("B");
    expect(r.corrupt).toBe(true);
  });
  it("a version tag makes the stale CAS fail and keeps A -> C", () => {
    const r = abaScenario(true);
    expect(r.casSucceeded).toBe(false);
    expect(r.stack).toEqual(["A", "C"]);
    expect(r.corrupt).toBe(false);
  });
});

describe("store-buffer litmus tests", () => {
  const SB = ["r1=0 r2=0", "r1=0 r2=1", "r1=1 r2=0", "r1=1 r2=1"];
  it("sequential consistency never gives r1 = r2 = 0", () => {
    expect(outcomes(STORE_BUFFERING, "sc", ["x", "y"])).toEqual(SB.slice(1));
  });
  it("x86-TSO adds r1 = r2 = 0 (Sewell et al., test SB)", () => {
    expect(outcomes(STORE_BUFFERING, "tso", ["x", "y"])).toEqual(SB);
  });
  it("a fence between store and load restores sequential consistency", () => {
    expect(outcomes(STORE_BUFFERING_FENCED, "tso", ["x", "y"])).toEqual(SB.slice(1));
  });
  it("message passing: TSO and SC never see the flag without the data", () => {
    const bad = "r1=1 r2=0";
    expect(outcomes(MESSAGE_PASSING, "sc", ["data", "flag"])).not.toContain(bad);
    expect(outcomes(MESSAGE_PASSING, "tso", ["data", "flag"])).not.toContain(bad);
  });
  it("a relaxed machine can reorder the two stores, so the reader sees flag = 1, data = 0", () => {
    expect(outcomes(MESSAGE_PASSING, "relaxed", ["data", "flag"])).toContain("r1=1 r2=0");
  });
  it("a release store on the flag forbids that outcome even when relaxed", () => {
    const o = outcomes(MESSAGE_PASSING_RELEASE, "relaxed", ["data", "flag"]);
    expect(o).not.toContain("r1=1 r2=0");
    expect(o).toContain("r1=1 r2=1");
  });
});
