import { fmt, MAX_GANTT_UNITS, type GanttQ, type Generator, type McqQ, type NumericQ } from "@/game/engine/question";
import { fcfs, ganttText, priority, roundRobin, sjf, srtf, type Job, type PriorityJob, type Schedule, type Slice } from "@/game/sim/scheduling";
import { rng, type Rng } from "@/lib/rng";

const sched = (name: string, power: number) => ({ name, type: "scheduler" as const, power });

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

/**
 * The moments a Round Robin chart hands the CPU on because a quantum ran out
 * (not because the job finished). A merged block is back-to-back dispatches
 * of one job, so its quantum ends are every `q` units from its start.
 */
export function quantumEnds(s: Schedule, jobs: readonly Job[], q: number): number[] {
  const done = new Map(jobs.map((j, i) => [j.name, s.completion[i]]));
  const ends: number[] = [];
  for (const b of s.gantt) {
    if (b.name === null) continue;
    for (let t = b.start + q; t < b.end; t += q) ends.push(t);
    if (done.get(b.name)! > b.end) ends.push(b.end);
  }
  return ends;
}

/**
 * Whether a Round Robin answer depends on the textbook convention for a job
 * that arrives just as a quantum expires (queue it ahead of the preempted job
 * or behind it). Generators avoid such workloads, so either convention agrees.
 */
export const rrAmbiguous = (jobs: readonly Job[], q: number) => {
  const ends = new Set(quantumEnds(roundRobin([...jobs], q), jobs, q));
  return jobs.some((j) => j.arrival > 0 && ends.has(j.arrival));
};

/** 3–4 jobs with staggered arrivals (P1 at 0), bursts 1–9 (or up to `maxBurst`), all distinct; with priorities 1–5, distinct too. */
function workload(r: Rng, opts: { n?: number; priorities?: boolean; together?: boolean; maxBurst?: number } = {}): PriorityJob[] {
  const n = opts.n ?? r.int(3, 4);
  const bursts = r.shuffle([...Array(opts.maxBurst ?? 9).keys()].map((i) => i + 1)).slice(0, n);
  const prios = r.shuffle([1, 2, 3, 4, 5]).slice(0, n);
  let at = 0;
  return bursts.map((burst, i) => {
    if (i > 0 && !opts.together) at += r.int(0, 3);
    return { name: `P${i + 1}`, arrival: at, burst, priority: opts.priorities ? prios[i] : 0 };
  });
}

const table = (jobs: readonly PriorityJob[], priorities: boolean) =>
  [
    priorities ? "Proc  Arrival  Burst  Priority" : "Proc  Arrival  Burst",
    ...jobs.map((j) => `${j.name.padEnd(6)}${String(j.arrival).padEnd(9)}${priorities ? `${String(j.burst).padEnd(7)}${j.priority}` : j.burst}`),
  ].join("\n");

interface Algo {
  key: string;
  /** how the prompt names it, with its tie rule */
  label: string;
  priorities: boolean;
  run: (jobs: PriorityJob[]) => Schedule;
  quantum?: number;
}

const ALGOS = (r: Rng): Algo[] => {
  const q = r.int(2, 4);
  return [
    { key: "sjf", label: "Non-preemptive SJF (ties: earlier arrival, then lower number)", priorities: false, run: sjf },
    { key: "srtf", label: "SRTF (a tie never preempts; otherwise earlier arrival first)", priorities: false, run: srtf },
    { key: "prio", label: "Non-preemptive priority (lower number = higher priority)", priorities: true, run: (j) => priority(j) },
    { key: "prio-p", label: "Preemptive priority (lower number = higher priority)", priorities: true, run: (j) => priority(j, { preemptive: true }) },
    { key: "rr", label: `Round Robin, quantum ${q}`, priorities: false, run: (j) => roundRobin(j, q), quantum: q },
  ];
};

const METRIC_RULE = {
  waiting: "Waiting = turnaround − burst",
  turnaround: "Turnaround = completion − arrival",
  response: "Response = first run − arrival",
} as const;

/** Average waiting, turnaround or response time under SJF, SRTF, priority or Round Robin. */
export const schedAverage: Generator = {
  id: "gen-sched-avg",
  topic: "Average waiting, turnaround and response time",
  make(seed): NumericQ {
    const r = rng(seed);
    const algo = r.pick(ALGOS(r));
    let jobs: PriorityJob[];
    do jobs = workload(r, { priorities: algo.priorities, together: algo.key === "rr" && r.next() < 0.4 });
    while (algo.quantum && rrAmbiguous(jobs, algo.quantum));
    // response time only differs from waiting time when jobs can be preempted
    const preempts = ["srtf", "prio-p", "rr"].includes(algo.key);
    const metric = r.pick(preempts ? (["waiting", "turnaround", "response"] as const) : (["waiting", "turnaround"] as const));
    const s = algo.run(jobs);
    const per = s[metric];
    const sum = per.reduce((a, b) => a + b, 0);
    const answer = sum / jobs.length;
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `${algo.label}. What is the average ${metric} time (ms)?`,
      code: table(jobs, algo.priorities),
      answer,
      unit: "ms",
      explain: `The chart: ${ganttText(s.gantt)}. ${METRIC_RULE[metric]}: ${jobs.map((j, i) => `${j.name} ${per[i]}`).join(", ")}. Average = ${sum}/${jobs.length} = ${fmt(answer)} ms.`,
      gantt: s.gantt,
      move: sched(metric === "response" ? "Quick Dispatch" : algo.key === "rr" ? "Time Slice" : "Short Burst", 34),
    };
  },
};

/** When one process finishes under SRTF, preemptive priority or Round Robin. */
export const schedFinish: Generator = {
  id: "gen-sched-finish",
  topic: "Completion time under preemption",
  make(seed): NumericQ {
    const r = rng(seed);
    const algo = r.pick(ALGOS(r).filter((a) => ["srtf", "prio-p", "rr"].includes(a.key)));
    let jobs: PriorityJob[];
    do jobs = workload(r, { n: 4, priorities: algo.priorities });
    while (algo.quantum && rrAmbiguous(jobs, algo.quantum));
    const s = algo.run(jobs);
    // ask about a job that gets preempted (runs in more than one block) when there is one
    const split = jobs.filter((j) => s.gantt.filter((b) => b.name === j.name).length > 1);
    const job = r.pick(split.length ? split : jobs);
    const i = jobs.indexOf(job);
    const blocks = s.gantt.filter((b) => b.name === job.name);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `${algo.label}. At what time does ${job.name} finish?`,
      code: table(jobs, algo.priorities),
      answer: s.completion[i],
      explain: `The chart: ${ganttText(s.gantt)}. ${job.name} runs ${blocks.map((b) => `${b.start}–${b.end}`).join(", ")}, so it finishes at ${s.completion[i]}.`,
      gantt: s.gantt,
      move: sched("Preempt", 36),
    };
  },
};

/** The choices for "which scheduler drew this chart", with the simulator that draws each. */
export const WHICH_ALGOS: { label: string; run: (jobs: Job[]) => Schedule }[] = [
  { label: "FCFS", run: fcfs },
  { label: "Non-preemptive SJF", run: sjf },
  { label: "SRTF", run: srtf },
  { label: "Round Robin (q = 2)", run: (j) => roundRobin(j, 2) },
];

const WHY: Record<string, string> = {
  FCFS: "FCFS runs each job to the end in arrival order.",
  "Non-preemptive SJF": "SJF never interrupts a job, but when the CPU frees up it takes the shortest waiting one, not the first to arrive.",
  SRTF: "SRTF interrupts the running job as soon as a job arrives with less time left.",
  "Round Robin (q = 2)": "Round Robin gives each job at most 2 units at a time and cycles through the queue.",
};

const sameChart = (a: readonly Slice[], b: readonly Slice[]) => ganttText(a) === ganttText(b);

/** Show a Gantt chart and ask which of FCFS, SJF, SRTF and Round Robin drew it. */
export const schedWhich: Generator = {
  id: "gen-sched-which",
  topic: "Which algorithm made this chart",
  make(seed): McqQ {
    const r = rng(seed);
    let jobs: PriorityJob[];
    let charts: Slice[][];
    // every choice must draw a different chart, so exactly one option fits
    do {
      jobs = workload(r);
      charts = WHICH_ALGOS.map((a) => a.run(jobs).gantt);
    } while (rrAmbiguous(jobs, 2) || charts.some((c, i) => charts.some((d, k) => k > i && sameChart(c, d))));
    const answer = r.int(0, WHICH_ALGOS.length - 1);
    const label = WHICH_ALGOS[answer].label;
    const options = r.shuffle(WHICH_ALGOS.map((a) => a.label));
    // where each other chart first parts from this one
    const others = WHICH_ALGOS.flatMap((a, i) => {
      if (i === answer) return [];
      const k = charts[i].findIndex((b, n) => ganttText([b]) !== ganttText([charts[answer][n] ?? b]));
      const b = charts[i][k];
      return [`${a.label} would run ${b.name} ${b.start}–${b.end}`];
    }).join(", ");
    return {
      id: `${this.id}#${seed}`,
      prompt: `Jobs: ${jobs.map((j) => `${j.name} arrives at ${j.arrival}, burst ${j.burst}`).join("; ")}. Which scheduler drew this chart?`,
      options,
      answer: options.indexOf(label),
      explain: `${WHY[label]} Here, where the charts first differ, ${others}.`,
      chart: charts[answer],
      gantt: charts[answer],
      move: sched("Clock Read", 32),
    };
  },
};

/** The schedulers a player builds charts for, each with the hint shown in its prompt. */
export const BUILD_ALGOS: { key: string; label: string; hint: string; priorities: boolean; quantum?: number; run: (jobs: PriorityJob[]) => Schedule }[] = [
  { key: "fcfs", label: "FCFS", hint: "Run each job to the end, in arrival order.", priorities: false, run: fcfs },
  { key: "sjf", label: "Non-preemptive SJF", hint: "When the CPU frees up, take the shortest job that has arrived (ties: earlier arrival).", priorities: false, run: sjf },
  { key: "srtf", label: "SRTF", hint: "At every moment run the job with the least time left (a tie never preempts).", priorities: false, run: srtf },
  { key: "prio-p", label: "Preemptive priority", hint: "At every moment run the highest-priority job that has arrived (lower number = higher priority).", priorities: true, run: (j) => priority(j, { preemptive: true }) },
  { key: "rr", label: "Round Robin, quantum 2", hint: "Give each job at most 2 units, then send it to the back of the queue.", priorities: false, quantum: 2, run: (j) => roundRobin(j, 2) },
];

/** Build the Gantt chart for FCFS, SJF, SRTF, preemptive priority or Round Robin by tapping. */
export const schedBuild: Generator = {
  id: "gen-sched-build",
  topic: "Building a Gantt chart",
  make(seed): GanttQ {
    const r = rng(seed);
    const algo = r.pick(BUILD_ALGOS);
    let jobs: PriorityJob[];
    let s: Schedule;
    // short enough to tap out, and with no Round Robin tie between conventions
    do {
      jobs = workload(r, { priorities: algo.priorities, maxBurst: 6 });
      s = algo.run(jobs);
    } while (s.gantt[s.gantt.length - 1].end > MAX_GANTT_UNITS || (algo.quantum !== undefined && rrAmbiguous(jobs, algo.quantum)));
    return {
      kind: "gantt",
      id: `${this.id}#${seed}`,
      prompt: `Build the ${algo.label} Gantt chart: each tap gives the next time unit to a process. ${algo.hint}`,
      jobs: jobs.map((j) => j.name),
      code: table(jobs, algo.priorities),
      answer: s.gantt,
      explain: `${algo.label}: ${ganttText(s.gantt)}. ${algo.hint}`,
      gantt: s.gantt,
      move: sched("Gantt Forge", 34),
    };
  },
};

export const SCHEDULING_GENERATORS: Generator[] = [fcfsAverage, schedAverage, schedFinish, schedWhich, schedBuild];
