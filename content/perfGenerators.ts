import type { Generator, McqQ, NumericQ } from "@/game/engine/question";
import { amdahlLimit, amdahlSpeedup, bandwidthDelayBytes, cpuBoundPool, lockSaturation, lockedThroughput, poolSize, rmBound, rmSchedulableExact, rmTest, switchOverhead, twoLevelEat, utilization, type PeriodicTask } from "@/game/sim/perf";
import { rng } from "@/lib/rng";

const mv = (name: string, type: "scheduler" | "process" | "memory" | "io", power: number) => ({ name, type, power });
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Percent of CPU time wasted on context switches for a given quantum. */
export const switchOverheadGen: Generator = {
  id: "gen-perf-switch",
  topic: "Round robin: context-switch overhead",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x5c0f);
    const quantum = r.pick([2, 4, 5, 8, 10, 20, 50]);
    const cost = r.pick([0.5, 1, 2, 4]);
    const pct = round2(switchOverhead(quantum, cost) * 100);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `Round robin uses a ${quantum} ms quantum, and every context switch costs ${cost} ms. Every process always uses its whole quantum. What percentage of CPU time is lost to switching (2 d.p.)?`,
      answer: pct,
      unit: "%",
      explain: `Each cycle is ${quantum} ms of work plus ${cost} ms of switching, so the overhead is ${cost} / (${quantum} + ${cost}) = ${pct}%. A smaller quantum is more responsive but spends more of the CPU on switches.`,
      move: mv("Quantum Cut", "scheduler", 30),
    };
  },
};

/** Amdahl's law speedup from a serial fraction and a core count. */
export const amdahlGen: Generator = {
  id: "gen-perf-amdahl",
  topic: "Amdahl's law: speedup on N cores",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xa3da);
    const serialPct = r.pick([5, 10, 20, 25, 40, 50]);
    const cores = r.pick([2, 4, 8, 16]);
    const speedup = round2(amdahlSpeedup(serialPct / 100, cores));
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `${serialPct}% of a program is inherently serial and the rest parallelises perfectly. What speedup does it get on ${cores} cores (2 d.p.)?`,
      answer: speedup,
      unit: "x",
      explain: `Amdahl: 1 / (S + (1 - S) / N) = 1 / (${serialPct / 100} + ${round2(1 - serialPct / 100)} / ${cores}) = ${speedup}x. No number of cores can beat 1 / S = ${round2(amdahlLimit(serialPct / 100))}x.`,
      move: mv("Serial Wall", "process", 34),
    };
  },
};

/** Which core count the program needs to reach half its ceiling, or the ceiling itself. */
export const amdahlCeiling: Generator = {
  id: "gen-perf-amdahl-limit",
  topic: "Amdahl's law: the speedup ceiling",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xce11);
    const serialPct = r.pick([1, 2, 4, 5, 8, 10, 20, 25]);
    const limit = round2(amdahlLimit(serialPct / 100));
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A job spends ${serialPct}% of its single-core run time in code that cannot be parallelised. What is the best speedup any number of cores could give it?`,
      answer: limit,
      unit: "x",
      explain: `As N grows, (1 - S) / N goes to 0, so the speedup tends to 1 / S = 1 / ${serialPct / 100} = ${limit}x. Reducing the serial fraction matters more than adding cores.`,
      move: mv("Serial Wall", "process", 36),
    };
  },
};

const taskSet = (r: ReturnType<typeof rng>): PeriodicTask[] => {
  const n = r.pick([2, 3]);
  const periods = r.shuffle([20, 25, 30, 40, 50, 60, 80, 100]).slice(0, n).sort((a, b) => a - b);
  return periods.map((t) => ({ t, c: Math.max(1, Math.round((t * r.int(12, 70)) / 100 / n * 2)) }));
};

/** Does Liu & Layland's utilization test guarantee a rate-monotonic schedule? */
export const rmUtilization: Generator = {
  id: "gen-perf-rm",
  topic: "Rate-monotonic scheduling: the utilization test",
  make(seed): McqQ {
    const r = rng(seed ^ 0x2a7e);
    let tasks: PeriodicTask[] = [];
    const want = r.pick(["guaranteed", "inconclusive", "overloaded"] as const);
    for (let tries = 0; tries < 500; tries++) {
      tasks = taskSet(r);
      if (rmTest(tasks) === want) break;
    }
    const verdict = rmTest(tasks);
    const u = utilization(tasks);
    const bound = rmBound(tasks.length);
    const options = [
      "Guaranteed schedulable: U is at or below the bound",
      "Not guaranteed by the bound, so check exactly: U is above it but not above 1",
      "Impossible for any scheduler: U is above 1",
      "Nothing: the utilization bound only applies to EDF, not to rate-monotonic",
    ];
    const answer = verdict === "guaranteed" ? 0 : verdict === "inconclusive" ? 1 : 2;
    const exact = verdict === "inconclusive" ? ` Response-time analysis shows it ${rmSchedulableExact(tasks) ? "does meet every deadline" : "misses a deadline"} under RM.` : "";
    return {
      id: `${this.id}#${seed}`,
      prompt: `Periodic tasks (execution time C, period = deadline T): ${tasks.map((k, i) => `P${i + 1} (C=${k.c}, T=${k.t})`).join(", ")}. Using the rate-monotonic utilization bound n(2^(1/n) - 1), what can you conclude?`,
      options,
      answer,
      explain: `U = ${tasks.map((k) => `${k.c}/${k.t}`).join(" + ")} = ${u.toFixed(4)}. For n = ${tasks.length} the bound is ${bound.toFixed(4)}. ${verdict === "guaranteed" ? "U is under the bound, so RM meets every deadline." : verdict === "inconclusive" ? `U is above the bound but not above 1: the test is sufficient, not necessary, so it cannot decide.${exact}` : "U above 1 needs more than 100% of a CPU, so no scheduler can succeed."}`,
      move: mv("Deadline Lance", "scheduler", 38),
    };
  },
};

/** Effective access time of a two-level cache. */
export const cacheEat: Generator = {
  id: "gen-perf-eat2",
  topic: "Two-level cache: effective access time",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xea72);
    const h1 = r.pick([80, 90, 95, 98]);
    const h2 = r.pick([50, 60, 75, 90]);
    const t1 = r.pick([1, 2]);
    const t2 = r.pick([5, 10, 12]);
    const tMem = r.pick([80, 100, 120]);
    const eat = round2(twoLevelEat(h1 / 100, t1, h2 / 100, t2, tMem));
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `L1 hits ${h1}% of accesses and costs ${t1} ns. On an L1 miss, L2 hits ${h2}% of the time and costs ${t2} ns more. A miss in both goes to memory for another ${tMem} ns. What is the average access time (2 d.p.)?`,
      answer: eat,
      unit: "ns",
      explain: `Everyone pays L1 (${t1}). The ${100 - h1}% that miss also pay L2 (${t2}), and the ${100 - h2}% of those pay memory (${tMem}): ${t1} + ${(100 - h1) / 100} × (${t2} + ${(100 - h2) / 100} × ${tMem}) = ${eat} ns.`,
      move: mv("Cache Cascade", "memory", 36),
    };
  },
};

/** How many threads should a pool have? */
export const poolSizing: Generator = {
  id: "gen-perf-pool",
  topic: "Thread-pool sizing",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x9001);
    const cores = r.pick([2, 4, 8, 16]);
    if (r.next() < 0.35) {
      return {
        kind: "numeric",
        id: `${this.id}#${seed}`,
        prompt: `A pool runs purely CPU-bound tasks on a ${cores}-core machine. By the usual rule of thumb, how many threads should it have?`,
        answer: cpuBoundPool(cores),
        explain: `CPU-bound work gains nothing from more threads than cores, so use N + 1 = ${cpuBoundPool(cores)}: one per core plus one to keep a core busy when a thread stalls on a page fault.`,
        move: mv("Pool Party", "process", 30),
      };
    }
    const compute = r.pick([5, 10, 20]);
    const wait = compute * r.pick([1, 3, 4, 9, 19]);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `Each request computes for ${compute} ms and then waits ${wait} ms on a database. On a ${cores}-core machine, how many pool threads keep the CPUs fully busy?`,
      answer: poolSize(cores, wait, compute),
      explain: `Threads = cores × (1 + wait / compute) = ${cores} × (1 + ${wait} / ${compute}) = ${poolSize(cores, wait, compute)}. While one thread waits, the others use the cores.`,
      move: mv("Pool Party", "process", 34),
    };
  },
};

/** Throughput when threads share one lock. */
export const lockThroughput: Generator = {
  id: "gen-perf-lock",
  topic: "Lock contention: throughput with N threads",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x10c4);
    const inside = r.pick([1, 2, 4]);
    const outside = inside * r.pick([4, 9, 19]);
    const sat = lockSaturation(outside, inside);
    const threads = r.pick([Math.max(1, Math.floor(sat / 2)), sat, sat * 2, sat * 4]);
    const ops = lockedThroughput(threads, outside, inside);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `${threads} thread${threads > 1 ? "s" : ""} each loop forever: ${outside} ms of independent work, then ${inside} ms inside one shared mutex. There are enough cores. How many operations per second complete in total?`,
      answer: ops,
      explain: `Without the lock each thread does 1000 / ${outside + inside} ops/s, so ${threads} threads could do ${round2((threads * 1000) / (outside + inside))}. But the critical sections cannot overlap: at most 1000 / ${inside} = ${1000 / inside} ops/s. The lock saturates at ${sat} threads, so the answer is the smaller: ${ops}.`,
      tolerance: 0.01,
      move: mv("Lock Jam", "process", 38),
    };
  },
};

/** Socket buffer needed to fill a long fat pipe. */
export const bufferSizing: Generator = {
  id: "gen-perf-bdp",
  topic: "Buffer sizing: the bandwidth-delay product",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xbd90);
    const mbit = r.pick([10, 100, 200, 500, 1000]);
    const rtt = r.pick([5, 10, 20, 40, 80, 100]);
    const bytes = bandwidthDelayBytes(mbit * 1e6, rtt / 1000);
    const kb = bytes / 1000;
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A TCP connection runs over a ${mbit} Mbit/s path with a ${rtt} ms round-trip time. How large (in KB, 1 KB = 1000 bytes) must the socket send buffer be to keep the link full?`,
      answer: kb,
      unit: "KB",
      tolerance: 0.5,
      explain: `The buffer must hold one bandwidth-delay product of unacknowledged data: ${mbit} Mbit/s × ${rtt / 1000} s = ${mbit * rtt * 1000} bits = ${kb} KB. A smaller buffer stalls the sender waiting for ACKs, which is why long fat pipes need tuned buffers.`,
      move: mv("Buffer Bloom", "io", 32),
    };
  },
};

export const PERF_GENERATORS: Generator[] = [switchOverheadGen, amdahlGen, amdahlCeiling, rmUtilization, cacheEat, poolSizing, lockThroughput, bufferSizing];
