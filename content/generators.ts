import { fmt, type Generator, type NumericQ } from "@/game/engine/question";
import { runForks, forkSource, type Stmt } from "@/game/sim/fork";
import { fcfs, ganttText, type Job } from "@/game/sim/scheduling";
import { rng } from "@/lib/rng";
import { BASICS_GENERATORS } from "./basicsGenerators";

/** FCFS average waiting or turnaround time for 3–4 generated processes. */
export const fcfsAverage: Generator = {
  id: "gen-fcfs-avg",
  topic: "FCFS waiting and turnaround time",
  make(seed): NumericQ {
    const r = rng(seed);
    const n = r.int(3, 4);
    const staggered = r.next() < 0.5;
    let at = 0;
    const jobs: Job[] = [...Array(n).keys()].map((i) => {
      if (staggered && i > 0) at += r.int(0, 4);
      return { name: `P${i + 1}`, arrival: at, burst: r.int(1, 12) };
    });
    const metric = r.pick(["waiting", "turnaround"] as const);
    const s = fcfs(jobs);
    const per = metric === "waiting" ? s.waiting : s.turnaround;
    const sum = per.reduce((a, b) => a + b, 0);
    const answer = sum / n;
    const table = ["Proc  Arrival  Burst", ...jobs.map((j) => `${j.name.padEnd(6)}${String(j.arrival).padEnd(9)}${j.burst}`)].join("\n");
    const rule = metric === "waiting" ? "Waiting = turnaround − burst" : "Turnaround = completion − arrival";
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `FCFS scheduling. What is the average ${metric} time (ms)?`,
      code: table,
      answer,
      unit: "ms",
      explain: `FCFS runs them in arrival order: ${ganttText(s.gantt)}. ${rule}: ${jobs.map((j, i) => `${j.name} ${per[i]}`).join(", ")}. Average = ${sum}/${n} = ${fmt(answer)} ms.`,
      move: { name: "Queue Crush", type: "scheduler", power: 36 },
    };
  },
};

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
      move: { name: "Fork Bomb", type: "process", power: 34 },
    };
  },
};

/** Every generator in the game (the Leitner bank finds generated cards here). */
export const GENERATORS: Generator[] = [fcfsAverage, forkPrints, ...BASICS_GENERATORS];
