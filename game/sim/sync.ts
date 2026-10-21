/**
 * Synchronization simulators (Silberschatz ch. 6–7).
 *
 * Interleavings: a thread is a straight line of machine-level steps on shared
 * variables (load into a private register, add to it, store it back), so
 * `counter++` is three steps and a race shows up as a lost update. `runSchedule`
 * runs one interleaving; `finalValues` tries every interleaving.
 *
 * Entry protocols: a two-process entry/exit protocol (Peterson's and broken
 * variants) as a step function, explored state by state to check mutual
 * exclusion and spot states where both processes spin forever.
 *
 * Semaphores: the blocking (no busy waiting) definition, where the value goes
 * negative and its magnitude counts the waiting processes.
 */

export type Instr =
  | { op: "load"; reg: string; from: string }
  | { op: "add"; reg: string; k: number }
  | { op: "store"; to: string; reg: string };

export interface SyncThread {
  name: string;
  code: readonly Instr[];
}

/** `v++` (k = 1) or `v--` (k = −1) as the three steps the machine runs. */
export const increment = (v: string, reg: string, k = 1): Instr[] => [
  { op: "load", reg, from: v },
  { op: "add", reg, k },
  { op: "store", to: v, reg },
];

export const instrText = (i: Instr): string =>
  i.op === "load" ? `${i.reg} = ${i.from}` : i.op === "store" ? `${i.to} = ${i.reg}` : `${i.reg} = ${i.reg} ${i.k < 0 ? "-" : "+"} ${Math.abs(i.k)}`;

export interface Step {
  thread: number;
  instr: Instr;
  /** the register or variable this step wrote, and its new value */
  wrote: string;
  value: number;
  shared: Record<string, number>;
}

/** Run one interleaving: `schedule[t]` is the thread that takes step t. */
export function runSchedule(init: Record<string, number>, threads: readonly SyncThread[], schedule: readonly number[]) {
  const shared = { ...init };
  const regs = threads.map(() => ({}) as Record<string, number>);
  const pcs = threads.map(() => 0);
  const steps: Step[] = [];
  for (const t of schedule) {
    const instr = threads[t].code[pcs[t]++];
    if (!instr) throw new Error(`${threads[t].name} has no step left`);
    let wrote: string;
    let value: number;
    if (instr.op === "load") {
      if (!(instr.from in shared)) throw new Error(`unknown variable ${instr.from}`);
      value = regs[t][(wrote = instr.reg)] = shared[instr.from];
    } else if (instr.op === "add") {
      if (!(instr.reg in regs[t])) throw new Error(`${instr.reg} read before it was loaded`);
      value = regs[t][(wrote = instr.reg)] = regs[t][instr.reg] + instr.k;
    } else {
      if (!(instr.reg in regs[t])) throw new Error(`${instr.reg} read before it was loaded`);
      value = shared[(wrote = instr.to)] = regs[t][instr.reg];
    }
    steps.push({ thread: t, instr, wrote, value, shared: { ...shared } });
  }
  const done = pcs.every((pc, t) => pc === threads[t].code.length);
  return { shared, steps, done };
}

/** Every interleaving of threads with these step counts, each as a schedule. */
export function interleavings(lens: readonly number[]): number[][] {
  const out: number[][] = [];
  const left = [...lens];
  const cur: number[] = [];
  const total = lens.reduce((a, b) => a + b, 0);
  const go = () => {
    if (cur.length === total) return void out.push([...cur]);
    for (let t = 0; t < left.length; t++) {
      if (!left[t]) continue;
      left[t]--;
      cur.push(t);
      go();
      cur.pop();
      left[t]++;
    }
  };
  go();
  return out;
}

/** The sorted set of values `v` can end with, over every interleaving. */
export function finalValues(init: Record<string, number>, threads: readonly SyncThread[], v: string): number[] {
  const seen = new Set<number>();
  for (const s of interleavings(threads.map((t) => t.code.length))) seen.add(runSchedule(init, threads, s).shared[v]);
  return [...seen].sort((a, b) => a - b);
}

/* ---- two-process entry protocols ---- */

/** Shared flags and turn, plus each process's program counter. */
export interface PState {
  pc: [number, number];
  flag: [boolean, boolean];
  turn: 0 | 1;
}

export interface Protocol {
  name: string;
  /** the pc value that means "in the critical section" */
  cs: number;
  /** process i takes one step; a waiting loop whose condition holds leaves the state unchanged */
  step: (s: PState, i: 0 | 1) => PState;
}

const set = (s: PState, i: 0 | 1, pc: number, patch: Partial<Omit<PState, "pc">> = {}): PState => {
  const p: [number, number] = [...s.pc];
  p[i] = pc;
  return { ...s, ...patch, pc: p };
};
const withFlag = (s: PState, i: 0 | 1, v: boolean): [boolean, boolean] => {
  const f: [boolean, boolean] = [...s.flag];
  f[i] = v;
  return f;
};

/**
 * Peterson's solution (Silberschatz Fig. 6.3), looping forever:
 *   0 flag[i] = true   1 turn = j   2 while (flag[j] && turn == j);   3 critical section   4 flag[i] = false
 */
export const PETERSON: Protocol = {
  name: "Peterson",
  cs: 3,
  step(s, i) {
    const j = (1 - i) as 0 | 1;
    switch (s.pc[i]) {
      case 0:
        return set(s, i, 1, { flag: withFlag(s, i, true) });
      case 1:
        return set(s, i, 2, { turn: j });
      case 2:
        return s.flag[j] && s.turn === j ? s : set(s, i, 3);
      case 3:
        return set(s, i, 4);
      default:
        return set(s, i, 0, { flag: withFlag(s, i, false) });
    }
  },
};

/** Check the other's flag, then raise your own: both can pass the check first. */
export const CHECK_THEN_FLAG: Protocol = {
  name: "check then flag",
  cs: 2,
  step(s, i) {
    const j = (1 - i) as 0 | 1;
    switch (s.pc[i]) {
      case 0:
        return s.flag[j] ? s : set(s, i, 1);
      case 1:
        return set(s, i, 2, { flag: withFlag(s, i, true) });
      case 2:
        return set(s, i, 3);
      default:
        return set(s, i, 0, { flag: withFlag(s, i, false) });
    }
  },
};

/** Raise your flag, then wait while the other's is up: safe, but both can wait forever. */
export const FLAG_THEN_CHECK: Protocol = {
  name: "flag then check",
  cs: 2,
  step(s, i) {
    const j = (1 - i) as 0 | 1;
    switch (s.pc[i]) {
      case 0:
        return set(s, i, 1, { flag: withFlag(s, i, true) });
      case 1:
        return s.flag[j] ? s : set(s, i, 2);
      case 2:
        return set(s, i, 3);
      default:
        return set(s, i, 0, { flag: withFlag(s, i, false) });
    }
  },
};

export const START: PState = { pc: [0, 0], flag: [false, false], turn: 0 };
const key = (s: PState) => `${s.pc[0]},${s.pc[1]},${+s.flag[0]},${+s.flag[1]},${s.turn}`;
const same = (a: PState, b: PState) => key(a) === key(b);

/**
 * Explore every reachable state from START (either turn value). Reports
 * whether both can be in the critical section at once, and whether some
 * state lets neither process make progress (both spinning: a deadlock).
 */
export function explore(p: Protocol) {
  const seen = new Map<string, PState>();
  const todo: PState[] = [START, { ...START, turn: 1 }];
  for (const s of todo) seen.set(key(s), s);
  let mutualExclusion = true;
  let stuck = false;
  while (todo.length) {
    const s = todo.pop()!;
    if (s.pc[0] === p.cs && s.pc[1] === p.cs) mutualExclusion = false;
    const next = ([0, 1] as const).map((i) => p.step(s, i));
    if (next.every((n) => same(n, s))) stuck = true;
    for (const n of next) {
      if (seen.has(key(n))) continue;
      seen.set(key(n), n);
      todo.push(n);
    }
  }
  return { mutualExclusion, stuck, states: seen.size };
}

/** Run a protocol on a fixed schedule; returns every state, START first. */
export function trace(p: Protocol, schedule: readonly (0 | 1)[], from: PState = START): PState[] {
  const out = [from];
  for (const i of schedule) out.push(p.step(out.at(-1)!, i));
  return out;
}

/* ---- semaphores ---- */

export type SemOp = { op: "wait" | "signal"; who: string };

/**
 * A blocking semaphore (Silberschatz §6.6.2): wait() decrements and blocks the
 * caller if the value is now negative; signal() increments and, if anyone is
 * waiting, wakes the longest waiter (a FIFO queue). Blocked processes don't
 * issue operations, so an op from a blocked process is an error.
 */
export function runSemaphore(init: number, ops: readonly SemOp[]) {
  let value = init;
  const queue: string[] = [];
  const woken: string[] = [];
  for (const { op, who } of ops) {
    if (queue.includes(who)) throw new Error(`${who} is blocked`);
    if (op === "wait") {
      value--;
      if (value < 0) queue.push(who);
    } else {
      value++;
      if (value <= 0) woken.push(queue.shift()!);
    }
  }
  return { value, blocked: queue, woken };
}
