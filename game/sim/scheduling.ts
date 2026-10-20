/**
 * CPU-scheduling simulators. Each returns the Gantt chart and per-process
 * times, and the tests check them against Silberschatz's worked examples.
 */
export interface Job {
  name: string;
  arrival: number;
  burst: number;
}

/** One block of the Gantt chart; `name` is null while the CPU is idle. */
export interface Slice {
  name: string | null;
  start: number;
  end: number;
}

export interface Schedule {
  gantt: Slice[];
  /** per job, in input order */
  completion: number[];
  turnaround: number[];
  waiting: number[];
  response: number[];
  avgWaiting: number;
  avgTurnaround: number;
  avgResponse: number;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** First-come, first-served (non-preemptive); ties on arrival keep input order. */
export function fcfs(jobs: Job[]): Schedule {
  const order = jobs.map((_, i) => i).sort((a, b) => jobs[a].arrival - jobs[b].arrival || a - b);
  const gantt: Slice[] = [];
  const completion = new Array<number>(jobs.length);
  const start = new Array<number>(jobs.length);
  let t = 0;
  for (const i of order) {
    const j = jobs[i];
    if (t < j.arrival) {
      gantt.push({ name: null, start: t, end: j.arrival });
      t = j.arrival;
    }
    start[i] = t;
    gantt.push({ name: j.name, start: t, end: t + j.burst });
    t += j.burst;
    completion[i] = t;
  }
  const turnaround = jobs.map((j, i) => completion[i] - j.arrival);
  const waiting = jobs.map((j, i) => turnaround[i] - j.burst);
  const response = jobs.map((j, i) => start[i] - j.arrival);
  return { gantt, completion, turnaround, waiting, response, avgWaiting: avg(waiting), avgTurnaround: avg(turnaround), avgResponse: avg(response) };
}

/** The Gantt chart as text, e.g. "P1 0–24 | P2 24–27 | P3 27–30". */
export const ganttText = (g: readonly Slice[]) => g.map((s) => `${s.name ?? "idle"} ${s.start}–${s.end}`).join(" | ");

/** Job with a priority number; lower numbers mean higher priority (Silberschatz's convention). */
export interface PriorityJob extends Job {
  priority: number;
}

/** Ready-queue tie-break: earlier arrival first, then input order. */
const byArrival = (jobs: Job[]) => (a: number, b: number) => jobs[a].arrival - jobs[b].arrival || a - b;

/** Appends a run of `name` from t to t + d, merging with the previous block if it's the same. */
function push(gantt: Slice[], name: string | null, t: number, d: number) {
  const last = gantt[gantt.length - 1];
  if (last && last.name === name && last.end === t) last.end = t + d;
  else gantt.push({ name, start: t, end: t + d });
}

/** Per-job times from a finished Gantt chart. */
function finish(jobs: Job[], gantt: Slice[]): Schedule {
  const completion = jobs.map((j) => Math.max(...gantt.filter((s) => s.name === j.name).map((s) => s.end)));
  const first = jobs.map((j) => Math.min(...gantt.filter((s) => s.name === j.name).map((s) => s.start)));
  const turnaround = jobs.map((j, i) => completion[i] - j.arrival);
  const waiting = jobs.map((j, i) => turnaround[i] - j.burst);
  const response = jobs.map((j, i) => first[i] - j.arrival);
  return { gantt, completion, turnaround, waiting, response, avgWaiting: avg(waiting), avgTurnaround: avg(turnaround), avgResponse: avg(response) };
}

/**
 * A non-preemptive scheduler: whenever the CPU frees up, `pick` chooses among
 * the arrived jobs (given in arrival order) and that job runs to completion.
 */
function nonPreemptive(jobs: Job[], pick: (ready: number[]) => number): Schedule {
  const gantt: Slice[] = [];
  const left = jobs.map((_, i) => i).sort(byArrival(jobs));
  let t = 0;
  while (left.length) {
    let ready = left.filter((i) => jobs[i].arrival <= t);
    if (!ready.length) {
      const next = jobs[left[0]].arrival;
      push(gantt, null, t, next - t);
      t = next;
      ready = left.filter((i) => jobs[i].arrival <= t);
    }
    const i = pick(ready);
    left.splice(left.indexOf(i), 1);
    push(gantt, jobs[i].name, t, jobs[i].burst);
    t += jobs[i].burst;
  }
  return finish(jobs, gantt);
}

/** Lowest key wins; ties go to the first of `ready` (earliest arrival, then input order). */
const minBy = (ready: number[], key: (i: number) => number) => ready.reduce((best, i) => (key(i) < key(best) ? i : best));

/** Shortest-job-first (non-preemptive); ties are FCFS. */
export const sjf = (jobs: Job[]) => nonPreemptive(jobs, (ready) => minBy(ready, (i) => jobs[i].burst));

/** Non-preemptive priority (lower number = higher priority); ties are FCFS. */
export const priorityNP = (jobs: PriorityJob[]) => nonPreemptive(jobs, (ready) => minBy(ready, (i) => jobs[i].priority));

/**
 * A preemptive scheduler stepped one time unit at a time: every tick, `pick`
 * chooses among the arrived, unfinished jobs (in arrival order) given the
 * job that ran last tick, and that job runs for one unit.
 */
function preemptive(jobs: Job[], pick: (ready: number[], remaining: number[], t: number, running: number | null) => number): Schedule {
  const gantt: Slice[] = [];
  const remaining = jobs.map((j) => j.burst);
  const order = jobs.map((_, i) => i).sort(byArrival(jobs));
  let t = 0;
  let running: number | null = null;
  while (remaining.some((r) => r > 0)) {
    const ready = order.filter((i) => remaining[i] > 0 && jobs[i].arrival <= t);
    if (!ready.length) {
      push(gantt, null, t, 1);
      running = null;
    } else {
      const i = pick(ready, remaining, t, running);
      push(gantt, jobs[i].name, t, 1);
      remaining[i]--;
      running = remaining[i] > 0 ? i : null;
    }
    t++;
  }
  return finish(jobs, gantt);
}

/** Shortest-remaining-time-first (preemptive SJF); a tie keeps the running job, else FCFS. */
export const srtf = (jobs: Job[]) =>
  preemptive(jobs, (ready, rem, _t, running) => (running !== null && rem[running] === Math.min(...ready.map((i) => rem[i])) ? running : minBy(ready, (i) => rem[i])));

/**
 * Priority scheduling, preemptive or not, with optional aging: for every
 * `aging` time units a job spends waiting in the ready queue, its priority
 * number drops by 1 (never below 0), so a low-priority job can't starve.
 */
export function priority(jobs: PriorityJob[], opts: { preemptive?: boolean; aging?: number } = {}): Schedule {
  const { preemptive: pre = false, aging = 0 } = opts;
  if (!aging) return pre ? priorityP(jobs) : priorityNP(jobs);
  const waited = jobs.map(() => 0);
  const eff = (i: number) => Math.max(0, jobs[i].priority - Math.floor(waited[i] / aging));
  return preemptive(jobs, (ready, _rem, _t, running) => {
    const i = !pre && running !== null ? running : running !== null && eff(running) === Math.min(...ready.map(eff)) ? running : minBy(ready, eff);
    for (const r of ready) if (r !== i) waited[r]++;
    return i;
  });
}

/** Preemptive priority; a tie keeps the running job, else FCFS. */
const priorityP = (jobs: PriorityJob[]) =>
  preemptive(jobs, (ready, _rem, _t, running) => {
    const p = (i: number) => jobs[i].priority;
    return running !== null && p(running) === Math.min(...ready.map(p)) ? running : minBy(ready, p);
  });

/**
 * Round Robin with time quantum `q`. A job that arrives at the moment another
 * job's quantum expires joins the queue ahead of it (the usual textbook rule).
 */
export function roundRobin(jobs: Job[], q: number): Schedule {
  return mlfq(jobs, [q]);
}

/**
 * Multilevel feedback queue. `quanta[k]` is queue k's quantum (Infinity for
 * an FCFS bottom queue). New jobs enter queue 0; a job that uses its whole
 * quantum drops one queue (the last queue round-robins within itself). A
 * job in a higher queue preempts a lower one; the preempted job goes to the
 * back of its own queue without being demoted.
 */
export function mlfq(jobs: Job[], quanta: number[]): Schedule {
  const gantt: Slice[] = [];
  const remaining = jobs.map((j) => j.burst);
  const level = jobs.map(() => 0);
  const queues: number[][] = quanta.map(() => []);
  const order = jobs.map((_, i) => i).sort(byArrival(jobs));
  let next = 0;
  const admit = (t: number) => {
    while (next < order.length && jobs[order[next]].arrival <= t) queues[0].push(order[next++]);
  };
  let t = 0;
  admit(t);
  while (remaining.some((r) => r > 0)) {
    const k = queues.findIndex((qq) => qq.length > 0);
    if (k < 0) {
      const at = jobs[order[next]].arrival;
      push(gantt, null, t, at - t);
      t = at;
      admit(t);
      continue;
    }
    const i = queues[k].shift()!;
    let used = 0;
    let preempted = false;
    while (remaining[i] > 0 && used < quanta[k]) {
      push(gantt, jobs[i].name, t, 1);
      remaining[i]--;
      used++;
      t++;
      admit(t);
      if (remaining[i] > 0 && used < quanta[k] && queues.slice(0, k).some((qq) => qq.length > 0)) {
        preempted = true;
        break;
      }
    }
    if (remaining[i] > 0) {
      if (!preempted) level[i] = Math.min(k + 1, quanta.length - 1);
      queues[level[i]].push(i);
    }
  }
  return finish(jobs, gantt);
}
