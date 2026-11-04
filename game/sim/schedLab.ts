/**
 * Scheduler lab engine: run any algorithm on an editable workload and grade
 * the lab's challenges. Pure; the page only draws what this returns.
 */
import { fcfs, mlfq, priority, roundRobin, sjf, srtf, type Job, type PriorityJob, type Schedule } from "./scheduling";

export type AlgoId = "fcfs" | "sjf" | "srtf" | "rr" | "prio" | "prioP" | "prioAge" | "mlfq";

export type LabJob = PriorityJob;

export interface AlgoConfig {
  id: AlgoId;
  /** round-robin quantum, or the first MLFQ level's quantum */
  quantum: number;
}

export const ALGOS: { id: AlgoId; label: string; short: string }[] = [
  { id: "fcfs", label: "First come, first served", short: "FCFS" },
  { id: "sjf", label: "Shortest job first", short: "SJF" },
  { id: "srtf", label: "Shortest remaining time", short: "SRTF" },
  { id: "rr", label: "Round robin", short: "RR" },
  { id: "prio", label: "Priority", short: "PRIO" },
  { id: "prioP", label: "Priority, preemptive", short: "PRIO-P" },
  { id: "prioAge", label: "Priority, preemptive + aging", short: "AGING" },
  { id: "mlfq", label: "Multilevel feedback queue (q, 2q, FCFS)", short: "MLFQ" },
];

export const MAX_JOBS = 6;
export const MAX_BURST = 30;
export const MAX_ARRIVAL = 30;
/** aging rule used by the lab: priority number drops by 1 per this many waited ticks */
export const AGING_STEP = 2;

/** Clamp a hand-edited workload to sane integers (the lab's inputs can hold anything). */
export function sanitize(jobs: readonly LabJob[]): LabJob[] {
  const int = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? Math.trunc(v) : lo));
  return jobs.slice(0, MAX_JOBS).map((j, i) => ({
    name: j.name || `P${i + 1}`,
    arrival: int(j.arrival, 0, MAX_ARRIVAL),
    burst: int(j.burst, 1, MAX_BURST),
    priority: int(j.priority, 0, 9),
  }));
}

export function runAlgo(jobs: readonly LabJob[], cfg: AlgoConfig): Schedule {
  const js = sanitize(jobs);
  const q = Math.max(1, Math.trunc(cfg.quantum) || 1);
  switch (cfg.id) {
    case "fcfs":
      return fcfs(js);
    case "sjf":
      return sjf(js);
    case "srtf":
      return srtf(js);
    case "rr":
      return roundRobin(js, q);
    case "prio":
      return priority(js);
    case "prioP":
      return priority(js, { preemptive: true });
    case "prioAge":
      return priority(js, { preemptive: true, aging: AGING_STEP });
    case "mlfq":
      return mlfq(js, [q, q * 2, Infinity]);
  }
}

export interface Metrics {
  avgWaiting: number;
  avgTurnaround: number;
  avgResponse: number;
  maxWaiting: number;
  maxResponse: number;
  makespan: number;
  /** number of context switches (a different job, or the CPU going idle between jobs) */
  switches: number;
}

export function metrics(jobs: readonly Job[], s: Schedule): Metrics {
  void jobs;
  const run = s.gantt.filter((g) => g.name !== null);
  let switches = 0;
  for (let i = 1; i < run.length; i++) if (run[i].name !== run[i - 1].name) switches++;
  return {
    avgWaiting: s.avgWaiting,
    avgTurnaround: s.avgTurnaround,
    avgResponse: s.avgResponse,
    maxWaiting: Math.max(...s.waiting),
    maxResponse: Math.max(...s.response),
    makespan: s.gantt.length ? s.gantt[s.gantt.length - 1].end : 0,
    switches,
  };
}

export interface Challenge {
  id: string;
  title: string;
  /** what the player must achieve, in plain words */
  goal: string;
  hint: string;
  jobs: LabJob[];
  /** which algorithms the player may use (all if omitted) */
  allowed?: AlgoId[];
  /** true when the metrics meet the goal */
  check: (m: Metrics, cfg: AlgoConfig) => boolean;
}

const J = (name: string, arrival: number, burst: number, priority = 0): LabJob => ({ name, arrival, burst, priority });

/** Textbook workload (Silberschatz): P1 24, P2 3, P3 3, all at t=0. */
const CONVOY = [J("P1", 0, 24), J("P2", 0, 3), J("P3", 0, 3)];
/** Silberschatz's SJF example: bursts 6, 8, 7, 3 at t=0. */
const SJF4 = [J("P1", 0, 6), J("P2", 0, 8), J("P3", 0, 7), J("P4", 0, 3)];
/** Silberschatz's priority example. */
const PRIO5 = [J("P1", 0, 10, 3), J("P2", 0, 1, 1), J("P3", 0, 2, 4), J("P4", 0, 1, 5), J("P5", 0, 5, 2)];
/** A steady stream of high-priority work with one low-priority job at the end of the line. */
const STARVE = [J("LOW", 0, 4, 9), ...[0, 5, 10, 15, 20, 25].map((a, i) => J(`H${i + 1}`, a, 6, 1))];
/** An interactive pair stuck behind two long CPU hogs. */
const INTERACTIVE = [J("HOG1", 0, 20), J("HOG2", 0, 20), J("UI", 1, 2), J("KEY", 2, 2)];

export const CHALLENGES: Challenge[] = [
  {
    id: "convoy",
    title: "Break the convoy",
    goal: "Average waiting time at most 3.",
    hint: "One long job at the head of a FCFS queue makes everyone wait for it. Who should go first?",
    jobs: CONVOY,
    check: (m) => m.avgWaiting <= 3,
  },
  {
    id: "sjf-optimal",
    title: "The shortest wait",
    goal: "Average waiting time of exactly 7, the best any order can do here.",
    hint: "Shortest first minimises the average wait when everything is ready at once.",
    jobs: SJF4,
    check: (m) => m.avgWaiting === 7,
  },
  {
    id: "response",
    title: "Snappy UI",
    goal: "Worst response time at most 3 (everyone gets the CPU within 3 ticks of arriving).",
    hint: "Response time is arrival to first run. Slice the CPU into very short quanta so nobody waits for a hog to finish.",
    jobs: INTERACTIVE,
    check: (m) => m.maxResponse <= 3,
  },
  {
    id: "no-starve",
    title: "No starvation",
    goal: "Every job waits at most 20 ticks, with priorities still respected.",
    hint: "Plain preemptive priority lets the stream of 1-priority jobs push LOW back forever. Something has to make waiting count.",
    jobs: STARVE,
    allowed: ["prio", "prioP", "prioAge"],
    check: (m) => m.maxWaiting <= 20,
  },
  {
    id: "prio-textbook",
    title: "Priority order",
    goal: "Average waiting time exactly 8.2 using a priority scheduler (lower number = higher priority).",
    hint: "Run the jobs in priority order with no preemption needed: everyone arrives together.",
    jobs: PRIO5,
    allowed: ["prio", "prioP"],
    check: (m) => Math.abs(m.avgWaiting - 8.2) < 1e-9,
  },
  {
    id: "rr-quantum",
    title: "Pick the quantum",
    goal: "Round robin with average waiting time at most 5.67 (the textbook q=4 result).",
    hint: "Try a few quanta. Too long and RR turns into FCFS.",
    jobs: CONVOY,
    allowed: ["rr"],
    check: (m) => m.avgWaiting <= 5.67 + 1e-9,
  },
  {
    id: "few-switches",
    title: "Cheap switching",
    goal: "Round robin or MLFQ finishing with no more than 4 context switches.",
    hint: "Every switch costs real time in a kernel. A larger quantum switches less (but answers later).",
    jobs: [J("A", 0, 8), J("B", 0, 8), J("C", 0, 8)],
    allowed: ["rr", "mlfq"],
    check: (m) => m.switches <= 4,
  },
  {
    id: "srtf-vs-sjf",
    title: "Preemption pays",
    goal: "Average waiting time at most 6.5 on this staggered workload.",
    hint: "A short job that arrives while a long one runs can't wait for it. Which algorithms let it cut in?",
    jobs: [J("P1", 0, 8), J("P2", 1, 4), J("P3", 2, 9), J("P4", 3, 5)],
    check: (m) => m.avgWaiting <= 6.5,
  },
];

export interface Grade {
  ok: boolean;
  metrics: Metrics;
  /** false when the chosen algorithm isn't allowed for this challenge */
  allowed: boolean;
}

/** Grade a player's configuration on a challenge's own fixed workload. */
export function gradeChallenge(c: Challenge, cfg: AlgoConfig): Grade {
  const allowed = !c.allowed || c.allowed.includes(cfg.id);
  const m = metrics(c.jobs, runAlgo(c.jobs, cfg));
  return { ok: allowed && c.check(m, cfg), metrics: m, allowed };
}

/** Every configuration (algorithm × quanta 1..8) that solves the challenge; used by tests. */
export function solutions(c: Challenge): AlgoConfig[] {
  const out: AlgoConfig[] = [];
  for (const a of ALGOS) for (let quantum = 1; quantum <= 8; quantum++) if (gradeChallenge(c, { id: a.id, quantum }).ok) out.push({ id: a.id, quantum });
  return out;
}
