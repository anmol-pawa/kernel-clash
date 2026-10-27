/**
 * The mock interview, as pure functions: which questions to ask, how long
 * each gets, and the scorecard at the end. The screen only runs the clock
 * and collects answers.
 */
import { kindOf, type Question, type QuestionKind } from "./question";
import { rng } from "@/lib/rng";

export const INTERVIEW_TOPICS = ["Processes", "Scheduling and sync", "Memory", "I/O and Linux"] as const;
export type InterviewTopic = (typeof INTERVIEW_TOPICS)[number];

/** Seconds each kind of question is allowed. */
export const TIME_LIMIT: Partial<Record<QuestionKind, number>> = { mcq: 45, multi: 60, numeric: 90, order: 75, bugspot: 90, fill: 90, incident: 150 };
export const DEFAULT_LIMIT = 60;
export const limitFor = (q: Question): number => TIME_LIMIT[kindOf(q)] ?? DEFAULT_LIMIT;

export const POINTS_RIGHT = 10;
export const POINTS_SPEED = 5;

export interface Answered {
  id: string;
  topic: InterviewTopic;
  /** which round of the loop asked it (absent = fundamentals) */
  round?: RoundKind;
  correct: boolean;
  /** seconds taken; a question left to time out is `limit` and wrong */
  seconds: number;
  limit: number;
}

/**
 * `count` questions from `pool`, shuffled by `seed`, taking from the topics
 * in turn so a short interview still covers each of them.
 */
export function buildInterview(pool: readonly Question[], topicOf: (q: Question) => InterviewTopic, seed: number, count: number): Question[] {
  const r = rng(seed);
  const lanes = INTERVIEW_TOPICS.map((t) => r.shuffle(pool.filter((q) => topicOf(q) === t)));
  const out: Question[] = [];
  for (let i = 0; out.length < count && lanes.some((l) => i < l.length); i++) {
    for (const l of lanes) if (i < l.length && out.length < count) out.push(l[i]);
  }
  return r.shuffle(out);
}

/** 10 points for a right answer plus up to 5 for speed (all of it at 0 s, none at the limit). */
export function pointsFor(a: Answered): number {
  if (!a.correct) return 0;
  const left = Math.min(1, Math.max(0, (a.limit - a.seconds) / a.limit));
  return POINTS_RIGHT + Math.round(POINTS_SPEED * left);
}

export type Verdict = "Strong hire" | "Hire" | "Maybe" | "Not yet";

export interface Scorecard {
  points: number;
  max: number;
  correct: number;
  total: number;
  /** right answers over questions asked, per topic that came up */
  topics: { topic: InterviewTopic; correct: number; total: number }[];
  verdict: Verdict;
  /** the weakest topic that came up (fewest right out of asked), if anything was missed */
  weakest: InterviewTopic | null;
}

export function verdictFor(correct: number, total: number): Verdict {
  const f = total === 0 ? 0 : correct / total;
  if (f >= 0.9) return "Strong hire";
  if (f >= 0.7) return "Hire";
  if (f >= 0.5) return "Maybe";
  return "Not yet";
}

export function scorecard(answers: readonly Answered[]): Scorecard {
  const topics = INTERVIEW_TOPICS.map((topic) => {
    const mine = answers.filter((a) => a.topic === topic);
    return { topic, correct: mine.filter((a) => a.correct).length, total: mine.length };
  }).filter((t) => t.total > 0);
  const correct = answers.filter((a) => a.correct).length;
  const missed = topics.filter((t) => t.correct < t.total).sort((a, b) => a.correct / a.total - b.correct / b.total);
  return {
    points: answers.reduce((n, a) => n + pointsFor(a), 0),
    max: answers.length * (POINTS_RIGHT + POINTS_SPEED),
    correct,
    total: answers.length,
    topics,
    verdict: verdictFor(correct, answers.length),
    weakest: missed.length ? missed[0].topic : null,
  };
}

/** The kinds of interview round; the full loop is one short round of each. */
export const ROUND_KINDS = ["fundamentals", "concurrency", "incident", "design"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];
export type RoundId = RoundKind | "full";

export const ROUND_INFO: Record<RoundId, { name: string; blurb: string }> = {
  fundamentals: { name: "Fundamentals", blurb: "Ten timed questions across processes, scheduling and sync, memory, and I/O and Linux." },
  concurrency: { name: "Concurrency coding", blurb: "Four code questions: spot the bug in a snippet, or fill in the missing line." },
  incident: { name: "Debugging incident", blurb: "Two production incidents. Read the tool output, find the bottleneck and the root cause." },
  design: { name: "Design", blurb: "Two \"how would you build it\" designs, each with a follow-up on what breaks without a piece." },
  full: { name: "Full loop", blurb: "One short round of each kind, nine questions, with a combined scorecard and a hire decision." },
};
export const ROUND_IDS = ["fundamentals", "concurrency", "incident", "design", "full"] as const satisfies readonly RoundId[];

/** How many questions each round of a full loop asks. */
export const LOOP_SHAPE: Record<RoundKind, number> = { fundamentals: 4, concurrency: 2, incident: 1, design: 2 };

export type LoopVerdict = "Hire" | "Lean hire" | "No hire";

export interface RoundResult {
  round: RoundKind;
  correct: number;
  total: number;
}

export function roundResults(answers: readonly Answered[]): RoundResult[] {
  return ROUND_KINDS.map((round) => {
    const mine = answers.filter((a) => (a.round ?? "fundamentals") === round);
    return { round, correct: mine.filter((a) => a.correct).length, total: mine.length };
  }).filter((r) => r.total > 0);
}

/**
 * The hiring decision for a loop: Hire needs 75% overall and no round under
 * 50%; Lean hire needs 55% overall and at most one round under 50%.
 */
export function loopVerdict(rounds: readonly RoundResult[]): LoopVerdict {
  const total = rounds.reduce((n, r) => n + r.total, 0);
  const right = rounds.reduce((n, r) => n + r.correct, 0);
  if (total === 0) return "No hire";
  const f = right / total;
  const weak = rounds.filter((r) => r.correct / r.total < 0.5).length;
  if (f >= 0.75 && weak === 0) return "Hire";
  if (f >= 0.55 && weak <= 1) return "Lean hire";
  return "No hire";
}

/** The gym whose lessons teach each topic, for the study plan (`/learn/<gym>`). */
export const TOPIC_GYMS: Record<InterviewTopic, { gym: string; label: string }[]> = {
  Processes: [{ gym: "processes", label: "Processes and threads" }],
  "Scheduling and sync": [
    { gym: "scheduling", label: "CPU scheduling" },
    { gym: "sync", label: "Synchronization" },
    { gym: "deadlocks", label: "Deadlocks" },
  ],
  Memory: [
    { gym: "memory", label: "Memory management" },
    { gym: "virtual", label: "Virtual memory" },
  ],
  "I/O and Linux": [
    { gym: "storage", label: "Storage and I/O" },
    { gym: "basics", label: "OS basics" },
  ],
};

export interface StudyStep {
  topic: InterviewTopic;
  correct: number;
  total: number;
  gyms: { gym: string; label: string }[];
}

/** Topics with misses, worst first, each with the lessons to revisit. */
export function studyPlan(answers: readonly Answered[]): StudyStep[] {
  return scorecard(answers)
    .topics.filter((t) => t.correct < t.total)
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total)
    .map((t) => ({ ...t, gyms: TOPIC_GYMS[t.topic] }));
}
