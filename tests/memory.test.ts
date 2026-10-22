import { describe, expect, it } from "vitest";
import {
  FIT_EXAMPLE, SEGMENT_EXAMPLE, allocate, coalesce, compact, effectiveAccessTime, externalFragmentation, hitRatioFor,
  invertedLookup, log2, pageTableBytes, pagesFor, pickHole, splitAddress, translate, translateSegment, walkIndices,
} from "@/game/sim/memory";

const where = (fit: "first" | "best" | "worst") => allocate(FIT_EXAMPLE.holes, FIT_EXAMPLE.requests, fit).placements.map((p) => p.start);

describe("contiguous allocation (Silberschatz exercise: holes 100K 500K 200K 300K 600K; 212K 417K 112K 426K)", () => {
  it("first fit: 212→500K, 417→600K, 112→the 288K left over, 426 waits", () => {
    expect(where("first")).toEqual([2000, 5000, 2212, null]);
  });
  it("best fit: 212→300K, 417→500K, 112→200K, 426→600K, all four placed", () => {
    expect(where("best")).toEqual([4000, 2000, 3000, 5000]);
  });
  it("worst fit: 212→600K, 417→500K, 112→the 388K left, 426 waits", () => {
    expect(where("worst")).toEqual([5000, 2000, 5212, null]);
  });
  it("leaves the right holes behind", () => {
    expect(allocate(FIT_EXAMPLE.holes, FIT_EXAMPLE.requests, "best").holes.map((h) => h.size)).toEqual([100, 83, 88, 88, 174]);
    expect(allocate(FIT_EXAMPLE.holes, FIT_EXAMPLE.requests, "first").holes.map((h) => h.size)).toEqual([100, 176, 200, 300, 183]);
    expect(allocate(FIT_EXAMPLE.holes, FIT_EXAMPLE.requests, "worst").holes.map((h) => h.size)).toEqual([100, 83, 200, 300, 276]);
  });
  it("ties go to the lowest address and nothing is placed twice", () => {
    expect(pickHole([{ start: 0, size: 50 }, { start: 100, size: 50 }], 50, "best")).toBe(0);
    expect(pickHole([{ start: 0, size: 10 }], 11, "first")).toBe(-1);
  });
  it("random workloads never overlap or overshoot", () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
    for (let t = 0; t < 200; t++) {
      const holes = Array.from({ length: 5 }, (_, i) => ({ start: i * 1000, size: 50 + rnd(400) }));
      const reqs = Array.from({ length: 6 }, () => 10 + rnd(300));
      for (const fit of ["first", "best", "worst"] as const) {
        const r = allocate(holes, reqs, fit);
        const used = r.placements.filter((p) => p.start !== null);
        for (const p of used) {
          expect(holes.some((h) => p.start! >= h.start && p.start! + p.size <= h.start + h.size)).toBe(true);
        }
        for (let i = 0; i < used.length; i++)
          for (let j = i + 1; j < used.length; j++)
            expect(used[i].start! + used[i].size <= used[j].start! || used[j].start! + used[j].size <= used[i].start!).toBe(true);
        const free = holes.reduce((a, h) => a + h.size, 0) - used.reduce((a, p) => a + p.size, 0);
        expect(r.holes.reduce((a, h) => a + h.size, 0)).toBe(free);
      }
    }
  });
});

describe("holes and fragmentation", () => {
  it("coalesce merges touching holes only", () => {
    expect(coalesce([{ start: 200, size: 50 }, { start: 100, size: 100 }, { start: 300, size: 10 }])).toEqual([{ start: 100, size: 150 }, { start: 300, size: 10 }]);
  });
  it("external fragmentation: enough total, no single hole", () => {
    const f = externalFragmentation([{ start: 0, size: 100 }, { start: 300, size: 200 }, { start: 700, size: 150 }], 400);
    expect(f).toEqual({ free: 450, largest: 200, fits: false, wasted: 450 });
    expect(externalFragmentation([{ start: 0, size: 500 }], 400).fits).toBe(true);
  });
  it("compaction leaves one hole", () => {
    expect(compact(1000, 640)).toEqual([{ start: 640, size: 360 }]);
    expect(compact(1000, 1000)).toEqual([]);
  });
  it("internal fragmentation (Silberschatz §9.3.2: 72,766 bytes, 2,048-byte pages)", () => {
    expect(pagesFor(72766, 2048)).toEqual({ pages: 36, lastUsed: 1086, internalFragmentation: 962 });
    expect(pagesFor(4096, 2048).internalFragmentation).toBe(0);
  });
});

describe("paging", () => {
  it("log2 of powers of two, and a refusal otherwise", () => {
    expect(log2(4096)).toBe(12);
    expect(() => log2(3000)).toThrow();
  });
  it("splits an address and maps it through the page table", () => {
    const t = translate(20000, 4096, [9, 3, 7, 1, 5]);
    expect(t).toEqual({ page: 4, offset: 3616, frame: 5, physical: 5 * 4096 + 3616 });
  });
  it("the 4-byte-page, 32-byte-memory example (Figure 9.10): logical 13 is in page 3, offset 1 → frame 2 → physical 9", () => {
    const table = [5, 6, 1, 2];
    expect(translate(0, 4, table).physical).toBe(20);
    expect(translate(3, 4, table).physical).toBe(23);
    expect(translate(4, 4, table).physical).toBe(24);
    expect(translate(13, 4, table).physical).toBe(2 * 4 + 1);
  });
  it("an unmapped page is invalid", () => {
    expect(translate(9000, 4096, [1, 2, null])).toMatchObject({ page: 2, frame: null, physical: null });
    expect(translate(99999, 4096, [1, 2]).frame).toBeNull();
  });
  it("round trip: every logical address maps to frame*size+offset", () => {
    const table = [4, 0, 6, 2, 7, 1, 5, 3];
    for (let a = 0; a < 8 * 256; a += 17) {
      const t = translate(a, 256, table);
      expect(t.physical! % 256).toBe(a % 256);
      expect(Math.floor(t.physical! / 256)).toBe(table[Math.floor(a / 256)]);
    }
  });
});

describe("multi-level and inverted page tables", () => {
  it("32-bit, 4 KB pages, 4-byte entries: single-level table is 4 MB", () => {
    expect(pageTableBytes(32, 4096, 4)).toBe(4 * 1024 * 1024);
  });
  it("two-level split is 10 + 10 + 12 (Silberschatz §9.4.2)", () => {
    expect(splitAddress(32, 4096, 2, 4)).toEqual({ logical: 32, offset: 12, pageNumber: 20, levels: [10, 10] });
  });
  it("64-bit with 4 KB pages needs more levels, the outermost taking the leftover bits", () => {
    expect(splitAddress(48, 4096, 4, 8)).toEqual({ logical: 48, offset: 12, pageNumber: 36, levels: [9, 9, 9, 9] });
    expect(splitAddress(32, 4096, 3, 4).levels).toEqual([0, 10, 10]);
  });
  it("walkIndices matches shifting and masking", () => {
    const s = splitAddress(32, 4096, 2, 4);
    const a = 0x12345678;
    expect(walkIndices(a, s)).toEqual({ indices: [(a >>> 22) & 0x3ff, (a >>> 12) & 0x3ff], offset: a & 0xfff });
  });
  it("inverted table: frame is the index of the match; the search cost grows with the index", () => {
    const t = [{ pid: 1, page: 0 }, { pid: 2, page: 5 }, null, { pid: 1, page: 3 }];
    expect(invertedLookup(t, 1, 3)).toEqual({ frame: 3, probes: 4 });
    expect(invertedLookup(t, 2, 5)).toEqual({ frame: 1, probes: 2 });
    expect(invertedLookup(t, 3, 0)).toEqual({ frame: null, probes: 4 });
  });
});

describe("TLB effective access time", () => {
  it("80% hits, 20 ns TLB, 100 ns memory → 140 ns (Silberschatz §9.3.2)", () => {
    expect(effectiveAccessTime(0.8, 20, 100)).toBeCloseTo(140);
  });
  it("98% hits → 122 ns", () => {
    expect(effectiveAccessTime(0.98, 20, 100)).toBeCloseTo(122);
  });
  it("the gym's 80% / 100 ns / free TLB is 120 ns", () => {
    expect(effectiveAccessTime(0.8, 0, 100)).toBeCloseTo(120);
  });
  it("a two-level table makes a miss cost three accesses", () => {
    expect(effectiveAccessTime(0.9, 0, 100, 2)).toBeCloseTo(0.9 * 100 + 0.1 * 300);
  });
  it("hitRatioFor inverts it", () => {
    expect(hitRatioFor(140, 20, 100)).toBeCloseTo(0.8);
    for (const h of [0.5, 0.9, 0.99]) expect(hitRatioFor(effectiveAccessTime(h, 10, 80, 2), 10, 80, 2)).toBeCloseTo(h);
  });
});

describe("segmentation (Silberschatz Figure 9.8)", () => {
  it("segment 2, byte 53 → 4300 + 53 = 4353", () => {
    expect(translateSegment(SEGMENT_EXAMPLE, 2, 53)).toEqual({ ok: true, physical: 4353 });
  });
  it("segment 3, byte 852 → 3200 + 852 = 4052", () => {
    expect(translateSegment(SEGMENT_EXAMPLE, 3, 852)).toEqual({ ok: true, physical: 4052 });
  });
  it("segment 0, byte 1222 traps: the limit is 1000", () => {
    expect(translateSegment(SEGMENT_EXAMPLE, 0, 1222)).toEqual({ ok: false, trap: "beyond-limit" });
    expect(translateSegment(SEGMENT_EXAMPLE, 1, 400)).toEqual({ ok: false, trap: "beyond-limit" });
    expect(translateSegment(SEGMENT_EXAMPLE, 1, 399)).toEqual({ ok: true, physical: 6699 });
  });
  it("a missing segment traps", () => {
    expect(translateSegment(SEGMENT_EXAMPLE, 7, 0)).toEqual({ ok: false, trap: "no-such-segment" });
  });
});
