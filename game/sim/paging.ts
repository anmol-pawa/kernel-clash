/**
 * Virtual-memory simulators (Silberschatz ch. 10): demand-paging effective
 * access time, page replacement (FIFO, LRU, Optimal, second-chance Clock) with
 * a per-reference trace, Belady's anomaly and working sets. The tests check
 * them against the textbook's worked examples.
 */

export type Replacement = "fifo" | "lru" | "opt" | "clock";

export interface PageStep {
  /** the page referenced */
  page: number;
  fault: boolean;
  /** the page thrown out to make room, or null (hit, or a free frame was used) */
  victim: number | null;
  /** the frames after the reference, in frame order (null = empty) */
  frames: (number | null)[];
}

export interface ReplacementResult {
  steps: PageStep[];
  faults: number;
}

/** Index of the resident page used furthest in `future` (or never): Optimal's victim. */
function furthestUse(resident: readonly number[], future: readonly number[]): number {
  let pick = 0;
  let best = -1;
  resident.forEach((p, i) => {
    const next = future.indexOf(p);
    const dist = next < 0 ? Infinity : next;
    if (dist > best) { best = dist; pick = i; }
  });
  return pick;
}

/**
 * Run a reference string through `frameCount` frames. Ties in Optimal (several
 * pages never used again) go to the lowest frame; every policy fills empty
 * frames left to right before it replaces anything.
 */
export function replacePages(refs: readonly number[], frameCount: number, policy: Replacement): ReplacementResult {
  const frames: (number | null)[] = Array<number | null>(frameCount).fill(null);
  const loadedAt: number[] = Array(frameCount).fill(0); // FIFO: when the frame was filled
  const usedAt: number[] = Array(frameCount).fill(0); // LRU: the last reference
  const refBit: number[] = Array(frameCount).fill(0); // Clock
  let hand = 0;
  const steps: PageStep[] = [];
  let faults = 0;

  refs.forEach((page, t) => {
    const hit = frames.indexOf(page);
    if (hit >= 0) {
      usedAt[hit] = t;
      refBit[hit] = 1;
      steps.push({ page, fault: false, victim: null, frames: [...frames] });
      return;
    }
    faults++;
    let slot = frames.indexOf(null);
    let victim: number | null = null;
    if (slot < 0) {
      if (policy === "fifo") slot = loadedAt.indexOf(Math.min(...loadedAt));
      else if (policy === "lru") slot = usedAt.indexOf(Math.min(...usedAt));
      else if (policy === "opt") slot = furthestUse(frames as number[], refs.slice(t + 1));
      else {
        while (refBit[hand]) { refBit[hand] = 0; hand = (hand + 1) % frameCount; }
        slot = hand;
      }
      victim = frames[slot];
    }
    frames[slot] = page;
    loadedAt[slot] = t;
    usedAt[slot] = t;
    refBit[slot] = 1;
    if (policy === "clock") hand = (slot + 1) % frameCount;
    steps.push({ page, fault: true, victim, frames: [...frames] });
  });
  return { steps, faults };
}

export const faultCount = (refs: readonly number[], frameCount: number, policy: Replacement): number => replacePages(refs, frameCount, policy).faults;

/** Fault counts for 1..maxFrames frames; a rise as frames grow is Belady's anomaly. */
export function faultCurve(refs: readonly number[], policy: Replacement, maxFrames: number): number[] {
  return Array.from({ length: maxFrames }, (_, i) => faultCount(refs, i + 1, policy));
}

/** The first frame count whose fault count is worse than a smaller one's, or null. */
export function beladyAt(curve: readonly number[]): number | null {
  for (let i = 1; i < curve.length; i++) if (curve[i] > Math.min(...curve.slice(0, i))) return i + 1;
  return null;
}

/** Demand paging: EAT = (1 − p)·memory + p·fault service time (same unit). */
export const demandPagingEat = (faultRate: number, memTime: number, faultTime: number): number => (1 - faultRate) * memTime + faultRate * faultTime;

/** The largest fault rate that keeps the slowdown at or under `slowdown` (0.1 = 10%). */
export const maxFaultRate = (memTime: number, faultTime: number, slowdown: number): number => (memTime * slowdown) / (faultTime - memTime);

/** The working set at time t (0-based): the distinct pages among the last `window` references up to t. */
export function workingSet(refs: readonly number[], t: number, window: number): number[] {
  return [...new Set(refs.slice(Math.max(0, t - window + 1), t + 1))].sort((a, b) => a - b);
}

/** Total demand D = Σ working-set sizes; above the frame count the system thrashes. */
export const thrashing = (sizes: readonly number[], frames: number): boolean => sizes.reduce((a, b) => a + b, 0) > frames;

export const REFERENCE_EXAMPLE = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
export const BELADY_EXAMPLE = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
