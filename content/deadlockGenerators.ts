import type { BankerQ, CycleQ, CycleNode, Generator, McqQ, NumericQ } from "@/game/engine/question";
import { canDeadlock, detect, findCycle, need, request, safety, type BankerState, type Edge, type Vec } from "@/game/sim/deadlock";
import { rng, type Rng } from "@/lib/rng";

const sync = (name: string, power: number) => ({ name, type: "sync" as const, power });
const RES = ["A", "B", "C"];
const vec = (v: Vec) => `(${v.join(", ")})`;
const pad = (s: string, n: number) => s.padEnd(n);
const fmtSeq = (seq: readonly number[]) => seq.map((i) => `P${i}`).join(", ");

/** A random Banker's state with 3 resource types and `n` processes; `safe` picks safe or unsafe. */
export function bankerState(r: Rng, n: number, safe: boolean): BankerState {
  for (let tries = 0; tries < 500; tries++) {
    const total = RES.map(() => r.int(5, 10));
    const allocation = Array.from({ length: n }, () => RES.map(() => r.int(0, 3)));
    const held = RES.map((_, j) => allocation.reduce((a, row) => a + row[j], 0));
    if (held.some((h, j) => h > total[j] - 1)) continue;
    const available = held.map((h, j) => total[j] - h);
    const max = allocation.map((a) => a.map((x, j) => Math.min(total[j], x + r.int(0, 5))));
    const s: BankerState = { available, allocation, max };
    if (safety(s).safe === safe && need(s).some((row) => row.some((x) => x > 0))) return s;
  }
  // a safe fallback, the textbook-sized state
  return { available: [3, 3, 2], allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1]], max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2]] };
}

/** The Allocation and Max tables as a monospaced block. */
export function bankerTable(s: BankerState): string {
  const head = `${pad("", 4)}${pad("Allocation", 12)}${pad("Max", 9)}`;
  const sub = `${pad("", 4)}${pad(RES.join(" "), 12)}${pad(RES.join(" "), 9)}`;
  const rows = s.allocation.map((a, i) => `${pad(`P${i}`, 4)}${pad(a.join(" "), 12)}${pad(s.max[i].join(" "), 9)}`);
  return [head, sub, ...rows, "", `Available: ${s.available.join(" ")}`].join("\n");
}

/** Tap a safe sequence for a random state (always safe by construction). */
export const bankerSafeSequence: Generator = {
  id: "gen-deadlock-safe",
  topic: "Banker's algorithm: a safe sequence",
  make(seed): BankerQ {
    const r = rng(seed);
    const state = bankerState(r, r.int(4, 5), true);
    const res = safety(state);
    return {
      kind: "banker",
      id: `${this.id}#${seed}`,
      prompt: `Resource types A, B and C. Using Available, Allocation and Max, tap the processes in an order that is a safe sequence. Work out Need = Max − Allocation first.`,
      resources: RES,
      state,
      answer: res.sequence,
      explain: `Need = Max − Allocation. Start with Work = Available ${vec(state.available)}. The safety algorithm finishes ${fmtSeq(res.sequence)} in that order: each one's Need fits in Work, and then returns its Allocation (Work grows to ${vec(res.work.at(-1)!)}). Other safe orders may exist.`,
      move: sync("Safe Passage", 34),
    };
  },
};

/** What is one entry of the Need matrix? */
export const bankerNeed: Generator = {
  id: "gen-deadlock-need",
  topic: "Banker's algorithm: the Need matrix",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x4ee0);
    const state = bankerState(r, r.int(4, 5), r.next() < 0.7);
    const p = r.int(0, state.allocation.length - 1);
    const j = r.int(0, 2);
    const answer = need(state)[p][j];
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `In the Banker's algorithm, what is Need[P${p}][${RES[j]}]?`,
      code: bankerTable(state),
      answer,
      explain: `Need = Max − Allocation, so Need[P${p}][${RES[j]}] = ${state.max[p][j]} − ${state.allocation[p][j]} = ${answer}. Need is what the process may still ask for before it finishes.`,
      move: sync("Vault Guard", 32),
    };
  },
};

const REASONS = ["granted", "exceeds-need", "not-available", "unsafe"] as const;

/** A process asks for resources in a safe state: grant it, or why not? */
export const bankerRequest: Generator = {
  id: "gen-deadlock-request",
  topic: "Banker's algorithm: grant the request?",
  make(seed): McqQ {
    const r = rng(seed ^ 0x2e07);
    const state = bankerState(r, r.int(4, 5), true);
    const want = r.pick(REASONS);
    let p = 0;
    let req: number[] = [0, 0, 0];
    let result = request(state, p, req);
    const matches = (x: ReturnType<typeof request>) => (want === "granted" ? x.granted : !x.granted && x.reason === want);
    for (let tries = 0; tries < 600; tries++) {
      p = r.int(0, state.allocation.length - 1);
      req = RES.map(() => r.int(0, 3));
      if (req.every((x) => x === 0)) continue;
      result = request(state, p, req);
      if (matches(result)) break;
    }
    const nd = need(state)[p];
    const options = ["Granted: the new state is safe", "Denied: the request exceeds the process's Need", "Denied: not enough resources are Available", "Denied: granting it would leave an unsafe state"];
    const answer = result.granted ? 0 : result.reason === "exceeds-need" ? 1 : result.reason === "not-available" ? 2 : 3;
    const why = result.granted
      ? `Request ≤ Need ${vec(nd)} and ≤ Available ${vec(state.available)}, and pretending to grant it leaves a safe state (safe sequence ${fmtSeq(result.sequence)}), so it is granted.`
      : result.reason === "exceeds-need"
        ? `The request ${vec(req)} is larger than P${p}'s Need ${vec(nd)} in some type: the process promised (via Max) never to ask for more, so this is an error.`
        : result.reason === "not-available"
          ? `The request ${vec(req)} fits P${p}'s Need ${vec(nd)} but not Available ${vec(state.available)}, so P${p} must wait.`
          : `Request ≤ Need and ≤ Available, but after pretending to grant it no safe sequence exists, so the request is denied and P${p} waits.`;
    return {
      id: `${this.id}#${seed}`,
      prompt: `The state is safe. P${p} requests ${vec(req)} (A, B, C). Does the Banker's algorithm grant it?`,
      code: bankerTable(state),
      options,
      answer,
      explain: why,
      move: sync("Rank Order", 34),
    };
  },
};

/** How many processes does the detection algorithm find deadlocked? */
export const detectCount: Generator = {
  id: "gen-deadlock-detect",
  topic: "Deadlock detection: how many are stuck",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xdead);
    const wantStuck = r.next() < 0.75;
    let n = 5;
    let available: number[] = [0, 0, 0];
    let allocation: number[][] = [];
    let requests: number[][] = [];
    let stuck: number[] = [];
    for (let tries = 0; tries < 800; tries++) {
      n = r.int(4, 5);
      available = RES.map(() => r.int(0, 2));
      allocation = Array.from({ length: n }, () => RES.map(() => r.int(0, 3)));
      requests = Array.from({ length: n }, () => RES.map(() => (r.next() < 0.45 ? r.int(0, 3) : 0)));
      if (allocation.some((a) => a.every((x) => x === 0))) continue;
      stuck = detect(available, allocation, requests);
      if ((stuck.length > 0) === wantStuck) break;
    }
    const table = [`${pad("", 4)}${pad("Allocation", 12)}${pad("Request", 9)}`, `${pad("", 4)}${pad(RES.join(" "), 12)}${pad(RES.join(" "), 9)}`, ...allocation.map((a, i) => `${pad(`P${i}`, 4)}${pad(a.join(" "), 12)}${pad(requests[i].join(" "), 9)}`), "", `Available: ${available.join(" ")}`].join("\n");
    const free = allocation.flatMap((_, i) => (stuck.includes(i) ? [] : [i]));
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: "Run the deadlock-detection algorithm (a process can finish if its current Request fits in Work, and then returns its Allocation). How many processes are deadlocked?",
      code: table,
      answer: stuck.length,
      explain: stuck.length
        ? `Starting from Work = Available ${vec(available)}, ${free.length ? `${fmtSeq(free)} can finish one after another, handing their Allocation back, but` : "no process can finish:"} ${fmtSeq(stuck)} each request${stuck.length > 1 ? "" : "s"} more than Work can ever offer. They wait for each other forever: ${stuck.length} deadlocked.`
        : `Starting from Work = Available ${vec(available)}, every process can finish in some order (${fmtSeq(free)}), each returning its Allocation for the next. Nobody is deadlocked: 0.`,
      move: sync("Cycle Snap", 32),
    };
  },
};

const GRID: CycleNode[] = [
  { id: "P1", x: 14, y: 14 },
  { id: "P2", x: 50, y: 14 },
  { id: "P3", x: 86, y: 14 },
  { id: "R1", x: 14, y: 46 },
  { id: "R2", x: 50, y: 46 },
  { id: "R3", x: 86, y: 46 },
];

/** Spot the cycle in a random single-instance resource-allocation graph (or that there isn't one). */
export const ragCycle: Generator = {
  id: "gen-deadlock-rag",
  topic: "Resource-allocation graphs: spot the cycle",
  make(seed): CycleQ {
    const r = rng(seed ^ 0x7a6);
    const wantCycle = r.next() < 0.6;
    let edges: Edge[] = [];
    let cycle: string[] | null = null;
    for (let tries = 0; tries < 800; tries++) {
      edges = [];
      const holders = r.shuffle(["P1", "P2", "P3"]);
      // each resource is held by at most one process; each process waits for at most one resource
      RES.forEach((_, j) => r.next() < 0.85 && edges.push([`R${j + 1}`, r.pick(holders)]));
      for (const p of ["P1", "P2", "P3"]) {
        const mine = edges.filter(([, to]) => to === p).map(([from]) => from);
        const wants = RES.map((_, j) => `R${j + 1}`).filter((x) => !mine.includes(x));
        if (wants.length && r.next() < 0.8) edges.push([p, r.pick(wants)]);
      }
      cycle = findCycle(edges);
      if ((cycle !== null) === wantCycle && edges.length >= 5) break;
    }
    const answer = cycle ? cycle.slice(0, -1) : [];
    return {
      kind: "cycle",
      id: `${this.id}#${seed}`,
      prompt: "Every resource has one instance. Red arrows are requests (P → R), green arrows are assignments (R → P). Tap the nodes of the cycle, or NO DEADLOCK if there is none.",
      nodes: GRID,
      edges,
      answer,
      explain: cycle
        ? `Follow the arrows: ${cycle.join(" → ")}. Each process in the loop waits for a resource held by the next, and with one instance per resource a cycle means deadlock.`
        : "Follow the arrows from every process: each path ends at a resource nobody is waiting on, or at a process that isn't waiting for anything, and never returns to where it started. No cycle, so no deadlock.",
      move: sync("Cycle Snap", 32),
    };
  },
};

const LOCKS = ["A", "B", "C"];

/** Two or three threads each lock two mutexes: can they deadlock? */
export const lockOrder: Generator = {
  id: "gen-deadlock-lockorder",
  topic: "Lock ordering: can these threads deadlock?",
  make(seed): McqQ {
    const r = rng(seed ^ 0x10c4);
    const wantDeadlock = r.next() < 0.5;
    let orders: string[][] = [];
    for (let tries = 0; tries < 400; tries++) {
      const n = r.int(2, 3);
      orders = Array.from({ length: n }, () => r.shuffle(LOCKS).slice(0, 2));
      if (canDeadlock(orders) === wantDeadlock) break;
    }
    const dead = canDeadlock(orders);
    // an edge a → b: some thread holds a while asking for b
    const edges: Edge[] = orders.map(([a, b]) => [a, b]);
    const cycle = findCycle(edges);
    const options = ["Yes: a circular wait can form", "No: every thread takes the locks in an order that can't form a cycle", "No: a mutex can't be held by two threads at once, so deadlock is impossible", "Yes, but only if there are more threads than locks"];
    return {
      id: `${this.id}#${seed}`,
      prompt: "Each thread locks its two mutexes in the order shown, does its work, then unlocks both. Can these threads deadlock?",
      options,
      answer: dead ? 0 : 1,
      explain: dead
        ? `Draw an arrow a → b when a thread holds a while it waits for b: ${edges.map(([a, b]) => `${a} → ${b}`).join(", ")}. The loop ${cycle!.join(" → ")} is a circular wait: if each thread grabs its first lock before anyone takes a second, all of them wait forever.`
        : `Draw an arrow a → b when a thread holds a while it waits for b: ${edges.map(([a, b]) => `${a} → ${b}`).join(", ")}. There is no loop, so the locks follow one global order and circular wait can't happen. The thread holding the last lock in the chain always finishes and unlocks.`,
      code: orders.map((o, t) => `T${t + 1}: lock(${o[0]}); lock(${o[1]}); … unlock both`).join("\n"),
      move: sync("Rank Order", 34),
    };
  },
};

export const DEADLOCK_GENERATORS: Generator[] = [bankerSafeSequence, bankerNeed, bankerRequest, detectCount, ragCycle, lockOrder];
