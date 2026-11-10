/**
 * Address-translation lab engine: one virtual address through a TLB, a
 * two-level page table, a page fault and page replacement. Pure; the page only
 * draws what this returns. Checked against the textbook splits (10-10-12) and
 * `paging.ts` replacement counts in tests.
 */
import { rng } from "@/lib/rng";

export type VmPolicy = "fifo" | "lru";

export interface VmConfig {
  /** bits of page offset (page size = 2^offsetBits) */
  offsetBits: number;
  /** bits indexing the outer page table */
  l1Bits: number;
  /** bits indexing each inner page table */
  l2Bits: number;
  /** TLB entries (0 = no TLB) */
  tlbSize: number;
  /** physical frames */
  frames: number;
  /** replacement policy for both frames and TLB entries */
  policy: VmPolicy;
}

export const DEFAULT_VM: VmConfig = { offsetBits: 8, l1Bits: 3, l2Bits: 3, tlbSize: 2, frames: 4, policy: "fifo" };

/** Where every challenge starts (none of them is already solved here). */
export const CHALLENGE_START: VmConfig = { ...DEFAULT_VM, frames: 3, tlbSize: 1 };

export const vaBits = (c: VmConfig): number => c.offsetBits + c.l1Bits + c.l2Bits;
export const vaLimit = (c: VmConfig): number => 2 ** vaBits(c);

export interface Split {
  l1: number;
  l2: number;
  offset: number;
  vpn: number;
}

/** Cut a virtual address into outer index, inner index and offset. */
export function splitAddress(c: VmConfig, va: number): Split {
  const offset = va % 2 ** c.offsetBits;
  const vpn = Math.floor(va / 2 ** c.offsetBits);
  return { l1: Math.floor(vpn / 2 ** c.l2Bits), l2: vpn % 2 ** c.l2Bits, offset, vpn };
}

interface FrameEntry {
  vpn: number;
  loadedAt: number;
  usedAt: number;
}
interface TlbEntry {
  vpn: number;
  frame: number;
  loadedAt: number;
  usedAt: number;
}

export interface VmState {
  cfg: VmConfig;
  tick: number;
  tlb: TlbEntry[];
  /** outer index -> (inner index -> frame). A key exists once the inner table is allocated. */
  tables: Record<number, Record<number, number>>;
  frames: (FrameEntry | null)[];
}

export const newVm = (cfg: VmConfig): VmState => ({ cfg, tick: 0, tlb: [], tables: {}, frames: Array<FrameEntry | null>(cfg.frames).fill(null) });

export type Outcome = "tlb-hit" | "walk-hit" | "fault-free" | "fault-evict";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  "tlb-hit": "TLB hit",
  "walk-hit": "TLB miss, page present",
  "fault-free": "Page fault, free frame",
  "fault-evict": "Page fault, evict a page",
};

export interface VmStep {
  va: number;
  split: Split;
  outcome: Outcome;
  frame: number;
  pa: number;
  /** the virtual page thrown out of its frame, or null */
  victim: number | null;
  /** an inner page table had to be allocated */
  newTable: boolean;
  /** memory references: 1 on a TLB hit, otherwise one per level plus the data access */
  memRefs: number;
  diskReads: number;
  /** a human-readable account of each stage */
  log: string[];
}

const hex = (n: number, digits = 1) => "0x" + n.toString(16).toUpperCase().padStart(digits, "0");

/** The oldest-loaded (FIFO) or least-recently-used entry's index. */
function pickIndex(items: readonly { loadedAt: number; usedAt: number }[], policy: VmPolicy): number {
  let best = 0;
  items.forEach((e, i) => {
    const a = policy === "fifo" ? e.loadedAt : e.usedAt;
    const b = policy === "fifo" ? items[best].loadedAt : items[best].usedAt;
    if (a < b) best = i;
  });
  return best;
}

/** Access one virtual address. Returns the new state and what happened; the input state is not changed. */
export function access(state: VmState, va: number): { state: VmState; step: VmStep } {
  const s: VmState = structuredClone(state);
  const c = s.cfg;
  const split = splitAddress(c, va);
  const t = ++s.tick;
  const log: string[] = [`VA ${hex(va, Math.ceil(vaBits(c) / 4))} = outer ${split.l1} | inner ${split.l2} | offset ${split.offset}`];
  const physical = (frame: number) => frame * 2 ** c.offsetBits + split.offset;

  const tlbAt = s.tlb.findIndex((e) => e.vpn === split.vpn);
  if (tlbAt >= 0) {
    const e = s.tlb[tlbAt];
    e.usedAt = t;
    const f = s.frames[e.frame];
    if (f) f.usedAt = t;
    log.push(`TLB hit: page ${split.vpn} is in frame ${e.frame}. One memory reference.`);
    return { state: s, step: { va, split, outcome: "tlb-hit", frame: e.frame, pa: physical(e.frame), victim: null, newTable: false, memRefs: 1, diskReads: 0, log } };
  }
  log.push(c.tlbSize > 0 ? "TLB miss: walk the page table." : "No TLB: walk the page table.");

  let frame = s.tables[split.l1]?.[split.l2];
  let newTable = false;
  let victim: number | null = null;
  let outcome: Outcome = "walk-hit";
  let diskReads = 0;
  if (frame === undefined) {
    if (!s.tables[split.l1]) {
      s.tables[split.l1] = {};
      newTable = true;
      log.push(`Outer entry ${split.l1} is invalid: allocate an inner table.`);
    } else {
      log.push(`Outer entry ${split.l1} points to an inner table.`);
    }
    log.push(`Inner entry ${split.l2} is not present: PAGE FAULT.`);
    diskReads = 1;
    let slot = s.frames.indexOf(null);
    if (slot >= 0) {
      outcome = "fault-free";
      log.push(`Frame ${slot} is free: read page ${split.vpn} from disk into it.`);
    } else {
      outcome = "fault-evict";
      slot = pickIndex(s.frames as FrameEntry[], c.policy);
      victim = (s.frames[slot] as FrameEntry).vpn;
      const vs = splitAddress(c, victim * 2 ** c.offsetBits);
      delete s.tables[vs.l1][vs.l2];
      s.tlb = s.tlb.filter((e) => e.vpn !== victim);
      log.push(`No free frame: ${c.policy.toUpperCase()} evicts page ${victim} from frame ${slot}, clears its entry and its TLB entry.`);
      log.push(`Read page ${split.vpn} from disk into frame ${slot}.`);
    }
    s.frames[slot] = { vpn: split.vpn, loadedAt: t, usedAt: t };
    s.tables[split.l1][split.l2] = slot;
    frame = slot;
  } else {
    log.push(`Outer entry ${split.l1} -> inner entry ${split.l2} -> frame ${frame}.`);
    (s.frames[frame] as FrameEntry).usedAt = t;
  }

  if (c.tlbSize > 0) {
    if (s.tlb.length >= c.tlbSize) {
      const out = pickIndex(s.tlb, c.policy);
      log.push(`TLB full: drop page ${s.tlb[out].vpn}.`);
      s.tlb.splice(out, 1);
    }
    s.tlb.push({ vpn: split.vpn, frame, loadedAt: t, usedAt: t });
    log.push(`TLB now maps page ${split.vpn} -> frame ${frame}.`);
  }
  const pa = physical(frame);
  log.push(`PA = frame ${frame} x ${2 ** c.offsetBits} + ${split.offset} = ${hex(pa, Math.ceil((Math.log2(c.frames * 2 ** c.offsetBits) || 1) / 4))}`);
  return { state: s, step: { va, split, outcome, frame, pa, victim, newTable, memRefs: 3, diskReads, log } };
}

export interface TraceStats {
  steps: VmStep[];
  faults: number;
  evictions: number;
  tlbHits: number;
  tlbHitRate: number;
  memRefs: number;
  innerTables: number;
}

/** Run a whole address string from cold. */
export function runTrace(cfg: VmConfig, vas: readonly number[]): TraceStats & { state: VmState } {
  let state = newVm(cfg);
  const steps: VmStep[] = [];
  for (const va of vas) {
    const r = access(state, va);
    state = r.state;
    steps.push(r.step);
  }
  const faults = steps.filter((x) => x.outcome.startsWith("fault")).length;
  const tlbHits = steps.filter((x) => x.outcome === "tlb-hit").length;
  return {
    state,
    steps,
    faults,
    evictions: steps.filter((x) => x.victim !== null).length,
    tlbHits,
    tlbHitRate: steps.length ? tlbHits / steps.length : 0,
    memRefs: steps.reduce((a, x) => a + x.memRefs, 0),
    innerTables: Object.keys(state.tables).length,
  };
}

/** The address of the first byte of virtual page `vpn`, plus an offset. */
export const pageAddress = (cfg: VmConfig, vpn: number, offset = 0): number => vpn * 2 ** cfg.offsetBits + offset;

// ---------------------------------------------------------------- challenges

export interface VmChallenge {
  id: string;
  title: string;
  goal: string;
  hint: string;
  /** virtual page numbers referenced, in order (offset 0) */
  pages: number[];
  /** knobs the player may not change */
  fixed: Partial<Pick<VmConfig, "frames" | "tlbSize" | "policy">>;
  check: (s: TraceStats) => boolean;
}

const TEXTBOOK = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
const BELADY = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
const loop = (pages: number[], times: number) => Array.from({ length: times }, () => pages).flat();

export const VM_CHALLENGES: VmChallenge[] = [
  {
    id: "vm-fit",
    title: "Fit the loop",
    goal: "Loop over pages 0 to 4 three times with no evictions.",
    hint: "Five pages need five frames.",
    pages: loop([0, 1, 2, 3, 4], 3),
    fixed: { tlbSize: 2, policy: "fifo" },
    check: (s) => s.evictions === 0,
  },
  {
    id: "vm-lru",
    title: "Beat FIFO",
    goal: "Run the textbook 20-reference string in 3 frames with at most 12 page faults.",
    hint: "FIFO takes 15 faults here. Which policy keeps the pages you will touch again?",
    pages: TEXTBOOK,
    fixed: { frames: 3, tlbSize: 2 },
    check: (s) => s.faults <= 12,
  },
  {
    id: "vm-tlb",
    title: "Reach of the TLB",
    goal: "Loop over 3 pages six times with a TLB hit rate of at least 80%.",
    hint: "A loop over N pages thrashes any TLB smaller than N.",
    pages: loop([0, 1, 2], 6),
    fixed: { frames: 4, policy: "lru" },
    check: (s) => s.tlbHitRate >= 0.8,
  },
  {
    id: "vm-belady",
    title: "Cause the anomaly",
    goal: "With FIFO, make the 12-reference string 1 2 3 4 1 2 5 1 2 3 4 5 fault exactly 10 times.",
    hint: "3 frames give 9 faults. Give FIFO one more frame.",
    pages: BELADY,
    fixed: { tlbSize: 2, policy: "fifo" },
    check: (s) => s.faults === 10,
  },
  {
    id: "vm-refs",
    title: "Memory-reference diet",
    goal: "Run the textbook string using at most 45 memory references in total (a TLB hit costs 1, any other access 3).",
    hint: "Faults are fixed at 8 here; only TLB hits can save references. How many pages does the string keep returning to?",
    pages: TEXTBOOK,
    fixed: { frames: 4, policy: "lru" },
    check: (s) => s.memRefs <= 45,
  },
];

/** Every config a challenge allows, for solvability tests. */
export function allowedConfigs(ch: VmChallenge): VmConfig[] {
  const out: VmConfig[] = [];
  for (const frames of ch.fixed.frames ? [ch.fixed.frames] : [1, 2, 3, 4, 5, 6, 7, 8])
    for (const tlbSize of ch.fixed.tlbSize !== undefined ? [ch.fixed.tlbSize] : [0, 1, 2, 3, 4, 6, 8])
      for (const policy of ch.fixed.policy ? [ch.fixed.policy] : (["fifo", "lru"] as const)) out.push({ ...DEFAULT_VM, frames, tlbSize, policy });
  return out;
}

export function gradeVmChallenge(ch: VmChallenge, cfg: VmConfig): { ok: boolean; stats: TraceStats } {
  const c: VmConfig = { ...cfg, ...ch.fixed };
  const stats = runTrace(c, ch.pages.map((p) => pageAddress(c, p)));
  return { ok: ch.check(stats), stats };
}

// ------------------------------------------------------------ trace problems

export interface TraceProblem {
  seed: number;
  cfg: VmConfig;
  /** addresses already accessed, in order */
  warmup: number[];
  /** the access the player must predict */
  target: number;
  outcome: Outcome;
  pa: number;
  victim: number | null;
}

/**
 * "Trace this access": a seeded warm-up string, then one more address. The
 * answer (outcome and physical address) comes from the engine. Seeds cycle the
 * wanted outcome so all four kinds appear.
 */
export function makeTraceProblem(seed: number): TraceProblem {
  const r = rng(seed);
  const cfg: VmConfig = { ...DEFAULT_VM, tlbSize: r.pick([2, 3]), frames: r.pick([3, 4]), policy: r.pick<VmPolicy>(["fifo", "lru"]) };
  const pages = 2 ** (cfg.l1Bits + cfg.l2Bits);
  const want: Outcome = (["tlb-hit", "walk-hit", "fault-free", "fault-evict"] as const)[seed % 4];
  const hotCount = want === "fault-free" ? Math.max(1, cfg.frames - 2) : cfg.frames + 2;
  const hot = r.shuffle(Array.from({ length: pages }, (_, i) => i)).slice(0, hotCount);
  const len = want === "fault-free" ? hotCount + 1 : r.int(8, 12);
  const warmup: number[] = [];
  for (let i = 0; i < len; i++) warmup.push(pageAddress(cfg, r.pick(hot), r.int(0, 2 ** cfg.offsetBits - 1)));
  let state = newVm(cfg);
  for (const va of warmup) state = access(state, va).state;

  let chosen: { va: number; step: VmStep } | null = null;
  let fallback: { va: number; step: VmStep } | null = null;
  for (const p of r.shuffle(Array.from({ length: pages }, (_, i) => i))) {
    const va = pageAddress(cfg, p, r.int(0, 2 ** cfg.offsetBits - 1));
    const step = access(state, va).step;
    fallback ??= { va, step };
    if (step.outcome === want) {
      chosen = { va, step };
      break;
    }
  }
  const pick = chosen ?? fallback!;
  return { seed, cfg, warmup, target: pick.va, outcome: pick.step.outcome, pa: pick.step.pa, victim: pick.step.victim };
}

/** Grade a player's answer to a trace problem by re-running the engine. */
export function gradeTraceProblem(p: TraceProblem, outcome: Outcome, pa: number): { outcomeOk: boolean; paOk: boolean } {
  let state = newVm(p.cfg);
  for (const va of p.warmup) state = access(state, va).state;
  const truth = access(state, p.target).step;
  return { outcomeOk: truth.outcome === outcome, paOk: truth.pa === pa };
}
