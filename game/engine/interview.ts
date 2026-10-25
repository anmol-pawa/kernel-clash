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
export const TIME_LIMIT: Partial<Record<QuestionKind, number>> = { mcq: 45, multi: 60, numeric: 90, order: 75, bugspot: 90 };
export const DEFAULT_LIMIT = 60;
export const limitFor = (q: Question): number => TIME_LIMIT[kindOf(q)] ?? DEFAULT_LIMIT;

export const POINTS_RIGHT = 10;
export const POINTS_SPEED = 5;

export interface Answered {
  id: string;
  topic: InterviewTopic;
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
