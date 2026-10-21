/**
 * Deadlock simulators (Silberschatz ch. 8).
 *
 * Resource-allocation graph: single-instance resources, edges P → R (request)
 * and R → P (assignment); a cycle is necessary and sufficient for deadlock.
 *
 * Banker's algorithm (avoidance) and the detection algorithm: vectors of
 * resource-type counts, a `work` vector and a `finish` flag per process. The
 * scan goes round the processes in circular order, as in the textbook's
 * worked example, so the sequences match it.
 */

export type Vec = readonly number[];

const le = (a: Vec, b: Vec) => a.every((x, i) => x <= b[i]);
const add = (a: Vec, b: Vec): number[] => a.map((x, i) => x + b[i]);
const sub = (a: Vec, b: Vec): number[] => a.map((x, i) => x - b[i]);

/** Directed edges between named nodes: `from → to`. */
export type Edge = readonly [from: string, to: string];

/** The first cycle found in a directed graph (as a list of nodes, first repeated at the end), or null. */
export function findCycle(edges: readonly Edge[]): string[] | null {
  const next = new Map<string, string[]>();
  for (const [a, b] of edges) next.set(a, [...(next.get(a) ?? []), b]);
  const done = new Set<string>();
  const path: string[] = [];
  const visit = (n: string): string[] | null => {
    const at = path.indexOf(n);
    if (at >= 0) return [...path.slice(at), n];
    if (done.has(n)) return null;
    path.push(n);
    for (const m of next.get(n) ?? []) {
      const c = visit(m);
      if (c) return c;
    }
    path.pop();
    done.add(n);
    return null;
  };
  for (const n of next.keys()) {
    const c = visit(n);
    if (c) return c;
  }
  return null;
}

export interface BankerState {
  /** free instances of each resource type */
  available: Vec;
  /** allocation[i][j]: instances of type j held by process i */
  allocation: readonly Vec[];
  /** max[i][j]: the most of type j process i may ask for */
  max: readonly Vec[];
}

export const need = (s: BankerState): number[][] => s.max.map((m, i) => sub(m, s.allocation[i]));

export interface SafetyResult {
  safe: boolean;
  /** the order the processes can finish in (a safe sequence when `safe`) */
  sequence: number[];
  /** the work vector each time a process finished */
  work: number[][];
}

/** The safety algorithm (§8.6.3.1). */
export function safety(s: BankerState): SafetyResult {
  const n = s.allocation.length;
  const nd = need(s);
  const finish = Array<boolean>(n).fill(false);
  let work: number[] = [...s.available];
  const sequence: number[] = [];
  const trail: number[][] = [];
  let i = 0;
  let idle = 0;
  while (sequence.length < n && idle < n) {
    if (!finish[i] && le(nd[i], work)) {
      work = add(work, s.allocation[i]);
      finish[i] = true;
      sequence.push(i);
      trail.push(work);
      idle = 0;
    } else idle++;
    i = (i + 1) % n;
  }
  return { safe: sequence.length === n, sequence, work: trail };
}

export type RequestResult =
  | { granted: true; state: BankerState; sequence: number[] }
  | { granted: false; reason: "exceeds-need" | "not-available" | "unsafe" };

/** The resource-request algorithm (§8.6.3.2): grant only if the resulting state is safe. */
export function request(s: BankerState, p: number, req: Vec): RequestResult {
  if (!le(req, need(s)[p])) return { granted: false, reason: "exceeds-need" };
  if (!le(req, s.available)) return { granted: false, reason: "not-available" };
  const after: BankerState = {
    available: sub(s.available, req),
    allocation: s.allocation.map((a, i) => (i === p ? add(a, req) : a)),
    max: s.max,
  };
  const r = safety(after);
  return r.safe ? { granted: true, state: after, sequence: r.sequence } : { granted: false, reason: "unsafe" };
}

/** True when `seq` lets every process finish in that order. */
export function isSafeSequence(s: BankerState, seq: readonly number[]): boolean {
  const n = s.allocation.length;
  if (seq.length !== n || new Set(seq).size !== n) return false;
  const nd = need(s);
  let work: number[] = [...s.available];
  for (const i of seq) {
    if (!le(nd[i], work)) return false;
    work = add(work, s.allocation[i]);
  }
  return true;
}

/** Detection (§8.6.2): processes that can never finish given their current outstanding requests. */
export function detect(available: Vec, allocation: readonly Vec[], requests: readonly Vec[]): number[] {
  const n = allocation.length;
  let work: number[] = [...available];
  const finish = allocation.map((a) => a.every((x) => x === 0));
  let i = 0;
  let idle = 0;
  while (idle < n) {
    if (!finish[i] && le(requests[i], work)) {
      work = add(work, allocation[i]);
      finish[i] = true;
      idle = 0;
    } else idle++;
    i = (i + 1) % n;
  }
  return finish.flatMap((f, k) => (f ? [] : [k]));
}

/** Silberschatz §8.6.3.3: five processes, A = 10, B = 5, C = 7 instances. */
export const BANKER_EXAMPLE: BankerState = {
  available: [3, 3, 2],
  allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
  max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
};

/** Silberschatz §8.6.2: A = 7, B = 2, C = 6, nothing free, and nobody deadlocked. */
export const DETECT_EXAMPLE = {
  available: [0, 0, 0],
  allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 3], [2, 1, 1], [0, 0, 2]],
  requests: [[0, 0, 0], [2, 0, 2], [0, 0, 0], [1, 0, 0], [0, 0, 2]],
} as const;

export interface SequenceWalk {
  /** Work just before each pick (the first is Available) */
  before: number[][];
  /** whether each pick could really finish: its Need ≤ Work at that point */
  ok: boolean[];
  /** Work after the last pick; a pick that couldn't finish adds nothing */
  work: number[];
}

/** Replay a (possibly partial) order of finishing processes, marking each pick that can't run. */
export function walkSequence(s: BankerState, seq: readonly number[]): SequenceWalk {
  const nd = need(s);
  let work: number[] = [...s.available];
  const before: number[][] = [];
  const ok: boolean[] = [];
  for (const i of seq) {
    before.push(work);
    const can = le(nd[i], work);
    ok.push(can);
    if (can) work = add(work, s.allocation[i]);
  }
  return { before, ok, work };
}
