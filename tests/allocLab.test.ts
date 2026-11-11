import { describe, expect, it } from "vitest";
import { Buddy, FreeListHeap } from "@/game/sim/allocator";
import {
  ALLOC_CHALLENGES, Allocator, HEAP_UNITS, SLAB_PAGE, STRATEGIES, externalFragmentation, gradeAllocChallenge, runTrace, type Op, type Strategy,
} from "@/game/sim/allocLab";

const A = (id: string, size: number): Op => ({ op: "alloc", id, size });
const F = (id: string): Op => ({ op: "free", id });
const passing = (id: string): Strategy[] => STRATEGIES.filter((s) => gradeAllocChallenge(ALLOC_CHALLENGES.find((c) => c.id === id)!, s).ok);

describe("segments always tile the heap", () => {
  it("covers every unit exactly once, for every strategy, after every step of every challenge", () => {
    for (const ch of ALLOC_CHALLENGES)
      for (const s of STRATEGIES)
        for (const snap of runTrace(s, ch.ops).history) {
          // used+waste+free segments must not overlap; buddy/free-list/slab account for the whole heap
          const segs = [...snap.segments].sort((a, b) => a.addr - b.addr);
          let end = 0;
          for (const g of segs) {
            expect(g.addr).toBe(end);
            end = g.addr + g.size;
          }
          expect(end).toBe(HEAP_UNITS);
        }
  });
});

describe("free-list strategies", () => {
  it("match FreeListHeap placement", () => {
    for (const policy of ["first", "best", "worst"] as const) {
      const heap = new FreeListHeap(HEAP_UNITS);
      const a = new Allocator(policy);
      for (const op of ALLOC_CHALLENGES[0].ops) {
        if (op.op === "alloc") expect(a.apply(op).addr).toBe(heap.malloc(op.id, op.size, policy));
        else {
          heap.free(op.id);
          a.apply(op);
        }
      }
    }
  });
  it("report the largest hole and fragmentation", () => {
    const r = runTrace("first", [A("a", 10), A("b", 10), A("c", 10), F("b")]);
    expect(r.final.largestFree).toBe(34);
    expect(r.final.freeUnits).toBe(44);
    expect(externalFragmentation(r.final)).toBeCloseTo(1 - 34 / 44);
  });
  it("explains a failed allocation and rejects bad operations", () => {
    const r = runTrace("first", [A("a", 60), A("b", 9), F("zz"), A("a", 1), A("c", 0)]);
    expect(r.results[1]).toMatchObject({ ok: false, why: "no hole of 9; largest is 4" });
    expect(r.results[2].ok).toBe(false);
    expect(r.results[3].why).toMatch(/already allocated/);
    expect(r.results[4].ok).toBe(false);
    expect(r.failures).toBe(1 + 1 + 1); // b, the duplicate a and the zero-size c all count as failed allocs
  });
});

describe("buddy strategy", () => {
  it("reproduces the textbook 21 KB request from a 256 KB segment (Silberschatz 10.8.1)", () => {
    const a = new Allocator("buddy", 256);
    expect(a.apply(A("r", 21))).toMatchObject({ ok: true, addr: 0 });
    const s = a.snapshot();
    expect(s.internalWaste).toBe(11); // 32 - 21
    expect(s.segments.filter((g) => g.kind === "free").map((g) => [g.addr, g.size])).toEqual([[32, 32], [64, 64], [128, 128]]);
    expect(new Buddy(256).alloc("r", 21)?.block).toBe(32);
  });
  it("coalesces back to one block after everything is freed", () => {
    const r = runTrace("buddy", [A("a", 5), A("b", 9), A("c", 3), F("a"), F("b"), F("c")]);
    expect(r.final.segments).toEqual([{ addr: 0, size: 64, kind: "free" }]);
  });
});

describe("slab strategy", () => {
  it("rounds to a size class and fills a slab page before opening another", () => {
    const a = new Allocator("slab");
    const addrs = Array.from({ length: 6 }, (_, i) => a.apply(A(`o${i}`, 3)).addr);
    expect(addrs).toEqual([0, 4, 8, 12, 16, 20]); // class 4: four slots per 16-unit page
    expect(a.snapshot().internalWaste).toBe(6);
  });
  it("hands an emptied page back to the pool so another class can use it", () => {
    const ops: Op[] = [...Array.from({ length: 4 }, (_, i) => A(`s${i}`, 4)), ...Array.from({ length: 4 }, (_, i) => F(`s${i}`)), A("big", 8)];
    const r = runTrace("slab", ops);
    expect(r.failures).toBe(0);
    expect(r.final.segments.filter((g) => g.kind === "free").length).toBe(HEAP_UNITS / SLAB_PAGE - 1 + 1); // 3 free pages + 1 free slot
  });
  it("refuses objects above the largest class and exhausts its page pool", () => {
    expect(runTrace("slab", [A("x", 9)]).results[0].why).toMatch(/largest slab class/);
    const r = runTrace("slab", [...Array.from({ length: 8 }, (_, i) => A(`a${i}`, 8))]);
    expect(r.failures).toBe(0);
    const over = runTrace("slab", [...Array.from({ length: 9 }, (_, i) => A(`a${i}`, 8))]);
    expect(over.results[8].why).toMatch(/no free page/);
  });
});

describe("challenges", () => {
  it("each is solved by exactly the intended strategies", () => {
    expect(passing("tight-hole")).toEqual(["best"]);
    expect(passing("keep-leftovers")).toEqual(["worst"]);
    expect(passing("first-hole-wins")).toEqual(["first"]);
    expect(passing("round-up-cost")).toEqual(["first", "best", "worst"]);
    expect(passing("too-big-for-slab")).toEqual(["first", "best", "worst", "buddy"]);
    expect(passing("merge-back")).toEqual(["first", "best", "worst", "buddy"]);
  });
  it("has unique ids and every trace frees only what it allocated", () => {
    expect(new Set(ALLOC_CHALLENGES.map((c) => c.id)).size).toBe(ALLOC_CHALLENGES.length);
    for (const ch of ALLOC_CHALLENGES) {
      const live = new Set<string>();
      for (const op of ch.ops) {
        if (op.op === "alloc") {
          expect(live.has(op.id)).toBe(false);
          live.add(op.id);
        } else expect(live.delete(op.id)).toBe(true);
      }
    }
  });
});
