import { describe, expect, it } from "vitest";
import { alternatingWrites, coherenceMisses, runFutex, waitCost, writeTime } from "@/game/sim/contention";

describe("false sharing", () => {
  it("two counters in one 64-byte line miss on every alternating write", () => {
    const w = alternatingWrites(0, 8, 500);
    expect(w).toHaveLength(1000);
    expect(coherenceMisses(w)).toBe(1000);
  });

  it("padding each counter to its own line leaves only the two cold misses", () => {
    expect(coherenceMisses(alternatingWrites(0, 64, 500))).toBe(2);
    expect(coherenceMisses(alternatingWrites(0, 63, 500))).toBe(1000); // still the same line
    expect(coherenceMisses(alternatingWrites(0, 64, 500), 128)).toBe(1000); // 128-byte lines
  });

  it("one core writing alone misses once", () => {
    expect(coherenceMisses(Array.from({ length: 10 }, () => ({ core: 0, addr: 0 })))).toBe(1);
  });

  it("time model: padding is far faster", () => {
    const shared = writeTime(1000, 1000, 1, 60);
    const padded = writeTime(2, 1000, 1, 60);
    expect(shared).toBe(60000);
    expect(padded).toBe(1118);
    expect(shared / padded).toBeGreaterThan(50);
  });
});

describe("futex mutex (Drepper mutex2)", () => {
  it("uncontended lock/unlock never enters the kernel", () => {
    const r = runFutex(Array.from({ length: 1000 }, (_, i) => ({ t: "A", op: i % 2 ? "unlock" : "lock" }) as const));
    expect(r.waits + r.wakes).toBe(0);
    expect(r.fastLocks).toBe(500);
    expect(r.fastUnlocks).toBe(500);
    expect(r.holder).toBeNull();
  });

  it("a contended handoff costs one wait and one wake", () => {
    const r = runFutex([
      { t: "A", op: "lock" },
      { t: "B", op: "lock" },
      { t: "A", op: "unlock" },
    ]);
    expect(r.states).toEqual([1, 2, 2]);
    expect(r.waits).toBe(1);
    expect(r.wakes).toBe(1);
    expect(r.holder).toBe("B");
  });

  it("the woken thread assumes sleepers remain, so its unlock also wakes (a harmless extra call)", () => {
    const r = runFutex([
      { t: "A", op: "lock" },
      { t: "B", op: "lock" },
      { t: "A", op: "unlock" },
      { t: "B", op: "unlock" },
    ]);
    expect(r.wakes).toBe(2);
    expect(r.holder).toBeNull();
  });

  it("three threads queue in order", () => {
    const r = runFutex([
      { t: "A", op: "lock" },
      { t: "B", op: "lock" },
      { t: "C", op: "lock" },
    ]);
    expect(r.sleeping).toEqual(["B", "C"]);
    expect(r.waits).toBe(2);
  });

  it("rejects unlocking a lock you do not hold", () => {
    expect(() => runFutex([{ t: "A", op: "unlock" }])).toThrow();
  });
});

describe("spin or sleep", () => {
  it("spinning wins when the hold time is shorter than a sleep and wake", () => {
    expect(waitCost(200, 3000).spinWins).toBe(true);
    expect(waitCost(50000, 3000).spinWins).toBe(false);
  });
});
