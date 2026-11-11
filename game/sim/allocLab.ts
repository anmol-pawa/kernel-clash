/**
 * Allocator lab engine: serve a malloc/free trace with first/best/worst-fit
 * free lists, a binary buddy system or a slab allocator, and report failures,
 * internal waste and a fragmentation picture. Pure; the page only draws it.
 * The free-list and buddy policies reuse `allocator.ts`; the slab model here is
 * a page pool carved into per-size-class slabs (Silberschatz 10.8.2 / Bonwick).
 */
import { Buddy, FreeListHeap } from "@/game/sim/allocator";

export type Strategy = "first" | "best" | "worst" | "buddy" | "slab";
export const STRATEGIES: Strategy[] = ["first", "best", "worst", "buddy", "slab"];
export const STRATEGY_LABEL: Record<Strategy, string> = { first: "First fit", best: "Best fit", worst: "Worst fit", buddy: "Buddy", slab: "Slab" };

/** Heap size in units (think KB). A power of two so the buddy system fits. */
export const HEAP_UNITS = 64;
export const SLAB_PAGE = 16;
export const SLAB_CLASSES = [2, 4, 8];

export type Op = { op: "alloc"; id: string; size: number } | { op: "free"; id: string };

export interface Segment {
  addr: number;
  size: number;
  kind: "used" | "free" | "waste";
  id?: string;
}

export interface OpResult {
  op: Op;
  ok: boolean;
  addr: number | null;
  /** Why an allocation failed. */
  why?: string;
}

export interface Snapshot {
  segments: Segment[];
  /** Units the strategy could hand out as one piece right now. */
  largestFree: number;
  freeUnits: number;
  /** Units reserved but not asked for (buddy rounding, slab class rounding). */
  internalWaste: number;
}

const slabClass = (n: number) => SLAB_CLASSES.find((c) => c >= n);

/** A live allocator instance for one strategy. */
export class Allocator {
  private heap: FreeListHeap | null = null;
  private buddy: Buddy | null = null;
  private owned = new Map<string, { addr: number; block: number; bytes: number }>();
  private pages: { cls: number | null; slots: (string | null)[] }[] = [];
  private slabOf = new Map<string, { page: number; slot: number; bytes: number }>();

  constructor(readonly strategy: Strategy, readonly total = HEAP_UNITS) {
    if (strategy === "buddy") this.buddy = new Buddy(total);
    else if (strategy === "slab") this.pages = Array.from({ length: total / SLAB_PAGE }, () => ({ cls: null, slots: [] }));
    else this.heap = new FreeListHeap(total);
  }

  has(id: string): boolean {
    return this.strategy === "slab" ? this.slabOf.has(id) : this.strategy === "buddy" ? this.owned.has(id) : this.heap!.chunks.some((c) => c.id === id);
  }

  apply(op: Op): OpResult {
    if (op.op === "free") {
      if (!this.has(op.id)) return { op, ok: false, addr: null, why: `${op.id} is not allocated` };
      this.release(op.id);
      return { op, ok: true, addr: null };
    }
    if (this.has(op.id)) return { op, ok: false, addr: null, why: `${op.id} is already allocated` };
    if (!(op.size > 0) || !Number.isInteger(op.size)) return { op, ok: false, addr: null, why: "size must be a positive whole number" };
    return this.alloc(op);
  }

  private alloc(op: Extract<Op, { op: "alloc" }>): OpResult {
    const { id, size } = op;
    if (this.heap) {
      const addr = this.heap.malloc(id, size, this.strategy as "first" | "best" | "worst");
      return addr === null ? { op, ok: false, addr: null, why: `no hole of ${size}; largest is ${this.heap.largestHole}` } : { op, ok: true, addr };
    }
    if (this.buddy) {
      const g = this.buddy.alloc(id, size);
      if (!g) return { op, ok: false, addr: null, why: `no free block of ${2 ** Math.ceil(Math.log2(size))} or bigger` };
      this.owned.set(id, { addr: g.addr, block: g.block, bytes: size });
      return { op, ok: true, addr: g.addr };
    }
    const cls = slabClass(size);
    if (cls === undefined) return { op, ok: false, addr: null, why: `${size} is bigger than the largest slab class (${SLAB_CLASSES[SLAB_CLASSES.length - 1]})` };
    let pi = this.pages.findIndex((p) => p.cls === cls && p.slots.includes(null));
    if (pi < 0) {
      pi = this.pages.findIndex((p) => p.cls === null);
      if (pi < 0) return { op, ok: false, addr: null, why: `no free slot in a ${cls}-unit slab and no free page` };
      this.pages[pi] = { cls, slots: Array<string | null>(SLAB_PAGE / cls).fill(null) };
    }
    const page = this.pages[pi];
    const slot = page.slots.indexOf(null);
    page.slots[slot] = id;
    this.slabOf.set(id, { page: pi, slot, bytes: size });
    return { op, ok: true, addr: pi * SLAB_PAGE + slot * cls };
  }

  private release(id: string): void {
    if (this.heap) this.heap.free(id);
    else if (this.buddy) {
      this.buddy.release(id);
      this.owned.delete(id);
    } else {
      const s = this.slabOf.get(id)!;
      this.slabOf.delete(id);
      const page = this.pages[s.page];
      page.slots[s.slot] = null;
      if (page.slots.every((x) => x === null)) this.pages[s.page] = { cls: null, slots: [] };
    }
  }

  snapshot(): Snapshot {
    const segments: Segment[] = [];
    let largestFree = 0;
    let internalWaste = 0;
    if (this.heap) {
      for (const c of this.heap.chunks) segments.push({ addr: c.addr, size: c.size, kind: c.id === null ? "free" : "used", id: c.id ?? undefined });
      largestFree = this.heap.largestHole;
    } else if (this.buddy) {
      for (const [id, o] of this.owned) {
        segments.push({ addr: o.addr, size: o.bytes, kind: "used", id });
        if (o.block > o.bytes) segments.push({ addr: o.addr + o.bytes, size: o.block - o.bytes, kind: "waste", id });
        internalWaste += o.block - o.bytes;
      }
      for (const [a, s] of this.buddy.freeBlocks()) {
        segments.push({ addr: a, size: s, kind: "free" });
        largestFree = Math.max(largestFree, s);
      }
    } else {
      this.pages.forEach((p, pi) => {
        const base = pi * SLAB_PAGE;
        if (p.cls === null) {
          segments.push({ addr: base, size: SLAB_PAGE, kind: "free" });
          largestFree = Math.max(largestFree, SLAB_PAGE);
          return;
        }
        p.slots.forEach((id, si) => {
          const addr = base + si * p.cls!;
          if (id === null) return void segments.push({ addr, size: p.cls!, kind: "free" });
          const bytes = this.slabOf.get(id)!.bytes;
          segments.push({ addr, size: bytes, kind: "used", id });
          if (p.cls! > bytes) segments.push({ addr: addr + bytes, size: p.cls! - bytes, kind: "waste", id });
          internalWaste += p.cls! - bytes;
        });
        // Largest slot a request of any class could still take from this slab.
        if (p.slots.includes(null)) largestFree = Math.max(largestFree, p.cls);
      });
    }
    segments.sort((a, b) => a.addr - b.addr);
    const freeUnits = segments.filter((s) => s.kind === "free").reduce((n, s) => n + s.size, 0);
    return { segments, largestFree, freeUnits, internalWaste };
  }
}

export interface TraceRun {
  results: OpResult[];
  failures: number;
  /** Highest internal waste seen after any step. */
  peakWaste: number;
  final: Snapshot;
  /** Snapshot after each op. */
  history: Snapshot[];
}

/** Run a whole trace on a fresh heap. */
export function runTrace(strategy: Strategy, ops: Op[], total = HEAP_UNITS): TraceRun {
  const a = new Allocator(strategy, total);
  const results: OpResult[] = [];
  const history: Snapshot[] = [];
  let peakWaste = 0;
  for (const op of ops) {
    results.push(a.apply(op));
    const s = a.snapshot();
    history.push(s);
    peakWaste = Math.max(peakWaste, s.internalWaste);
  }
  return {
    results,
    failures: results.filter((r) => !r.ok && r.op.op === "alloc").length,
    peakWaste,
    final: history.length ? history[history.length - 1] : a.snapshot(),
    history,
  };
}

/** External fragmentation: the share of free units outside the biggest piece. */
export const externalFragmentation = (s: Snapshot): number => (s.freeUnits === 0 ? 0 : 1 - s.largestFree / s.freeUnits);

const A = (id: string, size: number): Op => ({ op: "alloc", id, size });
const F = (id: string): Op => ({ op: "free", id });

export interface AllocChallenge {
  id: string;
  title: string;
  goal: string;
  hint: string;
  ops: Op[];
  /** Maximum failed allocations allowed (0 = serve every request). */
  maxFailures: number;
  /** Optional cap on peak internal waste. */
  maxWaste?: number;
}

export const ALLOC_CHALLENGES: AllocChallenge[] = [
  {
    id: "tight-hole",
    title: "Use the tight hole",
    goal: "Serve every request. Two holes open up: a big one first in memory, a snug one after it.",
    hint: "A small request should not eat the big hole that a later large request needs.",
    ops: [A("a", 20), A("b", 4), A("c", 10), A("d", 4), A("e", 26), F("a"), F("c"), A("f", 9), A("g", 20)],
    maxFailures: 0,
  },
  {
    id: "keep-leftovers",
    title: "Keep the leftovers useful",
    goal: "Serve every request. Carving the tightest hole strands slivers that nothing can use.",
    hint: "After a split, the remainder should stay big enough to serve the next request.",
    ops: [A("a", 2), A("b", 19), A("c", 11), A("d", 5), A("e", 11), F("a"), F("c"), A("x", 5), A("y", 7), A("z", 11)],
    maxFailures: 0,
  },
  {
    id: "first-hole-wins",
    title: "The scan that stops early",
    goal: "Serve every request. Here the cheap scan beats the clever ones: the 13-unit request needs a hole that the others carve up.",
    hint: "Trace where each policy puts the 9-unit request, then see what is left for the 13.",
    ops: [A("a", 4), A("b", 20), A("c", 21), A("d", 6), A("e", 10), F("e"), F("a"), F("c"), A("x", 9), A("y", 10), A("z", 13)],
    maxFailures: 0,
  },
  {
    id: "round-up-cost",
    title: "Round up, pay up",
    goal: "Serve every request with no more than 3 units of peak internal waste.",
    hint: "Power-of-two blocks and size classes reserve more than was asked for.",
    ops: [A("a", 5), A("b", 9), A("c", 3), A("d", 17)],
    maxFailures: 0,
    maxWaste: 3,
  },
  {
    id: "too-big-for-slab",
    title: "Too big for a slab",
    goal: "Serve every request, including the 12-unit one that follows the small objects.",
    hint: "Slab caches only exist for a few small object sizes.",
    ops: [...Array.from({ length: 6 }, (_, i) => A(`o${i}`, 3)), A("big", 12), F("o1"), F("o3"), A("p", 3)],
    maxFailures: 0,
  },
  {
    id: "merge-back",
    title: "Merge or starve",
    goal: "Serve every request: after the frees, the 64-unit request needs every piece to join back together.",
    hint: "Freed neighbours must coalesce. Which policies cannot hand out a whole heap?",
    ops: [A("a", 16), A("b", 16), A("c", 16), A("d", 16), F("a"), F("b"), F("c"), F("d"), A("big", 64)],
    maxFailures: 0,
  },
];

export interface AllocGrade {
  ok: boolean;
  failures: number;
  peakWaste: number;
  wasteOk: boolean;
}

export function gradeAllocChallenge(ch: AllocChallenge, strategy: Strategy): AllocGrade {
  const r = runTrace(strategy, ch.ops);
  const wasteOk = ch.maxWaste === undefined || r.peakWaste <= ch.maxWaste;
  return { ok: r.failures <= ch.maxFailures && wasteOk, failures: r.failures, peakWaste: r.peakWaste, wasteOk };
}
