import { describe, expect, it } from "vitest";
import { BANKER_EXAMPLE, DETECT_EXAMPLE, detect, findCycle, isCycleNodes, isSafeSequence, need, request, safety, walkSequence } from "@/game/sim/deadlock";

describe("resource-allocation graph cycles", () => {
  it("finds a cycle and none in a chain", () => {
    expect(findCycle([["P1", "R1"], ["R1", "P2"], ["P2", "R2"], ["R2", "P1"]])).toEqual(["P1", "R1", "P2", "R2", "P1"]);
    expect(findCycle([["P1", "R1"], ["R1", "P2"], ["P2", "R2"]])).toBeNull();
    expect(findCycle([])).toBeNull();
  });
  it("ignores a dead-end branch before the cycle", () => {
    expect(findCycle([["A", "B"], ["A", "C"], ["C", "D"], ["D", "C"]])).toEqual(["C", "D", "C"]);
  });
});

describe("Banker's algorithm (Silberschatz §8.6.3.3)", () => {
  it("need matrix", () => {
    expect(need(BANKER_EXAMPLE)).toEqual([[7, 4, 3], [1, 2, 2], [6, 0, 0], [0, 1, 1], [4, 3, 1]]);
  });
  it("is safe with the textbook sequence <P1, P3, P4, P0, P2>", () => {
    const r = safety(BANKER_EXAMPLE);
    expect(r.safe).toBe(true);
    expect(r.sequence).toEqual([1, 3, 4, 0, 2]);
    expect(r.work.at(-1)).toEqual([10, 5, 7]);
    expect(isSafeSequence(BANKER_EXAMPLE, [1, 3, 4, 0, 2])).toBe(true);
    expect(isSafeSequence(BANKER_EXAMPLE, [0, 1, 2, 3, 4])).toBe(false);
  });
  it("P1 requesting (1,0,2) is granted", () => {
    const r = request(BANKER_EXAMPLE, 1, [1, 0, 2]);
    if (!r.granted) throw new Error("should be granted");
    expect(r.state.available).toEqual([2, 3, 0]);
    expect(r.state.allocation[1]).toEqual([3, 0, 2]);
    expect(r.sequence).toEqual([1, 3, 4, 0, 2]);
  });
  it("P4 (3,3,0) is not available; P0 (0,2,0) is unsafe; asking beyond need is refused", () => {
    const after = (request(BANKER_EXAMPLE, 1, [1, 0, 2]) as { state: typeof BANKER_EXAMPLE }).state;
    expect(request(after, 4, [3, 3, 0])).toEqual({ granted: false, reason: "not-available" });
    expect(request(after, 0, [0, 2, 0])).toEqual({ granted: false, reason: "unsafe" });
    expect(request(BANKER_EXAMPLE, 1, [2, 0, 0])).toEqual({ granted: false, reason: "exceeds-need" });
  });
  it("an unsafe state reports the processes that can finish", () => {
    const s = { ...BANKER_EXAMPLE, available: [0, 0, 0] };
    const r = safety(s);
    expect(r.safe).toBe(false);
    expect(r.sequence).toEqual([]);
  });
});

describe("detection (Silberschatz §8.6.2)", () => {
  const { available, allocation, requests } = DETECT_EXAMPLE;
  it("finds no deadlock in the textbook state", () => {
    expect(detect(available, allocation, requests)).toEqual([]);
  });
  it("P2 asking for one more C deadlocks P1–P4", () => {
    const r = requests.map((x, i) => (i === 2 ? [0, 0, 1] : x));
    expect(detect(available, allocation, r)).toEqual([1, 2, 3, 4]);
  });
});

describe("walkSequence", () => {
  it("tracks Work along the textbook sequence", () => {
    const w = walkSequence(BANKER_EXAMPLE, [1, 3, 4, 0, 2]);
    expect(w.ok).toEqual([true, true, true, true, true]);
    expect(w.before).toEqual([[3, 3, 2], [5, 3, 2], [7, 4, 3], [7, 4, 5], [7, 5, 5]]);
    expect(w.work).toEqual([10, 5, 7]);
  });
  it("marks a pick whose Need doesn't fit and adds nothing for it", () => {
    const w = walkSequence(BANKER_EXAMPLE, [0, 1]);
    expect(w.ok).toEqual([false, true]);
    expect(w.work).toEqual([5, 3, 2]);
  });
  it("agrees with isSafeSequence on every permutation of the example", () => {
    const perms = (a: number[]): number[][] => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    for (const p of perms([0, 1, 2, 3, 4])) expect(walkSequence(BANKER_EXAMPLE, p).ok.every(Boolean), p.join()).toBe(isSafeSequence(BANKER_EXAMPLE, p));
  });
});

describe("isCycleNodes", () => {
  const edges = [["P1", "R1"], ["R1", "P2"], ["P2", "R2"], ["R2", "P1"], ["P3", "R1"], ["R3", "P3"]] as const;
  it("accepts exactly the nodes of a cycle", () => {
    expect(isCycleNodes(edges, ["R2", "P1", "R1", "P2"])).toBe(true);
  });
  it("rejects a subset, a superset and duplicates", () => {
    expect(isCycleNodes(edges, ["P1", "R1", "P2"])).toBe(false);
    expect(isCycleNodes(edges, ["P1", "R1", "P2", "R2", "P3"])).toBe(false);
    expect(isCycleNodes(edges, ["P1", "P1"])).toBe(false);
    expect(isCycleNodes(edges, [])).toBe(false);
  });
});
