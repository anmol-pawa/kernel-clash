/**
 * Concurrency lab engine: a tiny text DSL over `threads.ts` plus authored
 * challenges. Every challenge's starter program is proven unsafe, and its
 * reference fix proven safe, by the interleaving explorer (see tests).
 *
 * DSL, one statement per line (`#` starts a comment):
 *   var n = 0        shared integer          sem s = 1       counting semaphore
 *   spurious         sleepers may wake on their own
 *   thread A         starts a thread; its statements follow
 *   lock m / unlock m / wait s / post s / cwait c m / signal c / broadcast c
 *   r = x            load (registers are named r, r1, r2 ...)
 *   x = r            store          x = 5   set          r += 1   x += 1
 *   if a == b goto L / goto L / assert a == b / L:   (a label)
 */
import { explore, isSafe, finalValues, type Cmp, type Op, type Operand, type Program, type Report, type ThreadDef } from "./threads";

export interface ParseError {
  line: number;
  message: string;
}
export type Parsed = { ok: true; program: Program } | { ok: false; error: ParseError };

const ID = /^[A-Za-z_]\w*$/;
const REG = /^r\d*$/;
const CMPS = ["==", "!=", "<=", ">=", "<", ">"] as const;
export const MAX_THREADS = 3;
export const MAX_OPS = 20;

export function parseProgram(src: string): Parsed {
  const vars: Record<string, number> = {};
  const sems: Record<string, number> = {};
  const threads: { name: string; code: Op[] }[] = [];
  let spurious = false;
  let n = 0;
  const fail = (message: string): Parsed => ({ ok: false, error: { line: n, message } });
  const num = (t: string) => (/^-?\d+$/.test(t) ? Number(t) : null);
  const operand = (t: string): Operand | null => num(t) ?? (ID.test(t) ? t : null);

  for (const raw of src.split("\n")) {
    n++;
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const w = line.split(/\s+/);
    const cur = threads[threads.length - 1];
    if (w[0] === "spurious" && w.length === 1) { spurious = true; continue; }
    if ((w[0] === "var" || w[0] === "sem") && w.length === 4 && w[2] === "=") {
      const v = num(w[3]!);
      if (!ID.test(w[1]!) || v === null) return fail(`expected "${w[0]} name = number"`);
      if (w[0] === "sem" && v < 0) return fail("a semaphore cannot start negative");
      (w[0] === "var" ? vars : sems)[w[1]!] = v;
      continue;
    }
    if (w[0] === "thread") {
      if (w.length !== 2 || !ID.test(w[1]!)) return fail('expected "thread NAME"');
      if (threads.length >= MAX_THREADS) return fail(`at most ${MAX_THREADS} threads`);
      if (threads.some((t) => t.name === w[1])) return fail(`thread ${w[1]} is already defined`);
      threads.push({ name: w[1]!, code: [] });
      continue;
    }
    if (!cur) return fail('start with "thread NAME" before statements');
    if (cur.code.length >= MAX_OPS) return fail(`at most ${MAX_OPS} statements per thread`);
    const push = (o: Op) => { cur.code.push(o); return null; };
    const one = (t: string | undefined) => (t !== undefined && ID.test(t) ? t : null);
    let err: string | null = null;
    const [k, a, b] = w;
    if (k === "lock" || k === "unlock") {
      const m = one(a);
      err = w.length === 2 && m ? push({ op: k, m }) : `expected "${k} NAME"`;
    } else if (k === "wait" || k === "post") {
      const s = one(a);
      if (w.length !== 2 || !s) err = `expected "${k} NAME"`;
      else if (!(s in sems)) err = `declare it first: sem ${s} = 1`;
      else err = push({ op: k, s });
    } else if (k === "signal" || k === "broadcast") {
      const c = one(a);
      err = w.length === 2 && c ? push({ op: k, c }) : `expected "${k} NAME"`;
    } else if (k === "cwait") {
      const c = one(a), m = one(b);
      err = w.length === 3 && c && m ? push({ op: "cwait", c, m }) : 'expected "cwait COND MUTEX"';
    } else if (k === "goto") {
      const to = one(a);
      err = w.length === 2 && to ? push({ op: "jmp", to }) : 'expected "goto LABEL"';
    } else if (k === "if" || k === "assert") {
      const x = operand(w[1] ?? ""), c = w[2] as Cmp | undefined, y = operand(w[3] ?? "");
      if (x === null || y === null || !c || !(CMPS as readonly string[]).includes(c)) err = `expected "${k} a == b${k === "if" ? " goto L" : ""}"`;
      else if (k === "assert") err = w.length === 4 ? push({ op: "assert", a: x, cmp: c, b: y }) : 'expected "assert a == b"';
      else {
        const to = one(w[5]);
        err = w.length === 6 && w[4] === "goto" && to ? push({ op: "if", a: x, cmp: c, b: y, to }) : 'expected "if a == b goto LABEL"';
      }
    } else if (w.length === 1 && /^[A-Za-z_]\w*:$/.test(k!)) {
      err = push({ op: "label", name: k!.slice(0, -1) });
    } else if (w.length === 3 && a === "=" && ID.test(k!)) {
      const rhs = operand(b!);
      if (rhs === null) err = "the right side must be a name or a number";
      else if (REG.test(k!)) err = typeof rhs === "string" && !REG.test(rhs) ? push({ op: "load", reg: k!, v: rhs }) : 'a register is loaded from a shared variable: "r = x"';
      else err = typeof rhs === "string" && REG.test(rhs) ? push({ op: "store", v: k!, reg: rhs }) : push({ op: "set", v: k!, to: rhs });
    } else if (w.length === 3 && a === "+=" && ID.test(k!) && num(b!) !== null) {
      err = REG.test(k!) ? push({ op: "add", reg: k!, k: num(b!)! }) : push({ op: "inc", v: k!, k: num(b!)! });
    } else err = `cannot read "${line}"`;
    if (err) return fail(err);
  }
  if (!threads.length) return { ok: false, error: { line: 1, message: "define at least one thread" } };
  for (const t of threads) {
    const labels = new Set(t.code.filter((o) => o.op === "label").map((o) => (o as { name: string }).name));
    for (const o of t.code) {
      if ((o.op === "if" || o.op === "jmp") && typeof o.to === "string" && !labels.has(o.to)) return { ok: false, error: { line: 1, message: `thread ${t.name}: no label "${o.to}"` } };
    }
    if (labels.size !== t.code.filter((o) => o.op === "label").length) return { ok: false, error: { line: 1, message: `thread ${t.name}: duplicate label` } };
  }
  const defs: ThreadDef[] = threads;
  return { ok: true, program: { vars, sems, threads: defs, spurious, maxStates: 60_000 } };
}

export type RunResult = { ok: true; report: Report; program: Program } | { ok: false; error: ParseError };

export function runConc(src: string): RunResult {
  const p = parseProgram(src);
  if (!p.ok) return p;
  try {
    return { ok: true, report: explore(p.program), program: p.program };
  } catch (e) {
    return { ok: false, error: { line: 1, message: e instanceof Error ? e.message : "cannot run" } };
  }
}

/** One plain-language verdict line for a report. */
export function verdict(r: Report): { safe: boolean; text: string; trace: string[] } {
  if (r.failure) return { safe: false, text: `FAILS: ${r.failure.message}`, trace: r.failure.trace };
  if (r.deadlock) return { safe: false, text: `DEADLOCK: ${r.deadlock.message}`, trace: r.deadlock.trace };
  if (r.truncated) return { safe: false, text: "Too many states to finish checking. Shrink the program.", trace: [] };
  const fin = r.finals.map((f) => JSON.stringify(f)).join(" or ");
  if (r.finals.length > 1) return { safe: isSafe(r), text: `No crash or deadlock in ${r.states} states, but the result depends on the schedule: ${fin}`, trace: [] };
  return { safe: isSafe(r), text: `SAFE in all ${r.states} states. Final values: ${fin}`, trace: [] };
}

export interface ConcChallenge {
  id: string;
  title: string;
  goal: string;
  hint: string;
  starter: string;
  /** extra condition beyond "safe" */
  extra?: (r: Report) => boolean;
  /** reference fix (tests prove it passes) */
  solution: string;
}

export const CONC_CHALLENGES: readonly ConcChallenge[] = [
  {
    id: "lost-update",
    title: "Find the missing lock",
    goal: "Two threads each add 1 to count. Make count always end at 2.",
    hint: "The read-modify-write must be one critical section.",
    starter: `var count = 0
thread A
r = count
r += 1
count = r
thread B
r = count
r += 1
count = r`,
    extra: (r) => finalValues(r, "count").every((v) => v === 2),
    solution: `var count = 0
thread A
lock m
r = count
r += 1
count = r
unlock m
thread B
lock m
r = count
r += 1
count = r
unlock m`,
  },
  {
    id: "mutual-exclusion",
    title: "Two inside at once",
    goal: "The assert says only one thread may be in the critical section. Make it hold in every interleaving.",
    hint: "Guard both the enter and the assert with the same mutex.",
    starter: `var inside = 0
thread A
inside += 1
assert inside == 1
inside += -1
thread B
inside += 1
assert inside == 1
inside += -1`,
    solution: `var inside = 0
thread A
lock m
inside += 1
assert inside == 1
inside += -1
unlock m
thread B
lock m
inside += 1
assert inside == 1
inside += -1
unlock m`,
  },
  {
    id: "lock-order",
    title: "The lock-order fix",
    goal: "A takes a then b, B takes b then a. Remove the deadlock without removing a lock.",
    hint: "Give every thread the same global order for taking locks.",
    starter: `thread A
lock a
lock b
unlock b
unlock a
thread B
lock b
lock a
unlock a
unlock b`,
    solution: `thread A
lock a
lock b
unlock b
unlock a
thread B
lock a
lock b
unlock b
unlock a`,
  },
  {
    id: "lost-wakeup",
    title: "The lost wakeup",
    goal: "The consumer sleeps on a condition variable but the producer may signal first. Make it finish in every order.",
    hint: "Sleep only while the condition is still false, and test it under the mutex.",
    starter: `var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
cwait c m
assert ready == 1
unlock m`,
    solution: `var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
again:
if ready == 1 goto go
cwait c m
goto again
go:
assert ready == 1
unlock m`,
  },
  {
    id: "if-vs-while",
    title: "if is not while",
    goal: "This consumer rechecks nothing after waking, and sleepers can wake spuriously. Make the assert always true.",
    hint: "After cwait returns, the condition may still be false: loop back and test it again.",
    starter: `spurious
var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
if ready == 1 goto go
cwait c m
go:
assert ready == 1
unlock m`,
    solution: `spurious
var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
again:
if ready == 1 goto go
cwait c m
goto again
go:
assert ready == 1
unlock m`,
  },
  {
    id: "sem-mutex",
    title: "A semaphore that is not a mutex",
    goal: "A semaphore guards the critical section but it starts at the wrong value. Fix it so only one thread is inside.",
    hint: "A binary semaphore used as a lock starts at 1.",
    starter: `sem gate = 2
var inside = 0
thread A
wait gate
inside += 1
assert inside == 1
inside += -1
post gate
thread B
wait gate
inside += 1
assert inside == 1
inside += -1
post gate`,
    solution: `sem gate = 1
var inside = 0
thread A
wait gate
inside += 1
assert inside == 1
inside += -1
post gate
thread B
wait gate
inside += 1
assert inside == 1
inside += -1
post gate`,
  },
  {
    id: "rendezvous",
    title: "Meet in the middle",
    goal: "Each thread must wait for the other to arrive, but both wait first. Reorder so both finish.",
    hint: "Announce your own arrival (post) before you wait for the other.",
    starter: `sem a = 0
sem b = 0
thread A
wait b
post a
thread B
wait a
post b`,
    solution: `sem a = 0
sem b = 0
thread A
post a
wait b
thread B
post b
wait a`,
  },
  {
    id: "early-exit",
    title: "The forgotten unlock",
    goal: "A skips its unlock on one path and B then waits forever. Make every path release the mutex.",
    hint: "Both exits from the critical section need an unlock.",
    starter: `var flag = 0
thread A
lock m
if flag == 0 goto out
unlock m
out:
flag = 1
thread B
lock m
flag += 1
unlock m`,
    solution: `var flag = 0
thread A
lock m
if flag == 0 goto out
unlock m
goto end
out:
flag = 1
unlock m
end:
thread B
lock m
flag += 1
unlock m`,
  },
];

/** Is `src` a passing answer to challenge `c`? */
export function checkConcChallenge(c: ConcChallenge, src: string): { passed: boolean; message: string } {
  const r = runConc(src);
  if (!r.ok) return { passed: false, message: `line ${r.error.line}: ${r.error.message}` };
  const v = verdict(r.report);
  if (!v.safe) return { passed: false, message: v.text };
  if (c.extra && !c.extra(r.report)) return { passed: false, message: `Safe, but not the goal: ${v.text}` };
  return { passed: true, message: v.text };
}
