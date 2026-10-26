/**
 * Concurrency-program model checker (Silberschatz ch. 6–8).
 *
 * A program is a few threads, each a straight line of small steps over shared
 * integers, mutexes, counting semaphores and condition variables. `explore`
 * runs it under every interleaving (breadth first, so a counterexample is the
 * shortest one) and reports:
 *   - a deadlock: no thread can move, yet some thread has not finished;
 *   - a failed `assert` (a lost update, two threads inside a critical section);
 *   - a misuse (unlocking a mutex you do not hold);
 *   - every final value of the shared variables, so "the counter can end at 1"
 *     is a fact, not an opinion.
 *
 * Condition variables follow POSIX: `cwait` atomically releases the mutex and
 * sleeps, `signal` wakes one sleeper (any one, so every choice is explored) and
 * is lost if nobody sleeps, and a woken thread must re-take the mutex. With
 * `spurious: true` a sleeper may also wake on its own, which is how `if`
 * instead of `while` around `cwait` is caught.
 */

/** A number, or the name of a thread register / shared variable. */
export type Operand = number | string;
export type Cmp = "==" | "!=" | "<" | "<=" | ">" | ">=";
/** A jump target: an index, or the name of a `label` step in the same thread. */
export type Target = number | string;

export type Op =
  | { op: "lock"; m: string }
  | { op: "unlock"; m: string }
  | { op: "wait"; s: string }
  | { op: "post"; s: string }
  | { op: "cwait"; c: string; m: string }
  | { op: "signal"; c: string }
  | { op: "broadcast"; c: string }
  | { op: "load"; reg: string; v: string }
  | { op: "add"; reg: string; k: number }
  | { op: "store"; v: string; reg: string }
  | { op: "set"; v: string; to: Operand }
  | { op: "inc"; v: string; k: number }
  | { op: "if"; a: Operand; cmp: Cmp; b: Operand; to: Target }
  | { op: "jmp"; to: Target }
  | { op: "assert"; a: Operand; cmp: Cmp; b: Operand; msg?: string }
  | { op: "label"; name: string };

export interface ThreadDef {
  name: string;
  code: readonly Op[];
}

export interface Program {
  /** shared integers (anything not listed starts at 0) */
  vars?: Record<string, number>;
  /** counting semaphores and their initial values */
  sems?: Record<string, number>;
  threads: readonly ThreadDef[];
  /** let a sleeping thread wake without a signal */
  spurious?: boolean;
  /** give up (and say `truncated`) after this many distinct states */
  maxStates?: number;
  /**
   * Also look for a thread that starves under a fair schedule (costs extra
   * memory). `true` watches every thread; a list of names watches only those,
   * for programs where some thread is meant to loop forever.
   */
  fairness?: boolean | string[];
}

export interface Counterexample {
  /** what went wrong */
  message: string;
  /** the interleaving that gets there, one line per step */
  trace: string[];
}

export interface Report {
  states: number;
  truncated: boolean;
  deadlock?: Counterexample;
  failure?: Counterexample;
  /** distinct final shared values over all runs that finished (sorted keys) */
  finals: Record<string, number>[];
  /**
   * A thread that never finishes in some run that is fair (every thread that
   * can move in the repeating part does move). Only set when `fairness` is on.
   */
  starvation?: Counterexample;
}

const CMP: Record<Cmp, (a: number, b: number) => boolean> = {
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
};

type Blocked = null | { k: "cv"; c: string; m: string } | { k: "relock"; m: string };

interface State {
  pc: number[];
  regs: Record<string, number>[];
  vars: Record<string, number>;
  /** mutex name -> index of the owning thread (absent = free) */
  locks: Record<string, number>;
  sems: Record<string, number>;
  blocked: Blocked[];
}

const sorted = (o: Record<string, unknown>) => JSON.stringify(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));

const keyOf = (s: State) =>
  [s.pc.join(","), s.regs.map(sorted).join("|"), sorted(s.vars), sorted(s.locks), sorted(s.sems), JSON.stringify(s.blocked)].join("#");

const clone = (s: State): State => ({
  pc: [...s.pc],
  regs: s.regs.map((r) => ({ ...r })),
  vars: { ...s.vars },
  locks: { ...s.locks },
  sems: { ...s.sems },
  blocked: [...s.blocked],
});

/** Drop `label` steps and turn named jump targets into indices. */
function resolve(code: readonly Op[]): Exclude<Op, { op: "label" }>[] {
  const at: Record<string, number> = {};
  let n = 0;
  for (const o of code) {
    if (o.op !== "label") n++;
    else if (o.name in at) throw new Error(`duplicate label ${o.name}`);
    else at[o.name] = n;
  }
  const to = (t: Target) => {
    if (typeof t === "number") return t;
    if (!(t in at)) throw new Error(`unknown label ${t}`);
    return at[t];
  };
  const out: Exclude<Op, { op: "label" }>[] = [];
  for (const o of code) {
    if (o.op === "label") continue;
    out.push(o.op === "if" || o.op === "jmp" ? { ...o, to: to(o.to) } : o);
  }
  return out;
}

export const opText = (o: Op): string => {
  switch (o.op) {
    case "lock": return `lock(${o.m})`;
    case "unlock": return `unlock(${o.m})`;
    case "wait": return `sem_wait(${o.s})`;
    case "post": return `sem_post(${o.s})`;
    case "cwait": return `cond_wait(${o.c}, ${o.m})`;
    case "signal": return `cond_signal(${o.c})`;
    case "broadcast": return `cond_broadcast(${o.c})`;
    case "load": return `${o.reg} = ${o.v}`;
    case "add": return `${o.reg} += ${o.k}`;
    case "store": return `${o.v} = ${o.reg}`;
    case "set": return `${o.v} = ${o.to}`;
    case "inc": return `${o.v} += ${o.k}`;
    case "if": return `if (${o.a} ${o.cmp} ${o.b}) goto ${o.to}`;
    case "jmp": return `goto ${o.to}`;
    case "assert": return `assert(${o.a} ${o.cmp} ${o.b})`;
    case "label": return `${o.name}:`;
  }
};

/**
 * Find a reachable cycle that a fair scheduler can repeat forever while thread
 * `t` is unfinished. A cycle is fair when every thread that can move somewhere
 * on it does move on it, so a thread that is merely never picked does not count;
 * only a thread that cannot finish (spinning on a flag nobody sets, blocked
 * behind a lock holder that loops forever) does.
 */
function findStarvation(
  edges: Map<string, [number, string][]>,
  finished: (key: string, t: number) => boolean,
  nThreads: number,
): { thread: number; key: string } | null {
  // iterative Tarjan over the explored graph
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let counter = 0;
  for (const root of edges.keys()) {
    if (index.has(root)) continue;
    const work: [string, number][] = [[root, 0]];
    index.set(root, counter);
    low.set(root, counter++);
    stack.push(root);
    onStack.add(root);
    while (work.length) {
      const top = work[work.length - 1];
      const [v, i] = top;
      const out = edges.get(v) ?? [];
      if (i < out.length) {
        top[1]++;
        const w = out[i][1];
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter++);
          stack.push(w);
          onStack.add(w);
          work.push([w, 0]);
        } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1][0];
        low.set(parent, Math.min(low.get(parent)!, low.get(v)!));
      }
      if (low.get(v) !== index.get(v)) continue;
      const comp = new Set<string>();
      for (let w = ""; w !== v; ) {
        w = stack.pop()!;
        onStack.delete(w);
        comp.add(w);
      }
      const inside = [...comp].flatMap((k) => (edges.get(k) ?? []).filter(([, to]) => comp.has(to)).map(([t]) => t));
      if (!inside.length) continue; // a single state with no loop
      const moves = new Set(inside);
      const canMove = new Set([...comp].flatMap((k) => (edges.get(k) ?? []).map(([t]) => t)));
      if ([...canMove].some((t) => !moves.has(t))) continue; // unfair: someone able to move is ignored forever
      for (let t = 0; t < nThreads; t++) {
        if (!finished(v, t)) return { thread: t, key: v };
      }
    }
  }
  return null;
}

/** Explore every interleaving of `prog`. */
export function explore(prog: Program): Report {
  const code = prog.threads.map((t) => resolve(t.code));
  const names = prog.threads.map((t) => t.name);
  const limit = prog.maxStates ?? 200_000;
  const init: State = {
    pc: code.map(() => 0),
    regs: code.map(() => ({})),
    vars: { ...prog.vars },
    locks: {},
    sems: { ...prog.sems },
    blocked: code.map(() => null),
  };
  const done = (s: State, t: number) => s.pc[t] >= code[t].length;
  const val = (s: State, t: number, x: Operand) => (typeof x === "number" ? x : (s.regs[t][x] ?? s.vars[x] ?? 0));

  interface Move {
    next?: State;
    label: string;
    problem?: string;
  }

  /** Every state thread t can step to (empty when it is blocked or finished). */
  function moves(s: State, t: number): Move[] {
    const b = s.blocked[t];
    if (b) {
      const wake = (): State => {
        const n = clone(s);
        n.blocked[t] = { k: "relock", m: b.m };
        return n;
      };
      if (b.k === "cv") return prog.spurious ? [{ next: wake(), label: `${names[t]}: wakes without a signal` }] : [];
      if (s.locks[b.m] !== undefined) return [];
      const n = clone(s);
      n.locks[b.m] = t;
      n.blocked[t] = null;
      n.pc[t]++;
      return [{ next: n, label: `${names[t]}: re-takes ${b.m} after cond_wait` }];
    }
    if (done(s, t)) return [];
    const o = code[t][s.pc[t]];
    const label = `${names[t]}: ${opText(o)}`;
    const step = (f: (n: State) => void, advance = true): Move => {
      const n = clone(s);
      f(n);
      if (advance) n.pc[t]++;
      return { next: n, label };
    };
    switch (o.op) {
      case "lock":
        return s.locks[o.m] === undefined ? [step((n) => void (n.locks[o.m] = t))] : [];
      case "unlock":
        if (s.locks[o.m] !== t) return [{ label, problem: `${names[t]} unlocks ${o.m} without holding it` }];
        return [step((n) => void delete n.locks[o.m])];
      case "wait":
        return (s.sems[o.s] ?? 0) > 0 ? [step((n) => void (n.sems[o.s]--))] : [];
      case "post":
        return [step((n) => void (n.sems[o.s] = (n.sems[o.s] ?? 0) + 1))];
      case "cwait":
        if (s.locks[o.m] !== t) return [{ label, problem: `${names[t]} calls cond_wait without holding ${o.m}` }];
        return [step((n) => {
          delete n.locks[o.m];
          n.blocked[t] = { k: "cv", c: o.c, m: o.m };
        }, false)];
      case "signal":
      case "broadcast": {
        const sleepers = s.blocked.flatMap((x, i) => (x && x.k === "cv" && x.c === o.c ? [i] : []));
        if (!sleepers.length) return [step(() => {})];
        const wakeUp = (n: State, i: number) => {
          const x = n.blocked[i] as { k: "cv"; m: string };
          n.blocked[i] = { k: "relock", m: x.m };
        };
        if (o.op === "broadcast") return [step((n) => sleepers.forEach((i) => wakeUp(n, i)))];
        return sleepers.map((i) => ({ ...step((n) => wakeUp(n, i)), label: `${label} (wakes ${names[i]})` }));
      }
      case "load":
        return [step((n) => void (n.regs[t][o.reg] = s.vars[o.v] ?? 0))];
      case "add":
        return [step((n) => void (n.regs[t][o.reg] = (s.regs[t][o.reg] ?? 0) + o.k))];
      case "store":
        return [step((n) => void (n.vars[o.v] = s.regs[t][o.reg] ?? 0))];
      case "set":
        return [step((n) => void (n.vars[o.v] = val(s, t, o.to)))];
      case "inc":
        return [step((n) => void (n.vars[o.v] = (s.vars[o.v] ?? 0) + o.k))];
      case "if":
        return [step((n) => void (n.pc[t] = CMP[o.cmp](val(s, t, o.a), val(s, t, o.b)) ? (o.to as number) : s.pc[t] + 1), false)];
      case "jmp":
        return [step((n) => void (n.pc[t] = o.to as number), false)];
      case "assert":
        if (!CMP[o.cmp](val(s, t, o.a), val(s, t, o.b))) {
          return [{ label, problem: o.msg ?? `assertion failed: ${o.a} ${o.cmp} ${o.b} (${val(s, t, o.a)} vs ${val(s, t, o.b)})` }];
        }
        return [step(() => {})];
    }
  }

  const parent = new Map<string, [string, string]>();
  const traceTo = (key: string, last?: string): string[] => {
    const out: string[] = last ? [last] : [];
    for (let k = key, p = parent.get(k); p; p = parent.get(k)) {
      out.push(p[1]);
      k = p[0];
    }
    return out.reverse();
  };

  const rootKey = keyOf(init);
  const seen = new Set([rootKey]);
  let frontier: [string, State][] = [[rootKey, init]];
  const report: Report = { states: 1, truncated: false, finals: [] };
  const finals = new Map<string, Record<string, number>>();
  /** transition graph, kept only for the fairness check: key -> [thread, next key][] */
  const edges = new Map<string, [number, string][]>();
  const states = new Map<string, State>();

  while (frontier.length && !report.failure) {
    const next: [string, State][] = [];
    for (const [key, s] of frontier) {
      let any = false;
      for (let t = 0; t < code.length && !report.failure; t++) {
        for (const m of moves(s, t)) {
          if (m.problem) {
            report.failure = { message: m.problem, trace: traceTo(key, m.label) };
            break;
          }
          any = true;
          const k = keyOf(m.next!);
          if (prog.fairness) {
            states.set(key, s);
            (edges.get(key) ?? edges.set(key, []).get(key)!).push([t, k]);
          }
          if (seen.has(k)) continue;
          if (seen.size >= limit) {
            report.truncated = true;
            continue;
          }
          seen.add(k);
          parent.set(k, [key, m.label]);
          next.push([k, m.next!]);
        }
      }
      if (report.failure || any) continue;
      if (code.every((_, t) => done(s, t))) {
        finals.set(sorted(s.vars), Object.fromEntries(Object.entries(s.vars).sort(([a], [b]) => (a < b ? -1 : 1))));
      } else if (!report.deadlock) {
        const stuck = code.flatMap((_, t) => (done(s, t) ? [] : [names[t]]));
        report.deadlock = { message: `deadlock: ${stuck.join(", ")} can never move`, trace: traceTo(key) };
      }
    }
    frontier = next;
  }
  report.states = seen.size;
  report.finals = [...finals.values()];
  if (prog.fairness && !report.failure && !report.truncated) {
    const watched = Array.isArray(prog.fairness) ? prog.fairness : names;
    const starved = findStarvation(edges, (k, t) => done(states.get(k)!, t) || !watched.includes(names[t]), code.length);
    if (starved) {
      report.starvation = {
        message: `starvation: ${names[starved.thread]} never finishes under a fair schedule`,
        trace: traceTo(starved.key),
      };
    }
  }
  return report;
}

/** The final value each shared variable can end at over every finished run. */
export const finalValues = (r: Report, v: string): number[] =>
  [...new Set(r.finals.map((f) => f[v] ?? 0))].sort((a, b) => a - b);

/** No failure, no deadlock, the search was complete, and some run finishes (a spin forever is not safe). */
export const isSafe = (r: Report): boolean => !r.failure && !r.deadlock && !r.truncated && r.finals.length > 0 && !r.starvation;
