/**
 * Contention: false sharing on a cache line, and the futex-based mutex that
 * keeps its fast path in user space.
 *
 * Facts follow Hennessy & Patterson (a write needs the line in Modified state,
 * so another core's copy is invalidated and the next write by that core misses;
 * x86 lines are 64 bytes) and Drepper, "Futexes Are Tricky" (mutex2: state 0
 * unlocked, 1 locked with no waiters, 2 locked with possible waiters; the
 * uncontended lock and unlock are one atomic instruction each, and the kernel
 * is entered only to wait or to wake).
 */

export const LINE_BYTES = 64;

export interface CoreWrite {
  core: number;
  addr: number;
}

/**
 * Write-invalidate coherence for writes only: a write hits when this core
 * already holds the line Modified; otherwise it misses (fetching the line and
 * invalidating any other copy). Returns the number of misses.
 */
export function coherenceMisses(writes: readonly CoreWrite[], lineBytes = LINE_BYTES): number {
  const owner = new Map<number, number>();
  let misses = 0;
  for (const { core, addr } of writes) {
    const line = Math.floor(addr / lineBytes);
    if (owner.get(line) !== core) {
      misses++;
      owner.set(line, core);
    }
  }
  return misses;
}

/** Two cores take turns incrementing their own counter `rounds` times each. */
export function alternatingWrites(addrA: number, addrB: number, rounds: number): CoreWrite[] {
  const out: CoreWrite[] = [];
  for (let i = 0; i < rounds; i++) out.push({ core: 0, addr: addrA }, { core: 1, addr: addrB });
  return out;
}

/** Total time for the writes given a hit and a miss cost (same unit). */
export const writeTime = (misses: number, writes: number, hit: number, miss: number) => misses * miss + (writes - misses) * hit;

export type FutexOp = { t: string; op: "lock" | "unlock" };

export interface FutexResult {
  /** futex(FUTEX_WAIT) calls: a thread went to sleep */
  waits: number;
  /** futex(FUTEX_WAKE) calls */
  wakes: number;
  /** locks taken by one atomic instruction with no system call */
  fastLocks: number;
  /** unlocks done by one atomic instruction with no system call */
  fastUnlocks: number;
  /** thread holding the lock at the end, or null */
  holder: string | null;
  /** threads asleep at the end, in wake order */
  sleeping: string[];
  /** futex word after each op */
  states: number[];
}

/**
 * Run lock/unlock operations on a Drepper mutex2. A `lock` by a thread that
 * must sleep leaves it queued; the first `unlock` that wakes a sleeper hands
 * it the lock at once (it re-takes the word with state 2, as it cannot know
 * whether more sleepers remain).
 */
export function runFutex(ops: readonly FutexOp[]): FutexResult {
  let state = 0;
  let holder: string | null = null;
  const queue: string[] = [];
  const r: FutexResult = { waits: 0, wakes: 0, fastLocks: 0, fastUnlocks: 0, holder: null, sleeping: [], states: [] };
  for (const { t, op } of ops) {
    if (op === "lock") {
      if (queue.includes(t) || holder === t) throw new Error(`${t} is already waiting or holds the lock`);
      if (state === 0) {
        state = 1; // CAS(0 -> 1)
        holder = t;
        r.fastLocks++;
      } else {
        state = 2; // xchg to 2: tell the holder there are sleepers
        r.waits++;
        queue.push(t);
      }
    } else {
      if (holder !== t) throw new Error(`${t} does not hold the lock`);
      if (state === 1) {
        state = 0;
        holder = null;
        r.fastUnlocks++;
      } else {
        state = 0;
        r.wakes++;
        const next = queue.shift();
        if (next) {
          state = 2; // the woken thread's xchg(state, 2) saw 0 and took the lock
          holder = next;
        } else holder = null;
      }
    }
    r.states.push(state);
  }
  r.holder = holder;
  r.sleeping = [...queue];
  return r;
}

/** CPU time a waiter burns until the lock is free: spinning vs sleeping. */
export function waitCost(holdNs: number, sleepWakeNs: number) {
  return { spin: holdNs, sleep: sleepWakeNs, spinWins: holdNs < sleepWakeNs };
}
