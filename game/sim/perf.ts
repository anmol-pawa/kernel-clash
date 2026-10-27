/** Back-of-the-envelope performance formulas that interviews like, each as a small pure function. */

/** Fraction of CPU time lost to switching when every quantum is followed by one switch of `switchCost`. */
export function switchOverhead(quantum: number, switchCost: number): number {
  return switchCost / (quantum + switchCost);
}

/** Amdahl's law: speedup of a program whose fraction `serial` cannot be parallelised, on `n` processors. */
export function amdahlSpeedup(serial: number, n: number): number {
  return 1 / (serial + (1 - serial) / n);
}

/** The ceiling as n grows without bound: 1 / serial. */
export const amdahlLimit = (serial: number): number => 1 / serial;

/** Liu & Layland's rate-monotonic utilization bound for n tasks: n (2^(1/n) - 1). */
export function rmBound(n: number): number {
  return n * (2 ** (1 / n) - 1);
}

export interface PeriodicTask {
  /** worst-case execution time */
  c: number;
  /** period (= deadline) */
  t: number;
}

export const utilization = (tasks: readonly PeriodicTask[]): number => tasks.reduce((u, k) => u + k.c / k.t, 0);

export type RmVerdict = "guaranteed" | "inconclusive" | "overloaded";

/** The sufficient (not necessary) Liu & Layland test: under the bound is safe, over 1 is impossible, in between needs exact analysis. */
export function rmTest(tasks: readonly PeriodicTask[]): RmVerdict {
  const u = utilization(tasks);
  if (u > 1 + 1e-12) return "overloaded";
  return u <= rmBound(tasks.length) + 1e-12 ? "guaranteed" : "inconclusive";
}

/** Exact rate-monotonic check by response-time analysis (shortest period = highest priority). */
export function rmSchedulableExact(tasks: readonly PeriodicTask[]): boolean {
  const byPriority = [...tasks].sort((a, b) => a.t - b.t);
  return byPriority.every((task, i) => {
    let r = task.c;
    for (;;) {
      const next = task.c + byPriority.slice(0, i).reduce((sum, h) => sum + Math.ceil(r / h.t) * h.c, 0);
      if (next > task.t) return false;
      if (next === r) return true;
      r = next;
    }
  });
}

/** Effective access time through two cache levels: L1 hit, else L2 hit, else memory (times are cumulative lookups). */
export function twoLevelEat(h1: number, t1: number, h2: number, t2: number, tMem: number): number {
  return h1 * t1 + (1 - h1) * (h2 * (t1 + t2) + (1 - h2) * (t1 + t2 + tMem));
}

/** Goetz's thread-pool size: cores * target utilization * (1 + wait/compute). CPU-bound work has wait = 0. */
export function poolSize(cores: number, wait: number, compute: number, utilizationTarget = 1): number {
  return Math.ceil(cores * utilizationTarget * (1 + wait / compute));
}

/** Rule of thumb for a CPU-bound pool: one thread per core plus one to cover a page fault or brief stall. */
export const cpuBoundPool = (cores: number): number => cores + 1;

/** Ops per second from `threads` threads, each doing `outside` ms of parallel work and `inside` ms in one shared lock. */
export function lockedThroughput(threads: number, outside: number, inside: number): number {
  return 1000 * Math.min(threads / (outside + inside), 1 / inside);
}

/** Threads at which the lock becomes the bottleneck: (outside + inside) / inside. */
export const lockSaturation = (outside: number, inside: number): number => (outside + inside) / inside;

/** Bandwidth-delay product in bytes: the buffer a socket needs to keep a link full. bandwidth in bits/s, rtt in seconds. */
export function bandwidthDelayBytes(bitsPerSecond: number, rttSeconds: number): number {
  return (bitsPerSecond * rttSeconds) / 8;
}
