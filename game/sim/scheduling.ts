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
export const ganttText = (g: Slice[]) => g.map((s) => `${s.name ?? "idle"} ${s.start}–${s.end}`).join(" | ");
