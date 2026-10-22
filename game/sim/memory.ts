/**
 * Memory-management simulators (Silberschatz ch. 9): contiguous allocation
 * (first/best/worst fit), paging and address translation, multi-level and
 * inverted page tables, TLB effective access time and segmentation. The tests
 * check them against the textbook's worked examples.
 */

export type Fit = "first" | "best" | "worst";

export interface Hole {
  start: number;
  size: number;
}

export interface Placement {
  /** the process's index in the request list */
  process: number;
  size: number;
  /** where it was placed, or null if no hole was big enough */
  start: number | null;
  /** which hole (by position in the free list when it was chosen) */
  hole: number | null;
}

export interface AllocationResult {
  placements: Placement[];
  /** the free list after every request, merged and sorted by address */
  holes: Hole[];
}

/** Sort by address and merge neighbours that touch. */
export function coalesce(holes: readonly Hole[]): Hole[] {
  const out: Hole[] = [];
  for (const h of [...holes].sort((a, b) => a.start - b.start)) {
    if (h.size <= 0) continue;
    const last = out.at(-1);
    if (last && last.start + last.size === h.start) last.size += h.size;
    else out.push({ ...h });
  }
  return out;
}

/** The index of the hole a policy picks for `size` bytes, or -1. Ties go to the lowest address. */
export function pickHole(holes: readonly Hole[], size: number, fit: Fit): number {
  let pick = -1;
  holes.forEach((h, i) => {
    if (h.size < size) return;
    if (pick < 0) pick = i;
    else if (fit === "best" && h.size < holes[pick].size) pick = i;
    else if (fit === "worst" && h.size > holes[pick].size) pick = i;
  });
  return pick;
}

/**
 * Place each request in turn (nobody leaves). `holes` is given in address
 * order, as in the textbook, which is the order "first fit" scans.
 */
export function allocate(holes: readonly Hole[], requests: readonly number[], fit: Fit): AllocationResult {
  let free = coalesce(holes);
  const placements: Placement[] = [];
  requests.forEach((size, process) => {
    const i = pickHole(free, size, fit);
    if (i < 0) {
      placements.push({ process, size, start: null, hole: null });
      return;
    }
    const h = free[i];
    placements.push({ process, size, start: h.start, hole: i });
    free = free.map((x, j) => (j === i ? { start: x.start + size, size: x.size - size } : x)).filter((x) => x.size > 0);
  });
  return { placements, holes: free };
}

/** External fragmentation: free memory that exists but can't satisfy a request of `size`. */
export function externalFragmentation(holes: readonly Hole[], size: number): { free: number; largest: number; fits: boolean; wasted: number } {
  const free = holes.reduce((a, h) => a + h.size, 0);
  const largest = holes.reduce((a, h) => Math.max(a, h.size), 0);
  const fits = largest >= size;
  return { free, largest, fits, wasted: !fits && free >= size ? free : 0 };
}

/** Compaction: slide every process to the bottom; one hole of all the free memory remains. */
export function compact(total: number, used: number): Hole[] {
  return total > used ? [{ start: used, size: total - used }] : [];
}

export interface Pages {
  /** whole pages needed */
  pages: number;
  /** bytes used in the last page (0 means the last page is full) */
  lastUsed: number;
  /** bytes wasted at the end of the last page */
  internalFragmentation: number;
}

export function pagesFor(size: number, pageSize: number): Pages {
  const pages = Math.ceil(size / pageSize);
  const lastUsed = size % pageSize;
  return { pages, lastUsed, internalFragmentation: lastUsed === 0 ? 0 : pageSize - lastUsed };
}

const isPow2 = (n: number) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
export const log2 = (n: number): number => {
  if (!isPow2(n)) throw new Error(`${n} is not a power of two`);
  return Math.log2(n);
};

export interface Translation {
  page: number;
  offset: number;
  /** the frame the page table maps to, or null if the page isn't mapped */
  frame: number | null;
  physical: number | null;
}

/** Split a logical address into page number and offset, and map it through a page table (`null` = invalid). */
export function translate(logical: number, pageSize: number, table: readonly (number | null)[]): Translation {
  log2(pageSize);
  const page = Math.floor(logical / pageSize);
  const offset = logical % pageSize;
  const frame = table[page] ?? null;
  return { page, offset, frame, physical: frame === null ? null : frame * pageSize + offset };
}

export interface AddressBits {
  /** bits in the logical address */
  logical: number;
  offset: number;
  /** bits of page number across all levels */
  pageNumber: number;
  /** bits per level, outermost first */
  levels: number[];
}

/**
 * Split an address of `addressBits` into outer-to-inner page-table indices
 * for `levels` levels. Each inner table fills exactly one page (entries of
 * `entryBytes`), and the outermost level takes whatever bits remain, as in
 * Silberschatz's 32-bit, 4 KB-page, 4-byte-entry example (10 + 10 + 12).
 */
export function splitAddress(addressBits: number, pageSize: number, levels: number, entryBytes: number): AddressBits {
  const offset = log2(pageSize);
  const perLevel = log2(pageSize / entryBytes);
  const pageNumber = addressBits - offset;
  const bits: number[] = [];
  let left = pageNumber;
  for (let i = 0; i < levels - 1; i++) {
    const b = Math.min(perLevel, left);
    bits.unshift(b);
    left -= b;
  }
  bits.unshift(left);
  return { logical: addressBits, offset, pageNumber, levels: bits };
}

/** The index at each level of an address (outermost first) and its offset. */
export function walkIndices(logical: number, split: AddressBits): { indices: number[]; offset: number } {
  const offset = logical % 2 ** split.offset;
  let rest = Math.floor(logical / 2 ** split.offset);
  const indices: number[] = [];
  for (let i = split.levels.length - 1; i >= 0; i--) {
    indices.unshift(rest % 2 ** split.levels[i]);
    rest = Math.floor(rest / 2 ** split.levels[i]);
  }
  return { indices, offset };
}

/** Bytes of a single-level page table: one entry for every page of the address space. */
export const pageTableBytes = (addressBits: number, pageSize: number, entryBytes: number): number => 2 ** (addressBits - log2(pageSize)) * entryBytes;

/** Inverted page table: one entry per frame holding (pid, page); the frame is the entry's index. */
export function invertedLookup(table: readonly ({ pid: number; page: number } | null)[], pid: number, page: number): { frame: number | null; probes: number } {
  for (let i = 0; i < table.length; i++) {
    const e = table[i];
    if (e && e.pid === pid && e.page === page) return { frame: i, probes: i + 1 };
  }
  return { frame: null, probes: table.length };
}

/**
 * Effective access time with a TLB. A hit costs the TLB search plus one
 * memory access; a miss costs the search plus `levels` page-table accesses
 * plus the access itself (Silberschatz §9.3.2: 80% hit, 20 ns TLB, 100 ns
 * memory → 140 ns).
 */
export function effectiveAccessTime(hitRatio: number, tlbTime: number, memTime: number, levels = 1): number {
  const hit = tlbTime + memTime;
  const miss = tlbTime + memTime * (levels + 1);
  return hitRatio * hit + (1 - hitRatio) * miss;
}

/** The hit ratio that gives a target effective access time (inverse of the formula above). */
export function hitRatioFor(target: number, tlbTime: number, memTime: number, levels = 1): number {
  const hit = tlbTime + memTime;
  const miss = tlbTime + memTime * (levels + 1);
  return (miss - target) / (miss - hit);
}

export interface Segment {
  base: number;
  limit: number;
}

export type SegmentResult = { ok: true; physical: number } | { ok: false; trap: "no-such-segment" | "beyond-limit" };

/** Segmentation: the offset must be below the segment's limit, then physical = base + offset. */
export function translateSegment(table: readonly Segment[], segment: number, offset: number): SegmentResult {
  const s = table[segment];
  if (!s) return { ok: false, trap: "no-such-segment" };
  if (offset < 0 || offset >= s.limit) return { ok: false, trap: "beyond-limit" };
  return { ok: true, physical: s.base + offset };
}

/** The textbook's free list for the fit example (§9.2.2 / exercise 9.x): 100K, 500K, 200K, 300K and 600K holes. */
export const FIT_EXAMPLE: { holes: Hole[]; requests: number[] } = {
  holes: [
    { start: 1000, size: 100 },
    { start: 2000, size: 500 },
    { start: 3000, size: 200 },
    { start: 4000, size: 300 },
    { start: 5000, size: 600 },
  ],
  requests: [212, 417, 112, 426],
};

/** Silberschatz Figure 9.8: five segments. */
export const SEGMENT_EXAMPLE: Segment[] = [
  { base: 1400, limit: 1000 },
  { base: 6300, limit: 400 },
  { base: 4300, limit: 400 },
  { base: 3200, limit: 1000 },
  { base: 4700, limit: 1000 },
];
