import { describe, expect, it } from "vitest";
import { Buddy, FreeListHeap, MMAP_THRESHOLD, mallocSource } from "@/game/sim/allocator";

describe("brk vs mmap", () => {
  it("uses the brk heap below the 128 KiB threshold and mmap at or above it", () => {
    expect(mallocSource(100)).toBe("brk");
    expect(mallocSource(MMAP_THRESHOLD - 1)).toBe("brk");
    expect(mallocSource(MMAP_THRESHOLD)).toBe("mmap");
    expect(mallocSource(1 << 20)).toBe("mmap");
  });
});

describe("free-list heap", () => {
  it("splits a hole and coalesces neighbours on free", () => {
    const h = new FreeListHeap(100);
    expect(h.malloc("A", 30)).toBe(0);
    expect(h.malloc("B", 30)).toBe(30);
    expect(h.malloc("C", 30)).toBe(60);
    h.free("B");
    expect(h.chunks.map((c) => c.size)).toEqual([30, 30, 30, 10]);
    h.free("A");
    expect(h.chunks.map((c) => c.size)).toEqual([60, 30, 10]);
    h.free("C");
    expect(h.chunks).toEqual([{ addr: 0, size: 100, id: null }]);
  });

  it("shows external fragmentation: enough free bytes, no hole big enough", () => {
    const h = new FreeListHeap(100);
    for (const [id, n] of [["A", 30], ["B", 30], ["C", 30]] as const) h.malloc(id, n);
    h.free("A");
    h.free("C");
    expect(h.freeBytes).toBe(70);
    expect(h.largestHole).toBe(40);
    expect(h.malloc("D", 50)).toBeNull();
    expect(h.externalFragmentation).toBeCloseTo(30 / 70);
  });

  // Silberschatz §9.2.2 style: holes of 100, 500, 200, 300, 600 KB; requests 212, 417, 112, 426 KB.
  const holes = () => {
    const h = new FreeListHeap(1700 + 1000);
    // lay out: hole, used, hole, used, ... so the holes are separate
    const sizes = [100, 500, 200, 300, 600];
    sizes.forEach((s, i) => {
      h.malloc(`h${i}`, s);
      h.malloc(`w${i}`, 100);
    });
    sizes.forEach((_, i) => h.free(`h${i}`));
    return h;
  };
  it("first, best and worst fit pick different holes (textbook holes 100,500,200,300,600)", () => {
    // first fit takes the 500 hole (address 200), best fit the 300 hole, worst fit the 600 hole
    const addrOf = (p: "first" | "best" | "worst") => holes().malloc("p", 212, p);
    expect(addrOf("first")).toBe(200);
    expect(addrOf("best")).toBe(200 + 500 + 100 + 200 + 100);
    expect(addrOf("worst")).toBe(200 + 500 + 100 + 200 + 100 + 300 + 100);
  });

  it("rejects bad sizes and unknown frees", () => {
    const h = new FreeListHeap(10);
    expect(() => h.malloc("A", 0)).toThrow();
    expect(() => h.free("zzz")).toThrow();
  });
});

describe("buddy system", () => {
  it("serves 21 KB from 256 KB with a 32 KB block after three halvings (Silberschatz)", () => {
    const b = new Buddy(256, 1);
    const g = b.alloc("A", 21)!;
    expect(g).toEqual({ addr: 0, block: 32, splits: 3, wasted: 11 });
    expect(b.freeBlocks()).toEqual([[32, 32], [64, 64], [128, 128]]);
  });

  it("coalesces freed buddies back into the whole segment", () => {
    const b = new Buddy(256);
    b.alloc("A", 21);
    b.alloc("B", 30);
    expect(b.release("A")).toBe(0); // B still holds A's buddy
    expect(b.release("B")).toBe(3);
    expect(b.freeBlocks()).toEqual([[0, 256]]);
  });

  it("does not merge blocks that are adjacent but not buddies", () => {
    const b = new Buddy(64);
    b.alloc("A", 16); // 0
    b.alloc("B", 16); // 16
    b.alloc("C", 16); // 32
    b.release("B");
    b.release("C");
    // 16 and 32 are adjacent free blocks of size 16 but have different buddies
    expect(b.freeBlocks().filter(([, s]) => s === 16).map(([a]) => a)).toContain(16);
    expect(b.freeBlocks().some(([a, s]) => a === 16 && s === 32)).toBe(false);
  });

  it("returns null when nothing big enough is free and honours minBlock", () => {
    const b = new Buddy(64, 8);
    expect(b.alloc("A", 3)!.block).toBe(8);
    expect(b.alloc("big", 64)).toBeNull();
    expect(() => new Buddy(100)).toThrow();
  });
});
