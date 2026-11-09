/**
 * Address-translation lab engine: one virtual address stepped through a TLB, a
 * two-level page table and demand paging with FIFO or LRU replacement.
 *
 * Model (stated so every number is checkable): 16-bit virtual addresses split
 * as [L1 index | L2 index | offset]. The L1 table always exists; an L2 table is
 * created by the kernel the first time a page in its region is mapped (kernel
 * memory, so it does not use a user frame). A TLB hit costs 1 memory reference
 * (the data). A TLB miss walks L1 then L2 then reads the data: 3 references. A
 * page fault stops the walk (1 reference if the L1 entry is invalid, else 2),
 * the kernel loads the page, and the instruction restarts with a full walk of 3.
 * The TLB is filled FIFO; an evicted page's TLB entry is flushed.
 * Dirty bits, protection bits and ASIDs are left out on purpose.
 */
import { rng } from "@/lib/rng";

export type LabPolicy = "fifo" | "lru";
export type Outcome = "tlb-hit" | "walk" | "fault";

export const ADDRESS_BITS = 16;

export interface VmConfig {
  /** bits of page offset: page size = 2^offsetBits */
  offsetBits: number;
  tlbEntries: number;
  frames: number;
  policy: LabPolicy;
}

export const DEFAULT_CONFIG: VmConfig = { offsetBits: 8, tlbEntries: 2, frames: 3, policy: "lru" };

/** Clamp a hand-edited config to the ranges the lab supports. */
export function sanitizeConfig(c: VmConfig): VmConfig {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? Math.trunc(n) : lo));
  return {
    offsetBits: [6, 8, 10].includes(c.offsetBits) ? c.offsetBits : 8,
    tlbEntries: clamp(c.tlbEntries, 0, 4),
    frames: clamp(c.frames, 1, 6),
    policy: c.policy === "fifo" ? "fifo" : "lru",
  };
}

/** Bits of the L1 index and the L2 index (the page number splits as evenly as possible, L1 gets the extra bit). */
export function levelBits(offsetBits: number): { l1: number; l2: number } {
  const pn = ADDRESS_BITS - offsetBits;
  return { l1: Math.ceil(pn / 2), l2: Math.floor(pn / 2) };
}

export interface SplitAddr {
  l1: number;
  l2: number;
  vpn: number;
  offset: number;
}

export function splitVirtual(vaddr: number, offsetBits: number): SplitAddr {
  const { l2 } = levelBits(offsetBits);
  const offset = vaddr % 2 ** offsetBits;
  const vpn = Math.floor(vaddr / 2 ** offsetBits);
  return { vpn, offset, l1: Math.floor(vpn / 2 ** l2), l2: vpn % 2 ** l2 };
}

interface Frame {
  vpn: number;
  loadedAt: number;
  usedAt: number;
}
interface TlbEntry {
  vpn: number;
  frame: number;
  loadedAt: number;
}

export interface Machine {
  config: VmConfig;
  time: number;
  frames: (Frame | null)[];
  tlb: TlbEntry[];
  /** L1 indices that have an L2 table */
  l2Tables: number[];
}

export const newMachine = (config: VmConfig): Machine => ({ config: sanitizeConfig(config), time: 0, frames: Array(sanitizeConfig(config).frames).fill(null), tlb: [], l2Tables: [] });

export type StepKind = "split" | "tlb-hit" | "tlb-miss" | "l1" | "l2" | "fault" | "evict" | "load" | "tlb-fill" | "restart" | "phys";

export interface Step {
  kind: StepKind;
  text: string;
}

export interface AccessResult {
  vaddr: number;
  outcome: Outcome;
  /** physical address, or null if the address is outside the 16-bit space */
  physical: number | null;
  frame: number | null;
  vpn: number;
  victim: number | null;
  memRefs: number;
  steps: Step[];
}

const hex = (n: number, digits: number) => "0x" + n.toString(16).toUpperCase().padStart(digits, "0");
export const hexDigits = (bits: number) => Math.ceil(bits / 4);

/** The frame holding `vpn`, or -1. */
const frameOf = (m: Machine, vpn: number) => m.frames.findIndex((f) => f?.vpn === vpn);

/** Run one access; mutates the machine and returns the full story. */
export function access(m: Machine, vaddr: number): AccessResult {
  const { offsetBits, policy } = m.config;
  const bits = levelBits(offsetBits);
  const a = splitVirtual(vaddr, offsetBits);
  const steps: Step[] = [];
  const t = ++m.time;
  const say = (kind: StepKind, text: string) => steps.push({ kind, text });
  say("split", `${hex(vaddr, 4)} = L1 ${a.l1} | L2 ${a.l2} | offset ${a.offset} (page ${a.vpn}; ${bits.l1}+${bits.l2}+${offsetBits} bits)`);

  let outcome: Outcome;
  let memRefs: number;
  let victim: number | null = null;
  let slot: number;

  const tlbHit = m.tlb.find((e) => e.vpn === a.vpn);
  if (tlbHit) {
    outcome = "tlb-hit";
    memRefs = 1;
    slot = tlbHit.frame;
    say("tlb-hit", `TLB hit: page ${a.vpn} is in frame ${slot}, no page-table reference`);
  } else {
    say("tlb-miss", m.config.tlbEntries === 0 ? "No TLB: walk the page table" : `TLB miss on page ${a.vpn}: walk the page table`);
    const hasL2 = m.l2Tables.includes(a.l1);
    say("l1", hasL2 ? `L1[${a.l1}] is valid: it points at an L2 table (memory ref 1)` : `L1[${a.l1}] is invalid: no L2 table yet (memory ref 1)`);
    const resident = hasL2 ? frameOf(m, a.vpn) : -1;
    if (hasL2) say("l2", resident >= 0 ? `L2[${a.l2}] is valid: frame ${resident} (memory ref 2)` : `L2[${a.l2}] is not present (memory ref 2)`);
    if (resident >= 0) {
      outcome = "walk";
      memRefs = 3;
      slot = resident;
    } else {
      outcome = "fault";
      const walkRefs = hasL2 ? 2 : 1;
      memRefs = walkRefs + 3;
      say("fault", `Page fault: the kernel must bring page ${a.vpn} in from disk`);
      if (!hasL2) m.l2Tables.push(a.l1);
      slot = m.frames.indexOf(null);
      if (slot < 0) {
        const key = (f: Frame | null) => (policy === "fifo" ? f!.loadedAt : f!.usedAt);
        slot = m.frames.reduce((best, f, i) => (key(f) < key(m.frames[best]) ? i : best), 0);
        victim = m.frames[slot]!.vpn;
        say("evict", `All ${m.frames.length} frames are full: ${policy === "fifo" ? "FIFO" : "LRU"} evicts page ${victim} from frame ${slot}`);
        m.tlb = m.tlb.filter((e) => e.vpn !== victim);
      } else {
        say("evict", `Frame ${slot} is free: nothing to evict`);
      }
      m.frames[slot] = { vpn: a.vpn, loadedAt: t, usedAt: t };
      say("load", `Page ${a.vpn} loaded into frame ${slot}; the page table now maps it`);
      say("restart", "The instruction restarts, misses the TLB again and walks the table (3 more references in all)");
    }
    if (m.config.tlbEntries > 0) {
      if (m.tlb.length >= m.config.tlbEntries) {
        const old = m.tlb.reduce((best, e, i) => (e.loadedAt < m.tlb[best].loadedAt ? i : best), 0);
        say("tlb-fill", `TLB full: drop the oldest entry (page ${m.tlb[old].vpn}) and cache page ${a.vpn}`);
        m.tlb.splice(old, 1);
      } else {
        say("tlb-fill", `Cache page ${a.vpn} → frame ${slot} in the TLB`);
      }
      m.tlb.push({ vpn: a.vpn, frame: slot, loadedAt: t });
    }
  }
  const f = m.frames[slot]!;
  f.usedAt = t;
  const physical = slot * 2 ** offsetBits + a.offset;
  const pdigits = hexDigits(Math.log2(m.frames.length * 2 ** offsetBits) + 0.0001);
  say("phys", `physical = frame ${slot} × ${2 ** offsetBits} + ${a.offset} = ${hex(physical, Math.max(3, pdigits))} (${memRefs} memory reference${memRefs === 1 ? "" : "s"})`);
  return { vaddr, outcome, physical, frame: slot, vpn: a.vpn, victim, memRefs, steps };
}

export function runAll(config: VmConfig, vaddrs: readonly number[]): { machine: Machine; results: AccessResult[] } {
  const machine = newMachine(config);
  return { machine, results: vaddrs.map((v) => access(machine, v)) };
}

/** A deep copy, so a UI can keep the "before" state. */
export const cloneMachine = (m: Machine): Machine => structuredClone(m);

// ---------------------------------------------------------------- generated "trace this access" challenges

export interface TraceChallenge {
  seed: number;
  config: VmConfig;
  /** accesses already done */
  history: number[];
  /** the access to predict */
  target: number;
}

export interface TraceAnswer {
  outcome: Outcome;
  /** physical address */
  physical: number;
  /** evicted page, or null for "none" */
  victim: number | null;
}

/** Build a reproducible challenge: a short history over 4-5 pages, then a target that is a hit, a walk or a fault. */
export function makeTrace(seed: number): TraceChallenge {
  const r = rng(seed * 7919 + 13);
  const config: VmConfig = { offsetBits: r.pick([6, 8, 10]), tlbEntries: r.int(1, 3), frames: r.int(2, 4), policy: r.pick<LabPolicy>(["fifo", "lru"]) };
  const pageCount = config.frames + r.int(1, 2);
  const span = 2 ** (ADDRESS_BITS - config.offsetBits);
  // spread the pages across the space so more than one L2 table appears
  const pages = r.shuffle(Array.from({ length: span }, (_, i) => i)).slice(0, pageCount).map((p, i) => (i % 2 === 0 ? p : (p + span / 2) % span));
  const uniq = [...new Set(pages)];
  const addr = () => r.pick(uniq) * 2 ** config.offsetBits + r.int(0, 2 ** config.offsetBits - 1);
  const history = Array.from({ length: r.int(5, 8) }, addr);
  return { seed, config, history, target: addr() };
}

/** Run the history, then the target: the answer key and the machine before the target. */
export function solveTrace(c: TraceChallenge): { before: Machine; result: AccessResult } {
  const { machine } = runAll(c.config, c.history);
  const before = cloneMachine(machine);
  return { before, result: access(machine, c.target) };
}

export function gradeTrace(c: TraceChallenge, ans: TraceAnswer): { outcome: boolean; physical: boolean; victim: boolean; ok: boolean } {
  const { result } = solveTrace(c);
  const outcome = ans.outcome === result.outcome;
  const physical = ans.physical === result.physical;
  const victim = ans.victim === result.victim;
  return { outcome, physical, victim, ok: outcome && physical && victim };
}

export const parseHex = (s: string): number | null => {
  const t = s.trim().replace(/^0x/i, "");
  return /^[0-9a-f]{1,8}$/i.test(t) ? parseInt(t, 16) : null;
};
