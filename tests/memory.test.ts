import { describe, expect, it } from "vitest";
import { FIT_EXAMPLE, PAGING_EXAMPLE, SEGMENT_EXAMPLE, allocate, eat, externalFragmentation, hitRatioFor, internalFragmentation, outerBits, pageBits, pageTableBytes, pagesNeeded, splitTwoLevel, translate, translateSegment } from "@/game/sim/memory";

describe("contiguous allocation (Silberschatz Exercise 9.3)", () => {
  const { holes, requests } = FIT_EXAMPLE;
  const holesOf = (r: ReturnType<typeof allocate>) => r.placements.map((p) => p.hole);

  it("first fit: 212 → 500, 417 → 600, 112 → the 288 left of 500, 426 waits", () => {
    const r = allocate(holes, requests, "first");
    expect(holesOf(r)).toEqual([1, 4, 1, null]);
    expect(r.holes).toEqual([100, 176, 200, 300, 183]);
  });

  it("best fit: 212 → 300, 417 → 500, 112 → 200, 426 → 600", () => {
    const r = allocate(holes, requests, "best");
    expect(holesOf(r)).toEqual([3, 1, 2, 4]);
    expect(r.holes).toEqual([100, 83, 88, 88, 174]);
  });

  it("worst fit: 212 → 600, 417 → 500, 112 → the 388 left of 600, 426 waits", () => {
    const r = allocate(holes, requests, "worst");
    expect(holesOf(r)).toEqual([4, 1, 4, null]);
    expect(r.holes).toEqual([100, 83, 200, 300, 276]);
  });

  it("start addresses lay the holes end to end and stack blocks inside a hole", () => {
    const r = allocate([10, 20], [5, 5, 30], "first");
    expect(r.placements.map((p) => p.start)).toEqual([0, 5, null]);
    expect(allocate([10, 20], [15], "first").placements[0].start).toBe(10);
  });

  it("ties go to the lowest address, and an exact fit leaves a zero hole", () => {
    expect(allocate([50, 50], [10], "best").placements[0].hole).toBe(0);
    expect(allocate([50, 50], [10], "worst").placements[0].hole).toBe(0);
    expect(allocate([40], [40], "first").holes).toEqual([0]);
  });

  it("external fragmentation is the free memory outside the largest hole", () => {
    expect(externalFragmentation([100, 500, 200, 300, 600])).toBe(1100);
    expect(externalFragmentation([])).toBe(0);
    // 426 KB can't be placed after first fit although 100+176+200+300+183 = 959 KB is free
    expect(externalFragmentation(allocate(FIT_EXAMPLE.holes, FIT_EXAMPLE.requests, "first").holes)).toBe(959 - 300);
  });
});

describe("paging", () => {
  it("internal fragmentation: 72,766 bytes with 2,048-byte pages needs 36 pages and wastes 962 bytes (Silberschatz §9.3)", () => {
    expect(pagesNeeded(72766, 2048)).toBe(36);
    expect(internalFragmentation(72766, 2048)).toBe(962);
    expect(internalFragmentation(4096, 2048)).toBe(0);
  });

  it("the 4-byte-page example: logical 0 → 20, 3 → 23, 4 → 24, 13 → 9", () => {
    const { pageSize, table } = PAGING_EXAMPLE;
    expect(translate(0, pageSize, table).physical).toBe(20);
    expect(translate(3, pageSize, table).physical).toBe(23);
    expect(translate(4, pageSize, table).physical).toBe(24);
    expect(translate(13, pageSize, table)).toEqual({ page: 3, offset: 1, frame: 2, physical: 9 });
  });

  it("invalid pages and addresses past the table don't translate", () => {
    expect(translate(5, 4, [3, null]).physical).toBeNull();
    expect(translate(99, 4, [3, 7]).physical).toBeNull();
  });

  it("32-bit addresses with 4 KB pages: 20-bit page number, 2^20 entries, a 4 MB table of 4-byte entries", () => {
    expect(pageBits(32, 4096)).toEqual({ offsetBits: 12, pageNumberBits: 20, entries: 1048576 });
    expect(pageTableBytes(32, 4096, 4)).toBe(4 * 1024 * 1024);
  });

  it("two-level: 10 + 10 + 12 bits (Silberschatz §9.4.2)", () => {
    expect(outerBits(32, 4096, 4)).toEqual({ innerBits: 10, outerBits: 10 });
    expect(splitTwoLevel(0xffffffff, 12, 10)).toEqual({ outer: 1023, inner: 1023, offset: 4095 });
    // 0x00403004: outer 1, inner 3, offset 4
    expect(splitTwoLevel(0x00403004, 12, 10)).toEqual({ outer: 1, inner: 3, offset: 4 });
  });
});

describe("effective access time (Silberschatz §9.4.1)", () => {
  it("80% hit ratio, 100 ns memory, free TLB: 120 ns", () => {
    expect(eat(0.8, 100)).toBeCloseTo(120, 9);
  });
  it("99% hit ratio: 101 ns", () => {
    expect(eat(0.99, 100)).toBeCloseTo(101, 9);
  });
  it("a 20 ns TLB lookup, 98% hits, 100 ns memory: 122 ns", () => {
    expect(eat(0.98, 100, 20)).toBeCloseTo(122, 9);
  });
  it("hitRatioFor inverts eat", () => {
    expect(hitRatioFor(120, 100)).toBeCloseTo(0.8, 9);
    expect(eat(hitRatioFor(110, 100, 10), 100, 10)).toBeCloseTo(110, 9);
  });
});

describe("segmentation (Silberschatz §9.5)", () => {
  it("segment 2 byte 53 → 4353, segment 3 byte 852 → 4052, segment 0 byte 1222 traps", () => {
    expect(translateSegment(2, 53, SEGMENT_EXAMPLE).physical).toBe(4353);
    expect(translateSegment(3, 852, SEGMENT_EXAMPLE).physical).toBe(4052);
    expect(translateSegment(0, 1222, SEGMENT_EXAMPLE).physical).toBeNull();
  });
  it("the limit is exclusive and a missing segment traps", () => {
    expect(translateSegment(1, 399, SEGMENT_EXAMPLE).physical).toBe(6699);
    expect(translateSegment(1, 400, SEGMENT_EXAMPLE).physical).toBeNull();
    expect(translateSegment(9, 0, SEGMENT_EXAMPLE).physical).toBeNull();
  });
});
