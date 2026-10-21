import type { Generator, InterleaveQ } from "@/game/engine/question";
import { finalValues, increment, interleavings, lostUpdates, runSchedule, type SyncThread } from "@/game/sim/sync";
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

export const SYNC_GENERATORS: Generator[] = [raceInterleave];
