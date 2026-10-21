import type { Generator, InterleaveQ, McqQ, MultiQ, NumericQ } from "@/game/engine/question";
import { PETERSON, START, finalValues, increment, interleavings, lostUpdates, runSchedule, runSemaphore, trace, type SemOp, type SyncThread } from "@/game/sim/sync";
import { rng } from "@/lib/rng";

/** `v += k` (or `v -= k`) as C, for prompts. */
const opText = (v: string, k: number) => (k === 1 ? `${v}++` : k === -1 ? `${v}--` : k > 0 ? `${v} += ${k}` : `${v} -= ${-k}`);

interface Setup {
  v: string;
  init: number;
  threads: SyncThread[];
  /** what each thread runs, in words */
  says: string[];
}

const sync = (name: string, power: number) => ({ name, type: "sync" as const, power });

/** The racing workloads: a name, its shared variable and each thread's change. */
function setup(seed: number): Setup {
  const r = rng(seed);
  const kind = r.pick(["prodcons", "counter", "bank", "twice"] as const);
  const make = (v: string, init: number, parts: [string, number[]][]): Setup => ({
    v,
    init,
    threads: parts.map(([name, ks], t) => ({ name, code: ks.flatMap((k) => increment(v, `r${t + 1}`, k)) })),
    says: parts.map(([name, ks]) => (ks.length === 2 && ks[0] === ks[1] ? `${name} runs ${opText(v, ks[0])} twice` : `${name} runs ${ks.map((k) => opText(v, k)).join("; ")}`)),
  });
  switch (kind) {
    case "prodcons":
      return make("counter", r.int(3, 9), [
        ["PRODUCER", [1]],
        ["CONSUMER", [-1]],
      ]);
    case "counter":
      return make("hits", r.int(0, 10), [
        ["T1", [r.int(1, 3)]],
        ["T2", [r.int(1, 3)]],
      ]);
    case "bank":
      return make("balance", r.pick([100, 200, 300]), [
        ["DEPOSIT", [r.int(1, 5) * 10]],
        ["WITHDRAW", [-r.int(1, 5) * 10]],
      ]);
    default:
      return make("x", r.int(0, 5), [
        ["T1", [1, 1]],
        ["T2", [1]],
      ]);
  }
}

/**
 * Be the scheduler: two threads race on a shared variable; tap out an
 * interleaving that leaves it at a given value. The goal is always a value
 * no serial order gives, so reaching it means causing a lost update.
 */
export const raceInterleave: Generator = {
  id: "gen-sync-interleave",
  topic: "race conditions: interleavings and lost updates",
  make(seed): InterleaveQ {
    const r = rng(seed ^ 0x5eed);
    const { v, init, threads, says } = setup(seed);
    const start = { [v]: init };
    const serial = runSchedule(start, threads, threads.flatMap((t, i) => t.code.map(() => i))).shared[v];
    const value = r.pick(finalValues(start, threads, v).filter((x) => x !== serial));
    const all = interleavings(threads.map((t) => t.code.length));
    const answer = r.pick(all.filter((s) => runSchedule(start, threads, s).shared[v] === value));
    const lost = lostUpdates(start, threads, answer).map((t) => threads[t].name);
    return {
      kind: "interleave",
      id: `${this.id}#${seed}`,
      prompt: `${v} is ${init}. ${says.join(", and ")}. You are the scheduler: pick an order of their steps that leaves ${v} at ${value}.`,
      threads,
      init: start,
      goal: { v, value },
      answer,
      explain: `Running one thread after the other always leaves ${v} at ${serial}. ${value} needs a lost update: ${lost.join(" and ")}'s change is overwritten by a store from a thread that loaded ${v} before it.`,
      move: { name: "Lost Update", type: "sync", power: 34 },
    };
  },
};

/** `[a, b, c]` as "a, b and c". */
const list = (xs: readonly (string | number)[]) => (xs.length < 2 ? String(xs[0]) : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * Which end values can a race leave? The options are every value the
 * simulator reaches over all interleavings, plus nearby values none reaches.
 */
export const raceFinals: Generator = {
  id: "gen-sync-finals",
  topic: "race conditions: possible final values",
  make(seed): MultiQ {
    const r = rng(seed ^ 0xf1a1);
    const { v, init, threads, says } = setup(seed);
    const start = { [v]: init };
    const possible = finalValues(start, threads, v);
    const serial = runSchedule(start, threads, threads.flatMap((t, i) => t.code.map(() => i))).shared[v];
    const unit = v === "balance" ? 10 : 1;
    const lo = possible[0] - 2 * unit;
    const hi = possible.at(-1)! + 2 * unit;
    const impossible: number[] = [];
    for (let x = lo; x <= hi; x += unit) if (!possible.includes(x)) impossible.push(x);
    const options = [...possible, ...r.shuffle(impossible).slice(0, 6 - possible.length)].sort((a, b) => a - b);
    const lost = possible.filter((x) => x !== serial);
    return {
      kind: "multi",
      id: `${this.id}#${seed}`,
      prompt: `${v} is ${init}. ${says.join(", and ")}. Each change is a load, an add and a store, and the steps can interleave in any order. Which final values of ${v} are possible? Select all that apply.`,
      options: options.map(String),
      answers: possible.map((x) => options.indexOf(x)),
      explain: `Running the threads one after the other gives ${serial}. ${list(lost)} ${lost.length > 1 ? "need" : "needs"} a lost update: a thread stores a value it computed from ${v} before another thread's store, wiping that change out. Over every interleaving ${v} can only end at ${list(possible)}.`,
      move: sync("Race Tally", 34),
    };
  },
};

/**
 * A blocking semaphore's trace: processes call wait() and signal() in turn
 * (a blocked process makes no calls); ask for the value or the number asleep.
 */
export const semaphoreTrace: Generator = {
  id: "gen-sync-semaphore",
  topic: "semaphores: value and blocked processes",
  make(seed): NumericQ {
    const r = rng(seed);
    const names = ["P1", "P2", "P3", "P4", "P5"];
    let init: number;
    let ops: SemOp[];
    let res: ReturnType<typeof runSemaphore>;
    do {
      init = r.int(0, 3);
      ops = [];
      const n = r.int(5, 7);
      while (ops.length < n) {
        const awake = names.filter((p) => !runSemaphore(init, ops).blocked.includes(p));
        // keep someone awake to signal
        ops.push({ op: awake.length > 1 && r.next() < 0.65 ? "wait" : "signal", who: r.pick(awake) });
      }
      res = runSemaphore(init, ops);
      // only traces where someone blocks and the trace isn't all waits
    } while (!ops.some((o, i) => o.op === "wait" && runSemaphore(init, ops.slice(0, i + 1)).value < 0) || ops.every((o) => o.op === "wait"));
    const askBlocked = r.next() < 0.5;
    const answer = askBlocked ? res.blocked.length : res.value;
    const asleep = res.blocked.length ? `${list(res.blocked)} ${res.blocked.length > 1 ? "are" : "is"} still asleep on S's queue` : "nobody is left asleep";
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: askBlocked
        ? `A semaphore S starts at ${init}, and these calls happen in order. A wait() that can't take a unit puts its caller to sleep. How many processes are blocked on S at the end?`
        : `A semaphore S starts at ${init}, and these calls happen in order. wait() decrements S and blocks the caller if S goes negative; signal() increments S and wakes the longest waiter. What is S's value at the end?`,
      code: ops.map((o) => `${o.who}: ${o.op}(S)`).join("\n"),
      answer,
      explain: `Each wait() takes 1 from S and each signal() adds 1: ${init} − ${ops.filter((o) => o.op === "wait").length} + ${ops.filter((o) => o.op === "signal").length} = ${res.value}. A negative value counts the sleepers, so ${asleep}${res.woken.length ? `; signal() woke ${list(res.woken)}` : ""}.`,
      move: sync("Count Down", 32),
    };
  },
};

const PETERSON_LINES = [(i: number) => `flag[${i}] = true`, (i: number) => `turn = ${1 - i}`];

/**
 * Peterson's solution: run the entry code's first two lines in some order,
 * then ask what happens at the while loop. Solved by stepping the protocol.
 */
export const petersonNext: Generator = {
  id: "gen-sync-peterson",
  topic: "Peterson's solution: who enters",
  make(seed): McqQ {
    const r = rng(seed);
    const solo = r.next() < 0.3;
    const who = r.int(0, 1);
    const schedule = (solo ? [who, who] : r.pick(interleavings([2, 2]))) as (0 | 1)[];
    const s = trace(PETERSON, schedule, { ...START, turn: r.pick([0, 1] as const) }).at(-1)!;
    const pcs = [0, 0];
    const lines = schedule.map((i) => `P${i} runs ${PETERSON_LINES[pcs[i]++](i)}`);
    const steps = `${lines.slice(0, -1).join(", ")}, then ${lines.at(-1)}`;
    if (solo) {
      const i = schedule[0];
      const enters = PETERSON.step(s, i).pc[i] === PETERSON.cs;
      const options = [`P${i} enters its critical section`, `P${i} waits until turn = ${i}`, `P${i} waits until P${1 - i} has had a turn`, `P${i} waits forever`];
      const order = r.shuffle([0, 1, 2, 3]);
      return {
        id: `${this.id}#${seed}`,
        prompt: `Peterson's solution: Pi waits while (flag[j] && turn == j). P${1 - i} isn't trying to enter, so flag[${1 - i}] is false. ${steps}. Now P${i} reaches its waiting loop. What happens?`,
        options: order.map((k) => options[k]),
        answer: order.indexOf(enters ? 0 : 1),
        explain: `P${i} only waits while flag[${1 - i}] is true and turn is ${1 - i}. turn is ${s.turn}, but flag[${1 - i}] is false, so the loop ends at once and P${i} enters: with nobody else wanting in, giving away the turn costs nothing (that's the progress requirement).`,
        move: sync("Turn Taker", 34),
      };
    }
    const next = ([0, 1] as const).map((i) => PETERSON.step(s, i).pc[i] === PETERSON.cs);
    const winner = next.indexOf(true);
    const options = ["P0 enters; P1 waits", "P1 enters; P0 waits", "Both enter their critical sections", "Both wait forever"];
    // the last step is always the second line (turn = j) of whoever finished last
    const last = schedule.at(-1)!;
    return {
      id: `${this.id}#${seed}`,
      prompt: `Peterson's solution: Pi waits while (flag[j] && turn == j). Both want to enter: ${steps}. Both now reach their waiting loops. What happens?`,
      options,
      answer: winner,
      explain: `Both flags are up, so turn decides. P${last} wrote turn last, setting it to ${s.turn}, so P${last} waits and P${winner} enters. Whoever gives the turn away last is the one who yields; mutual exclusion holds, and nobody waits forever.`,
      move: sync("Turn Taker", 34),
    };
  },
};

export const SYNC_GENERATORS: Generator[] = [raceInterleave, raceFinals, semaphoreTrace, petersonNext];
