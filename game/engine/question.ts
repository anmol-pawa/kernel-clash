/**
 * The question engine: every battle turn asks one Question. There are four
 * kinds, all graded by `grade` (pure, no UI):
 *
 *   mcq      pick one of the options
 *   multi    select every correct option (all of them, nothing else)
 *   numeric  type a number (within a tolerance, fractions like 17/3 allowed)
 *   order    put shuffled steps back in order
 *
 * Generated problems come from a `Generator`, which builds a question from a
 * seed, so the same seed always gives the same question and answer.
 */
import type { Slice } from "@/game/sim/scheduling";
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
  move: Move;
}

/** `kind` is optional so the original MCQ data stays valid as-is. */
export interface McqQ extends Base {
  kind?: "mcq";
  options: readonly string[];
  /** index into `options` */
  answer: number;
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

export type Question = McqQ | MultiQ | NumericQ | OrderQ;
export type QuestionKind = "mcq" | "multi" | "numeric" | "order";

export const kindOf = (q: Question): QuestionKind => q.kind ?? "mcq";

export type Response =
  | { kind: "mcq"; choice: number }
  | { kind: "multi"; choices: readonly number[] }
  | { kind: "numeric"; value: string }
  /** step indexes (into `steps`) in the order the player put them */
  | { kind: "order"; order: readonly number[] };

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
    default:
      return q.options[q.answer];
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
