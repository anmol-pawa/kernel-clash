import { describe, expect, it } from "vitest";
import { HW_ASSISTED_X86, OLD_X86, leaks, nestedWalkRefs, preCopy, runGuest, virtualizable } from "@/game/sim/virt";

describe("trap-and-emulate (Popek-Goldberg)", () => {
  it("pre-VT x86 is not virtualizable: POPF is sensitive but unprivileged", () => {
    expect(leaks(OLD_X86).map((i) => i.name)).toEqual(["POPF"]);
    expect(virtualizable(OLD_X86)).toBe(false);
  });
  it("hardware assistance makes every sensitive instruction exit", () => {
    expect(virtualizable(HW_ASSISTED_X86)).toBe(true);
  });
  it("a deprivileged guest kernel: ADD runs natively, MOV CR3 traps, POPF leaks without hardware help", () => {
    const prog = ["ADD", "MOV CR3", "POPF", "HLT"];
    expect(runGuest(OLD_X86, prog).map((r) => r.outcome)).toEqual(["native", "trap", "leak", "trap"]);
    expect(runGuest(HW_ASSISTED_X86, prog).map((r) => r.outcome)).toEqual(["native", "trap", "trap", "trap"]);
    expect(() => runGuest(OLD_X86, ["NOP"])).toThrow();
  });
});

describe("two-dimensional page walks", () => {
  it("4-level guest on 4-level nested tables reads 24 locations (Bhargava et al.), not 4", () => {
    expect(nestedWalkRefs(4, 4)).toBe(24);
    expect(nestedWalkRefs(4, 0)).toBe(4);
  });
  it("2-level on 2-level reads 8, 3 on 3 reads 15", () => {
    expect(nestedWalkRefs(2, 2)).toBe(8);
    expect(nestedWalkRefs(3, 3)).toBe(15);
  });
});

describe("pre-copy live migration", () => {
  it("8 GB at 1000 MB/s with 250 MB/s dirtying: rounds of 8192, 2048, 512, 128 MB, then 32 MB paused", () => {
    const m = preCopy(8192, 250, 1000, 64);
    expect(m.rounds.map((r) => r.sentMB)).toEqual([8192, 2048, 512, 128]);
    expect(m.stopCopyMB).toBe(32);
    expect(m.downtimeSec).toBeCloseTo(0.032, 6);
    expect(m.totalSec).toBeCloseTo(8.192 + 2.048 + 0.512 + 0.128 + 0.032, 6);
    expect(m.converges).toBe(true);
  });
  it("a guest that dirties memory as fast as the link never converges", () => {
    const m = preCopy(8192, 1000, 1000, 64);
    expect(m.converges).toBe(false);
    expect(m.downtimeSec).toBeGreaterThan(8);
  });
  it("an idle guest needs one round", () => {
    const m = preCopy(1024, 0, 1000, 64);
    expect(m.rounds).toHaveLength(1);
    expect(m.downtimeSec).toBe(0);
  });
});
