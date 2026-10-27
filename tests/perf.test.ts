import { describe, expect, it } from "vitest";
import { amdahlLimit, amdahlSpeedup, bandwidthDelayBytes, cpuBoundPool, lockSaturation, lockedThroughput, poolSize, rmBound, rmSchedulableExact, rmTest, switchOverhead, twoLevelEat, utilization } from "@/game/sim/perf";

describe("context-switch overhead", () => {
  it("is switch / (quantum + switch)", () => {
    expect(switchOverhead(10, 1)).toBeCloseTo(1 / 11, 10);
    expect(switchOverhead(1, 1)).toBe(0.5);
  });
});

describe("Amdahl's law", () => {
  it("matches Silberschatz: 75% parallel gives 1.6x on 2 cores and 2.28x on 4", () => {
    expect(amdahlSpeedup(0.25, 2)).toBeCloseTo(1.6, 10);
    expect(amdahlSpeedup(0.25, 4)).toBeCloseTo(16 / 7, 10);
  });
  it("is capped by 1 / serial", () => {
    expect(amdahlLimit(0.05)).toBe(20);
    expect(amdahlSpeedup(0.05, 1_000_000)).toBeLessThan(20);
    expect(amdahlSpeedup(0.05, 1)).toBe(1);
  });
});

describe("rate-monotonic scheduling", () => {
  it("has Liu & Layland's bounds: 1, 0.8284, 0.7798 and ln 2 in the limit", () => {
    expect(rmBound(1)).toBe(1);
    expect(rmBound(2)).toBeCloseTo(0.8284, 4);
    expect(rmBound(3)).toBeCloseTo(0.7798, 4);
    expect(rmBound(1_000_000)).toBeCloseTo(Math.LN2, 5);
  });
  it("classifies Silberschatz's tasks: P1 (20,50) + P2 (35,100) has U 0.75 under 0.8284 and RM does meet both deadlines", () => {
    const set = [{ c: 20, t: 50 }, { c: 35, t: 100 }];
    expect(utilization(set)).toBeCloseTo(0.75, 10);
    expect(rmTest(set)).toBe("guaranteed");
    expect(rmSchedulableExact(set)).toBe(true); // P2 finishes at t = 75
  });
  it("matches the book's RM failure: P1 (25,50) + P2 (35,80) has U 0.94 and P2 misses its deadline at 80 (EDF would pass)", () => {
    const set = [{ c: 25, t: 50 }, { c: 35, t: 80 }];
    expect(utilization(set)).toBeCloseTo(0.9375, 10);
    expect(rmTest(set)).toBe("inconclusive");
    expect(rmSchedulableExact(set)).toBe(false);
  });
  it("is inconclusive above the bound but may still be schedulable (harmonic periods reach U = 1)", () => {
    const harmonic = [{ c: 1, t: 2 }, { c: 2, t: 4 }];
    expect(utilization(harmonic)).toBe(1);
    expect(rmTest(harmonic)).toBe("inconclusive");
    expect(rmSchedulableExact(harmonic)).toBe(true);
    expect(rmTest([{ c: 3, t: 4 }, { c: 2, t: 4 }])).toBe("overloaded");
  });
});

describe("two-level cache EAT", () => {
  it("weights each level by who reaches it", () => {
    // 90% L1 (1 ns), 90% of the rest in L2 (10 ns), memory 100 ns: 0.9*1 + 0.1*(0.9*11 + 0.1*111)
    expect(twoLevelEat(0.9, 1, 0.9, 10, 100)).toBeCloseTo(0.9 + 0.1 * (9.9 + 11.1), 10);
    expect(twoLevelEat(1, 1, 0, 10, 100)).toBe(1);
    expect(twoLevelEat(0, 1, 0, 10, 100)).toBe(111);
  });
});

describe("thread-pool sizing", () => {
  it("follows Goetz: cores * (1 + W/C), and cores + 1 when CPU-bound", () => {
    expect(poolSize(8, 90, 10)).toBe(80);
    expect(poolSize(4, 0, 5)).toBe(4);
    expect(poolSize(8, 90, 10, 0.5)).toBe(40);
    expect(cpuBoundPool(8)).toBe(9);
  });
});

describe("lock contention throughput", () => {
  it("scales linearly until the lock saturates, then is flat at 1 / inside", () => {
    // 9 ms outside, 1 ms inside: 10 ops/s per thread, ceiling 1000 ops/s at 10 threads
    expect(lockedThroughput(1, 9, 1)).toBe(100);
    expect(lockedThroughput(5, 9, 1)).toBe(500);
    expect(lockedThroughput(10, 9, 1)).toBe(1000);
    expect(lockedThroughput(64, 9, 1)).toBe(1000);
    expect(lockSaturation(9, 1)).toBe(10);
  });
});

describe("buffer sizing", () => {
  it("is the bandwidth-delay product: 1 Gbit/s at 10 ms RTT needs 1.25 MB", () => {
    expect(bandwidthDelayBytes(1e9, 0.01)).toBe(1_250_000);
    expect(bandwidthDelayBytes(100e6, 0.08)).toBe(1_000_000);
  });
});
