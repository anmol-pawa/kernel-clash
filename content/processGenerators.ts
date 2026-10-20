import type { Generator, McqQ, MultiQ, NumericQ } from "@/game/engine/question";
import { forkSource, forkTreeSource, runForks, runForkTree, type Node, type Stmt } from "@/game/sim/fork";
import { EVENT_TEXT, INVALID_TRANSITIONS, IPC_CASES, PSTATES, TRANSITIONS, WAITS, eventsFrom, trace, type PEvent, type PState } from "@/game/sim/processes";
import { rng, type Rng } from "@/lib/rng";

const proc = (name: string, power: number) => ({ name, type: "process" as const, power });

/** How many lines a straight run of fork()s and printf()s prints. */
export const forkPrints: Generator = {
  id: "gen-fork-prints",
  topic: "fork() trees",
  make(seed): NumericQ {
    const r = rng(seed);
    const forks = r.int(2, 4);
    // forks in order, with a printf after a random subset of them (always one at the end)
    const program: Stmt[] = [];
    for (let i = 0; i < forks; i++) {
      program.push("fork");
      if (i === forks - 1 || r.next() < 0.4) program.push("print");
    }
    if (r.next() < 0.3) program.unshift("print");
    const run = runForks(program);
    // after k forks there are 2^k processes, and each one runs the printf
    let alive = 1;
    const terms: number[] = [];
    for (const s of program) {
      if (s === "fork") alive *= 2;
      else terms.push(alive);
    }
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: "How many times is \"hi\" printed in total (by every process)?",
      code: forkSource(program),
      answer: run.prints,
      explain: `Each fork() doubles the processes that reach it, and every process that reaches a printf runs it: ${terms.join(" + ")} = ${run.prints}. ${run.processes} processes exist at the end.`,
      move: proc("Fork Bomb", 34),
    };
  },
};

/** One top-level statement of a branching fork() program. */
function forkStatement(r: Rng): Node {
  switch (r.int(0, 4)) {
    case 0:
      return { op: "fork" };
    case 1:
      return { op: "ifChild", body: r.next() < 0.5 ? [{ op: "fork" }] : [{ op: "fork" }, { op: "fork" }] };
    case 2:
      return { op: "ifParent", body: [{ op: "fork" }] };
    case 3:
      return { op: "loop", n: r.int(2, 3), body: [{ op: "fork" }] };
    default:
      return { op: "ifChild", body: [{ op: "ifParent", body: [{ op: "fork" }] }] };
  }
}

/** Processes or printed lines for a fork() program with `if (fork() == 0)` branches and loops. */
export const forkTree: Generator = {
  id: "gen-fork-tree",
  topic: "fork() with branches and loops",
  make(seed): NumericQ {
    const r = rng(seed);
    let stmts: Node[];
    do {
      stmts = [...Array(r.int(1, 3))].map(() => forkStatement(r));
      // a plain run of forks is gen-fork-prints' job; keep the count small enough to trace by hand
    } while (stmts.every((s) => s.op === "fork") || runForkTree(stmts).processes > 24);
    const askPrints = r.next() < 0.4;
    // printf only at the top level: after a random statement (maybe) and always at the end
    const program: Node[] = [];
    stmts.forEach((s, i) => {
      program.push(s);
      if (askPrints && (i === stmts.length - 1 || r.next() < 0.35)) program.push({ op: "print" });
    });
    const run = runForkTree(program);
    // processes alive after each top-level statement (each one is finished by everyone who reaches it)
    const alive = program.map((_, i) => runForkTree(program.slice(0, i + 1).filter((s) => s.op !== "print")).processes);
    const counts = [1, ...alive.filter((_, i) => program[i].op !== "print")];
    const printTerms = program.flatMap((s, i) => (s.op === "print" ? [alive[i]] : []));
    const branches = forkTreeSource(program).includes("if (");
    const rule = branches
      ? "fork() returns 0 in the child and the child's PID (> 0) in the parent, so if (fork() == 0) runs its block only in the new child and if (fork() > 0) only in the parent."
      : "Each pass of a loop's fork() doubles the processes, and every child keeps looping from where its parent was.";
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: askPrints ? 'How many times is "hi" printed in total (by every process)?' : "Including the original process, how many processes exist when this program finishes?",
      code: forkTreeSource(program),
      answer: askPrints ? run.prints : run.processes,
      explain: `${rule} Processes after each statement: ${counts.join(" → ")}.${askPrints ? ` Every process alive at a printf runs it: ${printTerms.length > 1 ? `${printTerms.join(" + ")} = ` : ""}${run.prints}.` : ""}`,
      move: proc("Hydra Split", 36),
    };
  },
};

const STATE_OPTION: Record<PState, string> = { NEW: "New", READY: "Ready", RUNNING: "Running", WAITING: "Waiting", TERMINATED: "Terminated" };

/** Follow a process through 3–5 events and name its final state. */
export const stateTrace: Generator = {
  id: "gen-state-trace",
  topic: "Process state transitions",
  make(seed): McqQ {
    const r = rng(seed);
    const n = r.int(3, 5);
    const events: PEvent[] = [];
    let s: PState = "NEW";
    while (events.length < n) {
      // leave exit for the last event so the trace never stops early
      const allowed: PEvent[] = eventsFrom(s).filter((e) => e !== "exit" || events.length === n - 1);
      const e: PEvent = r.pick(allowed);
      events.push(e);
      s = TRANSITIONS[e].to;
    }
    const end = trace("NEW", events);
    const options = r.shuffle([end, ...r.shuffle(PSTATES.filter((p) => p !== end)).slice(0, 3)]);
    let wait = WAITS[0];
    const said = events.map((e) => {
      if (e === "block") wait = r.pick(WAITS);
      return e === "block" ? wait[0] : e === "wake" ? wait[1] : r.pick(EVENT_TEXT[e]);
    });
    const path = ["NEW", ...events.map((e) => TRANSITIONS[e].to)].join(" → ");
    return {
      id: `${this.id}#${seed}`,
      prompt: `A new process is created. Then ${said.slice(0, -1).join(", ")} and ${said.at(-1)}. What state is it in now?`,
      options: options.map((o) => STATE_OPTION[o]),
      answer: options.indexOf(end),
      explain: `${path}. Admission moves NEW to READY, a dispatch READY to RUNNING, a time-slice interrupt RUNNING back to READY, waiting for I/O or an event RUNNING to WAITING, its completion WAITING to READY (never straight to RUNNING), and exit RUNNING to TERMINATED.`,
      move: proc("State Shift", 32),
    };
  },
};

const arrow = ([a, b]: readonly [PState, PState]) => `${STATE_OPTION[a]} → ${STATE_OPTION[b]}`;

/** Pick the arrows that really are in the five-state diagram. */
export const stateArrows: Generator = {
  id: "gen-state-arrows",
  topic: "The five-state diagram",
  make(seed): MultiQ {
    const r = rng(seed);
    const valid = Object.values(TRANSITIONS).map((t) => [t.from, t.to] as const);
    const k = r.int(2, 4);
    const items = r.shuffle([...r.shuffle(valid).slice(0, k).map((t) => ({ t, ok: true })), ...r.shuffle(INVALID_TRANSITIONS).slice(0, 6 - k).map((t) => ({ t, ok: false }))]);
    return {
      kind: "multi",
      id: `${this.id}#${seed}`,
      prompt: "Which of these transitions are in the five-state process diagram? Select all that apply.",
      options: items.map((i) => arrow(i.t)),
      answers: items.flatMap((i, n) => (i.ok ? [n] : [])),
      explain: `The diagram has six arrows: ${valid.map(arrow).join(", ")}. A waiting process goes back to Ready (not straight to Running), only a running process can start waiting or exit, and a new process must be admitted to Ready first.`,
      move: proc("State Shift", 34),
    };
  },
};

/** Which IPC mechanism fits a scenario. */
export const ipcPick: Generator = {
  id: "gen-ipc-pick",
  topic: "Choosing an IPC mechanism",
  make(seed): McqQ {
    const r = rng(seed);
    const c = r.pick(IPC_CASES);
    const options = r.shuffle([c.answer, ...r.shuffle(c.wrong).slice(0, 3)]);
    return {
      id: `${this.id}#${seed}`,
      prompt: `${c.text} Which IPC mechanism fits best?`,
      options,
      answer: options.indexOf(c.answer),
      explain: c.why,
      move: proc("Pipe Lash", 32),
    };
  },
};

export const PROCESS_GENERATORS: Generator[] = [forkPrints, forkTree, stateTrace, stateArrows, ipcPick];
