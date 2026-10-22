/**
 * Memory-management simulators: contiguous allocation (first/best/worst fit),
 * fragmentation, paging and multi-level address translation, TLB effective
 * access time, and segmentation. Checked against Silberschatz, Operating
 * System Concepts (10th ed.), ch. 9 in tests/memory.test.ts.
 */
export type Fit = "first" | "best" | "worst";

export interface Placement {
  /** the request's size */
  size: number;
  /** index into the original hole list, or null when no hole is big enough */
  hole: number | null;
  /** the address the block starts at (relative to the hole list laid end to end), or null */
  start: number | null;
}

export interface AllocResult {
  placements: Placement[];
  /** hole sizes after every request has been tried (a hole used up exactly stays as 0) */
  holes: number[];
}

/**
 * Place each request, in order, into the hole picked by `fit`:
 * first = the lowest-addressed hole big enough, best = the smallest big enough
 * (ties to the lowest address), worst = the largest (ties to the lowest address).
 * The block takes the start of the hole; the rest stays a smaller hole.
 */
export function allocate(holes: readonly number[], requests: readonly number[], fit: Fit): AllocResult {
  const left = [...holes];
  const origin: number[] = [];
  let at = 0;
  for (const h of holes) {
    origin.push(at);
    at += h;
  }
  const used = holes.map(() => 0);
  const placements: Placement[] = [];
  for (const size of requests) {
    let pick = -1;
    for (let i = 0; i < left.length; i++) {
      if (left[i] < size) continue;
      if (pick < 0 || (fit === "best" && left[i] < left[pick]) || (fit === "worst" && left[i] > left[pick])) pick = i;
      if (fit === "first") break;
    }
    if (pick < 0) {
      placements.push({ size, hole: null, start: null });
      continue;
    }
    placements.push({ size, hole: pick, start: origin[pick] + used[pick] });
    used[pick] += size;
    left[pick] -= size;
  }
  return { placements, holes: left };
}

/** Total free memory minus the largest hole: what is free but unusable by one big request. */
export function externalFragmentation(holes: readonly number[]): number {
  const total = holes.reduce((a, b) => a + b, 0);
  return total - Math.max(0, ...holes);
}

/** Bytes wasted inside the last page of a process: internal fragmentation. */
export function internalFragmentation(processSize: number, pageSize: number): number {
  const r = processSize % pageSize;
  return r === 0 ? 0 : pageSize - r;
}

export const pagesNeeded = (processSize: number, pageSize: number) => Math.ceil(processSize / pageSize);

export interface Translation {
  page: number;
  offset: number;
  /** null when the page is not mapped (invalid entry or beyond the table) */
  frame: number | null;
  physical: number | null;
}

/** One-level paging. `table[p]` is the frame of page p, or null/undefined if invalid. */
export function translate(logical: number, pageSize: number, table: readonly (number | null)[]): Translation {
  const page = Math.floor(logical / pageSize);
  const offset = logical % pageSize;
  const frame = table[page] ?? null;
  return { page, offset, frame, physical: frame === null ? null : frame * pageSize + offset };
}

const log2 = (n: number) => Math.round(Math.log2(n));

/** Bits of the offset, and of the page number, for `addressBits`-bit addresses and a power-of-two page size. */
export function pageBits(addressBits: number, pageSize: number) {
  const offsetBits = log2(pageSize);
  return { offsetBits, pageNumberBits: addressBits - offsetBits, entries: 2 ** (addressBits - offsetBits) };
}

/** Size of a single-level page table in bytes. */
export const pageTableBytes = (addressBits: number, pageSize: number, entryBytes: number) => pageBits(addressBits, pageSize).entries * entryBytes;

/**
 * Split an address for a two-level page table: the outer index takes the top
 * bits of the page number, the inner index the rest, then the offset.
 */
export function splitTwoLevel(address: number, offsetBits: number, innerBits: number) {
  const offset = address % 2 ** offsetBits;
  const rest = Math.floor(address / 2 ** offsetBits);
  const inner = rest % 2 ** innerBits;
  const outer = Math.floor(rest / 2 ** innerBits);
  return { outer, inner, offset };
}

/** Bits of the outer index: the page-number bits that don't fit one page of table entries. */
export function outerBits(addressBits: number, pageSize: number, entryBytes: number) {
  const { pageNumberBits } = pageBits(addressBits, pageSize);
  const innerBits = log2(pageSize / entryBytes);
  return { innerBits, outerBits: pageNumberBits - innerBits };
}

/**
 * Effective access time with a TLB: a hit costs the TLB lookup plus one memory
 * access, a miss the lookup plus two (page table, then the data).
 */
export function eat(hitRatio: number, memoryNs: number, tlbNs = 0): number {
  return hitRatio * (tlbNs + memoryNs) + (1 - hitRatio) * (tlbNs + 2 * memoryNs);
}

/** The hit ratio that gives a target EAT (inverse of `eat`). */
export function hitRatioFor(targetNs: number, memoryNs: number, tlbNs = 0): number {
  return (tlbNs + 2 * memoryNs - targetNs) / memoryNs;
}

export interface Segment {
  base: number;
  limit: number;
}

export interface SegTranslation {
  segment: number;
  offset: number;
  /** null when the offset is beyond the limit (a trap) or the segment doesn't exist */
  physical: number | null;
}

/** Segmentation: physical = base + offset if offset < limit, otherwise the hardware traps. */
export function translateSegment(segment: number, offset: number, table: readonly Segment[]): SegTranslation {
  const s = table[segment];
  return { segment, offset, physical: s && offset >= 0 && offset < s.limit ? s.base + offset : null };
}

/** Silberschatz Exercise 9.3: holes of 100, 500, 200, 300 and 600 KB, requests 212, 417, 112, 426 KB. */
export const FIT_EXAMPLE = { holes: [100, 500, 200, 300, 600], requests: [212, 417, 112, 426] };
/** Silberschatz §9.3.1 Fig. 9.9: 4-byte pages, a 32-byte memory; page table 5, 6, 1, 2. */
export const PAGING_EXAMPLE = { pageSize: 4, table: [5, 6, 1, 2] as (number | null)[] };
/** Silberschatz §9.5 Fig. 9.20: five segments. */
export const SEGMENT_EXAMPLE: Segment[] = [
  { base: 1400, limit: 1000 },
  { base: 6300, limit: 400 },
  { base: 4300, limit: 400 },
  { base: 3200, limit: 1100 },
  { base: 4700, limit: 1000 },
];
