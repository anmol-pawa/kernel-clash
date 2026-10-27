/**
 * Small, runnable models behind the "how would you build..." design questions:
 * an LRU cache, a token-bucket rate limiter, a bounded thread-pool queue, a
 * user-space round-robin scheduler and a shell pipeline's file-descriptor
 * tables. Tests check each "what breaks without X" claim against these.
 */

/** LRU cache: a hash map for O(1) lookup plus recency order (a Map keeps insertion order). */
export class LruCache<V> {
  private readonly map = new Map<string, V>();
  constructor(readonly capacity: number) {
    if (capacity < 1) throw new Error("capacity must be at least 1");
  }
  /** A get is a write: it moves the key to most-recently-used, so it needs the same lock as put. */
  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  put(key: string, v: V): string | null {
    let evicted: string | null = null;
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      evicted = this.map.keys().next().value as string;
      this.map.delete(evicted);
    }
    this.map.set(key, v);
    return evicted;
  }
  /** Keys from least to most recently used. */
  keys(): string[] {
    return [...this.map.keys()];
  }
}

/** Token bucket: holds at most `capacity` tokens and refills `perSecond` of them as time passes. */
export class TokenBucket {
  tokens: number;
  private last = 0;
  constructor(readonly capacity: number, readonly perSecond: number) {
    this.tokens = capacity;
  }
  /** Refills for the elapsed time (capped at capacity), then takes one token if there is one. */
  allow(nowMs: number): boolean {
    this.tokens = Math.min(this.capacity, this.tokens + ((nowMs - this.last) / 1000) * this.perSecond);
    this.last = nowMs;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** Outcome of submitting `tasks` at once to a pool with `workers` threads and a queue of `queueCap` (null = unbounded). */
export function submitBurst(tasks: number, workers: number, queueCap: number | null): { running: number; queued: number; rejected: number } {
  const running = Math.min(tasks, workers);
  const room = queueCap === null ? Infinity : queueCap;
  const queued = Math.min(tasks - running, room);
  return { running, queued, rejected: tasks - running - queued };
}

/** Time each task first gets the CPU when run to completion (quantum null) or round-robin with `quantum`. */
export function firstRunTimes(bursts: readonly number[], quantum: number | null): number[] {
  const first: number[] = bursts.map(() => -1);
  const left = [...bursts];
  let t = 0;
  for (;;) {
    let ran = false;
    for (let i = 0; i < left.length; i++) {
      if (left[i] <= 0) continue;
      ran = true;
      if (first[i] < 0) first[i] = t;
      const slice = quantum === null ? left[i] : Math.min(quantum, left[i]);
      t += slice;
      left[i] -= slice;
    }
    if (!ran) return first;
  }
}

/** Per-process file-descriptor tables over shared pipe ends, as a shell sets up `a | b`. */
export class FdWorld {
  private readonly tables = new Map<number, Map<number, string>>();
  private nextPid = 2;
  private nextPipe = 0;
  constructor() {
    this.tables.set(1, new Map([[0, "tty"], [1, "tty"], [2, "tty"]]));
  }
  private table(pid: number) {
    const t = this.tables.get(pid);
    if (!t) throw new Error(`no process ${pid}`);
    return t;
  }
  /** pipe(): the lowest two free fds become the read and write ends. */
  pipe(pid: number): { read: number; write: number; id: number } {
    const t = this.table(pid);
    const free = (from: number) => {
      let fd = from;
      while (t.has(fd)) fd++;
      return fd;
    };
    const id = this.nextPipe++;
    const read = free(0);
    t.set(read, `r${id}`);
    const write = free(read + 1);
    t.set(write, `w${id}`);
    return { read, write, id };
  }
  /** fork(): the child gets a copy of every fd, so each pipe end gains a holder. */
  fork(pid: number): number {
    const child = this.nextPid++;
    this.tables.set(child, new Map(this.table(pid)));
    return child;
  }
  dup2(pid: number, from: number, to: number): void {
    const t = this.table(pid);
    const d = t.get(from);
    if (d === undefined) throw new Error("bad fd");
    t.set(to, d);
  }
  close(pid: number, fd: number): void {
    this.table(pid).delete(fd);
  }
  exit(pid: number): void {
    this.tables.delete(pid);
  }
  /** How many descriptors, across all processes, still hold the write end of the pipe. */
  writers(id: number): number {
    let n = 0;
    for (const t of this.tables.values()) for (const d of t.values()) if (d === `w${id}`) n++;
    return n;
  }
  /** A reader sees end-of-file only when no write end is left open anywhere. */
  readerSeesEof(id: number): boolean {
    return this.writers(id) === 0;
  }
}

/** Largest descriptor number select() can watch. */
export const SELECT_MAX_FD = 1023;

/** Bytes a non-blocking write() takes right now: as much as fits, never more (a short write, then EAGAIN). */
export const nonblockingWrite = (len: number, spaceInSocketBuffer: number): number => Math.min(len, spaceInSocketBuffer);
