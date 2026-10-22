/**
 * The question engine: every battle turn asks one Question. There are five
 * kinds, all graded by `grade` (pure, no UI):
 *
 *   mcq      pick one of the options
 *   multi    select every correct option (all of them, nothing else)
 *   numeric  type a number (within a tolerance, fractions like 17/3 allowed)
 *   order    put shuffled steps back in order
 *   gantt    build a scheduler's Gantt chart one time unit per tap
 *   interleave  be the scheduler: tap which thread runs its next step
 *   banker   tap the processes in a safe order (Banker's algorithm)
 *   cycle    tap the nodes of a deadlock cycle in a resource-allocation graph
 *   translate  tap the page-table entry a logical address maps through
 *   victim   tap the frame a page-replacement policy evicts
 *
 * Generated problems come from a `Generator`, which builds a question from a
 * seed, so the same seed always gives the same question and answer.
 */
import { ganttText, type Slice } from "@/game/sim/scheduling";
import { findCycle, isCycleNodes, isSafeSequence, type BankerState, type Edge } from "@/game/sim/deadlock";
import { translate } from "@/game/sim/memory";
import { replacePages, type Replacement } from "@/game/sim/paging";
import { runSchedule, scheduleText, type SyncThread } from "@/game/sim/sync";
import type { MoveType } from "./types";

export interface Move {
  name: string;
  type: MoveType;
  power: number;
}

interface Base {
  id: string;
  prompt: string;
  /** shown after every answer, right or wrong */
  explain: string;
  /** a Gantt chart drawn beside the explanation (scheduling problems) */
  gantt?: readonly Slice[];
  /** a Gantt chart shown with the question itself (e.g. "which algorithm drew this?") */
  chart?: readonly Slice[];
  move: Move;
}

/** `kind` is optional so the original MCQ data stays valid as-is. */
export interface McqQ extends Base {
  kind?: "mcq";
  options: readonly string[];
  /** index into `options` */
  answer: number;
  /** monospaced block shown beside the options (a table or code the question is about) */
  code?: string;
}

export interface MultiQ extends Base {
  kind: "multi";
  options: readonly string[];
  /** indexes of every correct option */
  answers: readonly number[];
}

export interface NumericQ extends Base {
  kind: "numeric";
  answer: number;
  /** accepted absolute error (default 0.01, enough for answers to 2 d.p.) */
  tolerance?: number;
  unit?: string;
  /** monospaced block shown with the prompt, e.g. code or a process table */
  code?: string;
}

export interface OrderQ extends Base {
  kind: "order";
  /** the steps in the correct order (they are shown shuffled) */
  steps: readonly string[];
}

export interface GanttQ extends Base {
  kind: "gantt";
  /** the processes the player can tap, in palette order */
  jobs: readonly string[];
  /** the process table, shown with the prompt */
  code?: string;
  /** the right chart (from a simulator), starting at 0 with whole-unit blocks */
  answer: readonly Slice[];
}

export interface InterleaveQ extends Base {
  kind: "interleave";
  /** each thread's machine steps (load / add / store) */
  threads: readonly SyncThread[];
  /** the shared variables' starting values */
  init: Readonly<Record<string, number>>;
  /** the shared variable to watch and the value it must end at */
  goal: { v: string; value: number };
  /** one schedule (a thread index per step) that reaches the goal, found by the simulator */
  answer: readonly number[];
}

export interface BankerQ extends Base {
  kind: "banker";
  /** resource-type names, one per column (e.g. A, B, C) */
  resources: readonly string[];
  /** Available, Allocation and Max; the player works out Need */
  state: BankerState;
  /** one safe sequence (process indexes), found by the safety algorithm */
  answer: readonly number[];
}

export interface CycleNode {
  /** "P1", "R2": the first letter says process (P) or resource (R) */
  id: string;
  /** position in a 100 × 60 drawing */
  x: number;
  y: number;
}

export interface CycleQ extends Base {
  kind: "cycle";
  /** a resource-allocation graph with one instance per resource */
  nodes: readonly CycleNode[];
  /** P → R is a request, R → P an assignment */
  edges: readonly Edge[];
  /** the nodes of one cycle, or empty when the graph has none (no deadlock) */
  answer: readonly string[];
}

export interface TranslateQ extends Base {
  kind: "translate";
  /** bytes per page (a power of two) */
  pageSize: number;
  /** the logical address to translate */
  logical: number;
  /** frame per page, null = invalid (not mapped) */
  table: readonly (number | null)[];
  /** the page number whose entry the hardware reads */
  answer: number;
}

export interface VictimQ extends Base {
  kind: "victim";
  /** the policy whose choice the player must predict (Clock isn't asked: its hand isn't visible) */
  policy: Exclude<Replacement, "clock">;
  frameCount: number;
  /** the whole reference string; the player is asked about the fault at `at` */
  refs: readonly number[];
  at: number;
  /** the frame (index) holding the page the policy evicts */
  answer: number;
}

/** The frames just before reference `at`, and the frame the policy replaces there (null = no replacement). */
export function victimSetup(q: Pick<VictimQ, "policy" | "frameCount" | "refs" | "at">): { frames: (number | null)[]; victimFrame: number | null } {
  const steps = replacePages(q.refs, q.frameCount, q.policy).steps;
  const frames = q.at > 0 ? steps[q.at - 1].frames : Array<number | null>(q.frameCount).fill(null);
  const after = steps[q.at].frames;
  const victimFrame = steps[q.at].victim === null ? null : after.findIndex((p, i) => p !== frames[i]);
  return { frames, victimFrame };
}

/** Most processes a banker question may have (one tap each). */
export const MAX_BANKER_PROCESSES = 6;

/** Most steps an interleave question may have (one tap each). */
export const MAX_INTERLEAVE_STEPS = 12;

/** Longest chart a build question may ask for: one tap per unit, so keep it short. */
export const MAX_GANTT_UNITS = 24;

export type Question = McqQ | MultiQ | NumericQ | OrderQ | GanttQ | InterleaveQ | BankerQ | CycleQ | TranslateQ | VictimQ;
export type QuestionKind = "mcq" | "multi" | "numeric" | "order" | "gantt" | "interleave" | "banker" | "cycle" | "translate" | "victim";

export const kindOf = (q: Question): QuestionKind => q.kind ?? "mcq";

export type Response =
  | { kind: "mcq"; choice: number }
  | { kind: "multi"; choices: readonly number[] }
  | { kind: "numeric"; value: string }
  /** step indexes (into `steps`) in the order the player put them */
  | { kind: "order"; order: readonly number[] }
  /** who runs in each time unit from 0 (null = idle) */
  | { kind: "gantt"; units: readonly (string | null)[] }
  /** the thread that took each step, in order */
  | { kind: "interleave"; schedule: readonly number[] }
  /** the processes in the order the player listed them */
  | { kind: "banker"; sequence: readonly number[] }
  /** the nodes the player marked as the cycle (none = "no deadlock") */
  | { kind: "cycle"; nodes: readonly string[] }
  /** the page-table entry (page number) the player tapped */
  | { kind: "translate"; page: number }
  /** the frame the player tapped */
  | { kind: "victim"; frame: number };

/**
 * Where an interleaving leaves the goal variable, or null if the schedule
 * isn't a complete, valid run (a thread stepped past its end, or one didn't finish).
 */
export function interleaveResult(q: InterleaveQ, schedule: readonly number[]): number | null {
  if (schedule.some((t) => !Number.isInteger(t) || t < 0 || t >= q.threads.length)) return null;
  try {
    const run = runSchedule(q.init, q.threads, schedule);
    return run.done ? run.shared[q.goal.v] : null;
  } catch {
    return null;
  }
}

/** A chart as one entry per time unit: [P1, P1, P2, null, …]. */
export function unitsOf(chart: readonly Slice[]): (string | null)[] {
  return chart.flatMap((b) => Array<string | null>(b.end - b.start).fill(b.name));
}

/** Time units merged back into a chart's blocks. */
export function chartOf(units: readonly (string | null)[]): Slice[] {
  const out: Slice[] = [];
  units.forEach((name, t) => {
    const last = out[out.length - 1];
    if (last && last.name === name) last.end = t + 1;
    else out.push({ name, start: t, end: t + 1 });
  });
  return out;
}

/** Parse a typed number: "17", "-2.5", ".5", "17/3", "1,000". Null if it isn't one. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/,(?=\d{3}\b)/g, "");
  const frac = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

const sameSet = (a: readonly number[], b: readonly number[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

/** Is this response right? A response of the wrong kind is wrong. */
export function grade(q: Question, r: Response): boolean {
  const k = kindOf(q);
  if (r.kind !== k) return false;
  switch (r.kind) {
    case "mcq":
      return r.choice === (q as McqQ).answer;
    case "multi":
      return sameSet(r.choices, (q as MultiQ).answers);
    case "numeric": {
      const n = parseNumber(r.value);
      const nq = q as NumericQ;
      // a hair of slack so 17/3 matches an answer stored as 5.67
      return n !== null && Math.abs(n - nq.answer) <= (nq.tolerance ?? 0.01) + 1e-9;
    }
    case "order":
      return r.order.length === (q as OrderQ).steps.length && r.order.every((s, i) => s === i);
    case "gantt": {
      const want = unitsOf((q as GanttQ).answer);
      return r.units.length === want.length && r.units.every((u, i) => u === want[i]);
    }
    case "interleave": {
      // any interleaving that reaches the goal is right, not just the stored one
      const iq = q as InterleaveQ;
      return interleaveResult(iq, r.schedule) === iq.goal.value;
    }
    case "banker":
      // any safe sequence is right, not just the one the safety algorithm found
      return isSafeSequence((q as BankerQ).state, r.sequence);
    case "cycle": {
      // any cycle is right, not just the stored one; no marks means "no deadlock"
      const cq = q as CycleQ;
      return r.nodes.length === 0 ? findCycle(cq.edges) === null : isCycleNodes(cq.edges, r.nodes);
    }
    case "translate":
      return r.page === (q as TranslateQ).answer;
    case "victim":
      return r.frame === (q as VictimQ).answer;
  }
}

/** Round to at most 2 decimals for display (17 → "17", 5.666… → "5.67"). */
export const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** The right answer in words, shown after a wrong one. */
export function answerText(q: Question): string {
  switch (q.kind) {
    case "multi":
      return q.answers
        .slice()
        .sort((a, b) => a - b)
        .map((i) => q.options[i])
        .join(", ");
    case "numeric":
      return q.unit ? `${fmt(q.answer)} ${q.unit}` : fmt(q.answer);
    case "order":
      return q.steps.map((s, i) => `${i + 1}. ${s}`).join(" ");
    case "gantt":
      return ganttText(q.answer);
    case "interleave":
      return scheduleText(q.threads, q.answer);
    case "banker":
      return `<${q.answer.map((p) => `P${p}`).join(", ")}>`;
    case "cycle":
      return q.answer.length ? `the cycle ${q.answer.join(" → ")} → ${q.answer[0]}` : "no cycle, so no deadlock";
    case "translate": {
      const t = translate(q.logical, q.pageSize, q.table);
      return t.physical === null ? `page ${t.page}, which is invalid, so the MMU traps` : `page ${t.page}, frame ${t.frame}: physical ${t.physical}`;
    }
    case "victim": {
      const { frames } = victimSetup(q);
      return `frame ${q.answer} (page ${frames[q.answer]})`;
    }
    default:
      return q.options[q.answer];
  }
}

/** What to say after a wrong answer (MCQs need nothing: the menu marks the right option). */
export function correctionText(q: Question): string | null {
  switch (kindOf(q)) {
    case "mcq":
      return null;
    case "order":
      return "Here is the right order.";
    case "gantt":
      return "Here is the right chart.";
    case "interleave":
      return "Here is one schedule that works.";
    case "banker":
      return "Here is one safe sequence.";
    case "cycle":
      return "Here is the cycle.";
    case "translate":
      return `The entry is ${answerText(q)}.`;
    case "victim":
      return `The victim is ${answerText(q)}.`;
    default:
      return `The answer: ${answerText(q)}.`;
  }
}

/**
 * The order the steps start in: a seeded shuffle that is never already
 * correct (for two or more steps).
 */
export function scrambled(q: OrderQ, seed: number): number[] {
  const n = q.steps.length;
  const idx = [...Array(n).keys()];
  if (n < 2) return idx;
  let a = (seed >>> 0) || 1;
  for (let i = n - 1; i > 0; i--) {
    a = (Math.imul(a, 1103515245) + 12345) >>> 0;
    const j = a % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  // never hand the player the answer: rotate an identity shuffle by one
  return idx.every((v, i) => v === i) ? [...idx.slice(1), idx[0]] : idx;
}

/** Structural problems with a question (empty when it's well-formed). */
export function questionProblems(q: Question): string[] {
  const p: string[] = [];
  if (!q.id) p.push("missing id");
  if (!q.prompt.trim()) p.push("empty prompt");
  if (!q.explain.trim()) p.push("empty explanation");
  if (!(q.move.power > 0)) p.push("move power must be positive");
  switch (q.kind) {
    case "multi":
      if (q.options.length < 3 || q.options.length > 6) p.push("multi needs 3–6 options");
      if (q.answers.length < 1) p.push("multi needs at least one answer");
      if (new Set(q.answers).size !== q.answers.length) p.push("duplicate answers");
      if (q.answers.some((i) => !Number.isInteger(i) || i < 0 || i >= q.options.length)) p.push("answer out of range");
      if (new Set(q.options).size !== q.options.length) p.push("duplicate options");
      break;
    case "numeric":
      if (!Number.isFinite(q.answer)) p.push("answer must be finite");
      if (q.tolerance !== undefined && !(q.tolerance >= 0)) p.push("bad tolerance");
      break;
    case "order":
      if (q.steps.length < 3 || q.steps.length > 6) p.push("order needs 3–6 steps");
      if (new Set(q.steps).size !== q.steps.length) p.push("duplicate steps");
      break;
    case "gantt": {
      const a = q.answer;
      if (q.jobs.length < 2 || q.jobs.length > 5) p.push("gantt needs 2–5 jobs");
      if (new Set(q.jobs).size !== q.jobs.length) p.push("duplicate jobs");
      if (a.length === 0 || a[0].start !== 0) p.push("chart must start at 0");
      if (a.some((b, i) => !Number.isInteger(b.start) || !Number.isInteger(b.end) || b.end <= b.start || (i > 0 && a[i - 1].end !== b.start))) p.push("chart must be contiguous whole units");
      if (a.some((b, i) => i > 0 && a[i - 1].name === b.name)) p.push("chart blocks must be merged");
      if (a.some((b) => b.name !== null && !q.jobs.includes(b.name))) p.push("chart names a job not in jobs");
      if (q.jobs.some((j) => !a.some((b) => b.name === j))) p.push("a job never runs");
      if (a.length && a[a.length - 1].end > MAX_GANTT_UNITS) p.push("chart too long to build by tapping");
      break;
    }
    case "interleave": {
      const steps = q.threads.reduce((n, t) => n + t.code.length, 0);
      if (q.threads.length < 2 || q.threads.length > 3) p.push("interleave needs 2–3 threads");
      if (new Set(q.threads.map((t) => t.name)).size !== q.threads.length) p.push("duplicate thread names");
      if (q.threads.some((t) => t.code.length === 0)) p.push("a thread has no steps");
      if (steps > MAX_INTERLEAVE_STEPS) p.push("too many steps to tap");
      if (!(q.goal.v in q.init)) p.push("goal variable has no starting value");
      if (q.answer.length !== steps || interleaveResult(q, q.answer) !== q.goal.value) p.push("answer schedule doesn't reach the goal");
      break;
    }
    case "banker": {
      const n = q.state.allocation.length;
      const m = q.resources.length;
      if (n < 3 || n > MAX_BANKER_PROCESSES) p.push(`banker needs 3–${MAX_BANKER_PROCESSES} processes`);
      if (m < 2 || m > 4) p.push("banker needs 2–4 resource types");
      if (new Set(q.resources).size !== m) p.push("duplicate resource names");
      const rows = [q.state.available, ...q.state.allocation, ...q.state.max];
      if (q.state.max.length !== n || rows.some((r) => r.length !== m || r.some((x) => !Number.isInteger(x) || x < 0))) p.push("banker vectors must be whole numbers, one per resource");
      else if (q.state.max.some((mx, i) => mx.some((x, j) => x < q.state.allocation[i][j]))) p.push("a process holds more than its max");
      else if (!isSafeSequence(q.state, q.answer)) p.push("answer isn't a safe sequence");
      break;
    }
    case "cycle": {
      const ids = q.nodes.map((n) => n.id);
      if (q.nodes.length < 3 || q.nodes.length > 8) p.push("cycle needs 3–8 nodes");
      if (new Set(ids).size !== ids.length) p.push("duplicate node ids");
      if (q.nodes.some((n) => !/^[PR]\d+$/.test(n.id))) p.push("node ids must look like P1 or R2");
      if (q.edges.some(([a, b]) => !ids.includes(a) || !ids.includes(b) || a[0] === b[0])) p.push("edges must join a process and a resource");
      else if (q.answer.length ? !isCycleNodes(q.edges, q.answer) : findCycle(q.edges) !== null) p.push("answer doesn't match the graph's cycle");
      break;
    }
    case "translate":
      if (q.pageSize < 2 || (q.pageSize & (q.pageSize - 1)) !== 0) p.push("page size must be a power of two");
      else if (q.table.length < 3 || q.table.length > 8) p.push("translate needs 3–8 page-table entries");
      else if (!Number.isInteger(q.logical) || q.logical < 0 || q.logical >= q.table.length * q.pageSize) p.push("logical address outside the table");
      else if (q.answer !== Math.floor(q.logical / q.pageSize)) p.push("answer isn't the address's page number");
      if (q.table.some((f) => f !== null && (!Number.isInteger(f) || f < 0))) p.push("frames must be whole numbers or null");
      break;
    case "victim": {
      if (!Number.isInteger(q.frameCount) || q.frameCount < 2 || q.frameCount > 5) p.push("victim needs 2–5 frames");
      else if (q.at < 1 || q.at >= q.refs.length) p.push("fault index outside the reference string");
      else {
        const { frames, victimFrame } = victimSetup(q);
        if (victimFrame === null) p.push("no page is evicted at that reference");
        else if (victimFrame !== q.answer) p.push("answer isn't the policy's victim frame");
        if (q.policy === "opt" && victimFrame !== null) {
          const future = q.refs.slice(q.at + 1);
          const dist = (frames as number[]).map((pg) => (future.indexOf(pg) < 0 ? Infinity : future.indexOf(pg)));
          if (dist.filter((d) => d === Math.max(...dist)).length > 1) p.push("Optimal's victim is a tie");
        }
      }
      break;
    }
    default:
      if (q.options.length !== 4) p.push("mcq needs 4 options");
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) p.push("answer out of range");
      if (new Set(q.options).size !== q.options.length) p.push("duplicate options");
  }
  return p;
}

/** Builds a question from a seed. The question's id is `${id}#${seed}`. */
export interface Generator {
  id: string;
  /** what the problem practises, e.g. "FCFS waiting time" */
  topic: string;
  make(seed: number): Question;
}
