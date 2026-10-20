import { fmt, type Generator, type NumericQ } from "@/game/engine/question";
import { fcfs, ganttText, type Job } from "@/game/sim/scheduling";
import { rng } from "@/lib/rng";
import { BASICS_GENERATORS } from "./basicsGenerators";
import { PROCESS_GENERATORS } from "./processGenerators";

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
      gantt: s.gantt,
      move: { name: "Queue Crush", type: "scheduler", power: 36 },
    };
  },
};

/** Every generator in the game (the Leitner bank finds generated cards here). */
export const GENERATORS: Generator[] = [fcfsAverage, ...PROCESS_GENERATORS, ...BASICS_GENERATORS];

export { forkPrints } from "./processGenerators";
