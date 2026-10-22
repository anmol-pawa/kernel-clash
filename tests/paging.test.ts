import { describe, expect, it } from "vitest";
import {
  BELADY_EXAMPLE, REFERENCE_EXAMPLE, beladyAt, demandPagingEat, faultCount, faultCurve, maxFaultRate, replacePages, thrashing, workingSet,
} from "@/game/sim/paging";

describe("page replacement (Silberschatz Figures 10.12–10.15, 3 frames)", () => {
  it("FIFO 15, LRU 12, Optimal 9 faults", () => {
    expect(faultCount(REFERENCE_EXAMPLE, 3, "fifo")).toBe(15);
    expect(faultCount(REFERENCE_EXAMPLE, 3, "lru")).toBe(12);
    expect(faultCount(REFERENCE_EXAMPLE, 3, "opt")).toBe(9);
  });
  it("FIFO's first frames match Figure 10.12", () => {
    const { steps } = replacePages(REFERENCE_EXAMPLE, 3, "fifo");
    expect(steps[2].frames).toEqual([7, 0, 1]);
    expect(steps[3]).toMatchObject({ fault: true, victim: 7, frames: [2, 0, 1] });
    expect(steps[4].fault).toBe(false);
  });
  it("Optimal never does worse than any other policy", () => {
    for (const f of [1, 2, 3, 4, 5]) {
      for (const p of ["fifo", "lru", "clock"] as const) expect(faultCount(REFERENCE_EXAMPLE, f, "opt")).toBeLessThanOrEqual(faultCount(REFERENCE_EXAMPLE, f, p));
    }
  });
  it("Clock gives a second chance: refs 1 2 1 3 on 2 frames evicts 1 after the sweep", () => {
    const { steps } = replacePages([1, 2, 1, 3], 2, "clock");
    expect(steps[3]).toMatchObject({ fault: true, victim: 1, frames: [3, 2] });
  });
  it("one frame faults on every change of page", () => {
    expect(faultCount([1, 1, 2, 2, 1], 1, "lru")).toBe(3);
  });
  it("enough frames means only compulsory faults", () => {
    for (const p of ["fifo", "lru", "opt", "clock"] as const) expect(faultCount(REFERENCE_EXAMPLE, 8, p)).toBe(new Set(REFERENCE_EXAMPLE).size);
  });
});

describe("Belady's anomaly (1 2 3 4 1 2 5 1 2 3 4 5)", () => {
  it("FIFO: 9 faults with 3 frames, 10 with 4", () => {
    expect(faultCount(BELADY_EXAMPLE, 3, "fifo")).toBe(9);
    expect(faultCount(BELADY_EXAMPLE, 4, "fifo")).toBe(10);
    expect(beladyAt(faultCurve(BELADY_EXAMPLE, "fifo", 5))).toBe(4);
  });
  it("LRU and Optimal are stack algorithms: never anomalous", () => {
    expect(beladyAt(faultCurve(BELADY_EXAMPLE, "lru", 7))).toBeNull();
    expect(beladyAt(faultCurve(BELADY_EXAMPLE, "opt", 7))).toBeNull();
    expect(faultCount(BELADY_EXAMPLE, 3, "lru")).toBe(10);
    expect(faultCount(BELADY_EXAMPLE, 4, "lru")).toBe(8);
  });
});

describe("demand paging and working sets", () => {
  it("200 ns memory, 8 ms fault service, p = 1/1000 → 8199.8 ns", () => {
    expect(demandPagingEat(0.001, 200, 8_000_000)).toBeCloseTo(8199.8, 6);
  });
  it("a 10% slowdown needs p < 2.5e-6", () => {
    expect(maxFaultRate(200, 8_000_000, 0.1)).toBeCloseTo(2.5e-6, 8);
  });
  it("working sets of a phase-changing string, Δ = 10", () => {
    const refs = [2, 6, 1, 5, 7, 7, 7, 7, 5, 1, 6, 2, 3, 4, 1, 2, 3, 4, 4, 4, 3, 4, 3, 4, 4, 4];
    expect(workingSet(refs, 9, 10)).toEqual([1, 2, 5, 6, 7]);
    expect(workingSet(refs, 25, 10)).toEqual([3, 4]);
  });
  it("thrashing when total demand exceeds the frames", () => {
    expect(thrashing([5, 2, 4], 10)).toBe(true);
    expect(thrashing([5, 2, 3], 10)).toBe(false);
  });
});
