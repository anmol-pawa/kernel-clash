"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnswerPanel, type Reveal } from "@/components/battle/AnswerPanel";
import { END_BUTTON } from "@/components/battle/Battle";
import { GanttChart } from "@/components/lesson/Gantt";
import { INTERVIEW_LENGTH, mockInterview, topicOf } from "@/content/interviewTopics";
import { sfx } from "@/game/audio/synth";
import { limitFor, pointsFor, scorecard, type Answered, type Verdict } from "@/game/engine/interview";
import { correctionText, grade, type Question, type Response } from "@/game/engine/question";
import { recordAnswer, saveInterview, useSave } from "@/lib/save";

const noSub = () => () => {};
const VERDICT_TINT: Record<Verdict, string> = { "Strong hire": "#7ad66b", Hire: "#5eead4", Maybe: "#ffd34e", "Not yet": "#e8566b" };
const VERDICT_LINE: Record<Verdict, string> = {
  "Strong hire": "You'd get the offer. Clear, correct and quick.",
  Hire: "A solid interview. Tighten the topics below and it's a strong one.",
  Maybe: "Some good answers, some gaps. Revisit the lessons for your weakest topic.",
  "Not yet": "Not yet. The gym lessons cover every one of these, so try again after a review.",
};

/** Seconds left on the clock, counting down from `limit` since `start`; stops at 0. */
function useCountdown(running: boolean, limit: number, start: number, onZero: () => void): number {
  const [now, setNow] = useState(start);
  const zero = useRef(onZero);
  useEffect(() => {
    zero.current = onZero;
  });
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - start >= limit * 1000) {
        clearInterval(id);
        zero.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, limit, start]);
  return Math.max(0, limit - (now - start) / 1000);
}

/** One question under the clock. Remount per question (`key`). */
function Ask({ q, index, total, onDone }: { q: Question; index: number; total: number; onDone: (a: Answered, correct: boolean) => void }) {
  const limit = limitFor(q);
  const [start] = useState(() => Date.now());
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [took, setTook] = useState(0);
  const answered = reveal !== null || timedOut;
  const left = useCountdown(!answered, limit, start, () => {
    setTook(limit);
    setTimedOut(true);
    sfx.error();
  });

  const submit = (r: Response) => {
    if (answered) return;
    const correct = grade(q, r);
    const seconds = Math.min(limit, (Date.now() - start) / 1000);
    setTook(seconds);
    setReveal({ response: r, correct });
    if (correct) sfx.hit();
    else sfx.error();
  };
  const next = () => {
    sfx.click();
    const correct = reveal?.correct ?? false;
    onDone({ id: q.id, topic: topicOf(q), correct, seconds: took, limit }, correct);
  };

  const pct = (left / limit) * 100;
  const color = pct > 50 ? "#7ad66b" : pct > 20 ? "#ffd34e" : "#e8566b";
  const correct = reveal?.correct ?? false;
  const correction = answered && !correct ? correctionText(q) : null;
  const chart = answered ? (q.gantt ?? q.chart) : q.chart;

  return (
    <>
      <div className="flex flex-col gap-1" data-testid="timer" data-left={Math.ceil(left)}>
        <div className="flex items-baseline justify-between font-pixel text-[9px]">
          <span>
            Q{index + 1}/{total} · {topicOf(q).toUpperCase()}
          </span>
          <span className="tabular-nums" style={{ color }}>
            {Math.ceil(left)}s
          </span>
        </div>
        <div className="h-3 border-2 border-[#1a1430] bg-[#100e24]" role="progressbar" aria-label="Time left" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.ceil(left)}>
          <div className="h-full" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>

      <p className="msg-box p-3 text-[16px] leading-snug" data-testid="interview-prompt">
        {q.prompt}
      </p>
      {chart && (
        <div className="border-4 border-[#1a1430] bg-[#2a2440] p-1">
          <GanttChart gantt={chart} />
        </div>
      )}

      <AnswerPanel q={q} disabled={answered} reveal={reveal} onSubmit={submit} />

      {answered && (
        <div className="msg-box flex flex-col gap-2 p-3 text-[15px] leading-snug" data-testid="interview-feedback" data-correct={correct}>
          <p className="font-pixel text-[10px]" style={{ color: correct ? "#2f7a2a" : "#b8283e" }}>
            {correct ? "CORRECT" : timedOut ? "TIME'S UP" : "NOT QUITE"}
          </p>
          {correction && <p>{correction}</p>}
          <p>{q.explain}</p>
        </div>
      )}
      {answered && (
        <button type="button" onClick={next} className={`${END_BUTTON} flex-none bg-[#ffe27a]! py-3`} data-testid="interview-next">
          {index + 1 === total ? "SEE SCORECARD ▶" : "NEXT QUESTION ▶"}
        </button>
      )}
    </>
  );
}

function Card({ answers, isBest, onAgain }: { answers: Answered[]; isBest: boolean; onAgain: () => void }) {
  const sc = scorecard(answers);
  return (
    <div className="flex flex-col gap-3 land:grid land:grid-cols-2 land:items-start" data-testid="scorecard" data-verdict={sc.verdict}>
      <div className="gb-box flex flex-col items-center gap-1 p-4 text-center land:col-start-1 land:row-start-1">
        <p className="font-pixel text-[9px] text-[#5a5078]">VERDICT</p>
        <p className="font-pixel text-lg" style={{ color: VERDICT_TINT[sc.verdict], textShadow: "2px 2px 0 #1a1430" }} data-testid="verdict">
          {sc.verdict.toUpperCase()}
        </p>
        <p className="text-[15px] leading-snug">{VERDICT_LINE[sc.verdict]}</p>
        <p className="font-pixel text-[10px]" data-testid="points">
          {sc.points}/{sc.max} PTS · {sc.correct}/{sc.total} RIGHT
        </p>
        {isBest && <p className="font-pixel text-[9px] text-[#b8283e]">NEW BEST!</p>}
      </div>

      <ul className="gb-box flex flex-col gap-2 p-3 land:col-start-2 land:row-span-2 land:row-start-1" aria-label="Topics">
        {sc.topics.map((t) => (
          <li key={t.topic} className="flex flex-col gap-1" data-testid="topic-row" data-correct={t.correct} data-total={t.total}>
            <div className="flex justify-between font-pixel text-[9px]">
              <span>{t.topic.toUpperCase()}</span>
              <span className="tabular-nums">
                {t.correct}/{t.total}
              </span>
            </div>
            <div className="h-3 border-2 border-[#1a1430] bg-[#100e24]">
              <div className="h-full" style={{ width: `${(t.correct / t.total) * 100}%`, background: t.correct === t.total ? "#7ad66b" : t.correct === 0 ? "#e8566b" : "#ffd34e" }} />
            </div>
          </li>
        ))}
        {sc.weakest && <p className="text-[14px]">Weakest topic: {sc.weakest}. Its gym lessons are the place to start.</p>}
      </ul>

      <ol className="gb-box flex flex-col gap-1 p-3 land:col-start-1 land:row-start-2" aria-label="Answers">
        {answers.map((a, i) => (
          <li key={a.id} className="flex items-center justify-between gap-2 font-pixel text-[8px]">
            <span>
              Q{i + 1} {a.topic.toUpperCase()}
            </span>
            <span style={{ color: a.correct ? "#2f7a2a" : "#b8283e" }}>
              {a.correct ? `+${pointsFor(a)}` : a.seconds >= a.limit ? "TIME" : "MISS"}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex gap-2.5 land:col-span-2 land:row-start-3">
        <button type="button" onClick={onAgain} className={END_BUTTON} data-testid="interview-again">
          ▶ AGAIN
        </button>
        <Link href="/map" className={END_BUTTON}>
          MAP
        </Link>
      </div>
    </div>
  );
}

/** The mock interview: ten timed questions across four topics, then a scorecard. */
export function Interview() {
  const save = useSave();
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  const [round, setRound] = useState<{ seed: number } | null>(null);
  const [n, setN] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [isBest, setIsBest] = useState(false);
  const questions = useMemo(() => (round ? mockInterview(round.seed) : []), [round]);
  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;

  const begin = () => {
    sfx.click();
    setAnswers([]);
    setN(0);
    setIsBest(false);
    setRound({ seed: (Date.now() ^ (save.interviewBest?.points ?? 0)) >>> 0 });
  };
  const done = (a: Answered, correct: boolean) => {
    recordAnswer(a.id, correct);
    const all = [...answers, a];
    setAnswers(all);
    if (all.length === questions.length) {
      const sc = scorecard(all);
      setIsBest(saveInterview({ points: sc.points, max: sc.max, correct: sc.correct, total: sc.total }));
    } else setN(n + 1);
  };
  const finished = round !== null && answers.length === questions.length;
  const best = save.interviewBest;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">MOCK INTERVIEW</h1>
        <span className="w-12" />
      </header>

      {round === null ? (
        <>
          <p className="msg-box p-3 text-[15px] leading-snug">
            The Kernelord interviews you: {INTERVIEW_LENGTH} questions across processes, scheduling and sync, memory, and I/O and Linux. Each has a time limit, and quick right answers earn bonus points. No hints, no retries.
          </p>
          <div className="gb-box flex flex-col gap-1 p-3 font-pixel text-[10px] leading-5" data-testid="interview-best">
            <p>BEST SCORE</p>
            <p className="text-[#5a5078]">{best ? `${best.points}/${best.max} PTS · ${best.correct}/${best.total} RIGHT` : "NONE YET"}</p>
          </div>
          <button type="button" onClick={begin} className={`${END_BUTTON} flex-none bg-[#ffe27a]! py-3`} data-testid="interview-start">
            ▶ START INTERVIEW
          </button>
        </>
      ) : finished ? (
        <Card answers={answers} isBest={isBest} onAgain={begin} />
      ) : (
        <Ask key={questions[n].id} q={questions[n]} index={n} total={questions.length} onDone={done} />
      )}
    </main>
  );
}
