"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AnswerPanel, type Reveal } from "@/components/battle/AnswerPanel";
import { END_BUTTON } from "@/components/battle/Battle";
import { GanttChart } from "@/components/lesson/Gantt";
import { dailyQuestions } from "@/content/daily";
import { sfx } from "@/game/audio/synth";
import { DAILY_LENGTH, dayKey, liveStreak, playedToday } from "@/game/engine/daily";
import { correctionText, grade, type Question, type Response } from "@/game/engine/question";
import { recordAnswer, saveDaily, useSave } from "@/lib/save";

const noSub = () => () => {};

/** One question, no clock. Remount per question (`key`). */
function Ask({ q, index, onDone }: { q: Question; index: number; onDone: (correct: boolean) => void }) {
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const submit = (r: Response) => {
    if (reveal) return;
    const correct = grade(q, r);
    setReveal({ response: r, correct });
    if (correct) sfx.hit();
    else sfx.error();
  };
  const correct = reveal?.correct ?? false;
  const correction = reveal && !correct ? correctionText(q) : null;
  const chart = reveal ? (q.gantt ?? q.chart) : q.chart;
  return (
    <>
      <p className="font-pixel text-[9px]">
        Q{index + 1}/{DAILY_LENGTH}
      </p>
      <p className="msg-box p-3 text-[16px] leading-snug" data-testid="daily-prompt">
        {q.prompt}
      </p>
      {chart && (
        <div className="border-4 border-[#1a1430] bg-[#2a2440] p-1">
          <GanttChart gantt={chart} />
        </div>
      )}
      <AnswerPanel q={q} disabled={reveal !== null} reveal={reveal} onSubmit={submit} />
      {reveal && (
        <div className="msg-box flex flex-col gap-2 p-3 text-[15px] leading-snug" data-testid="daily-feedback" data-correct={correct}>
          <p className="font-pixel text-[10px]" style={{ color: correct ? "#2f7a2a" : "#b8283e" }}>
            {correct ? "CORRECT" : "NOT QUITE"}
          </p>
          {correction && <p>{correction}</p>}
          <p>{q.explain}</p>
        </div>
      )}
      {reveal && (
        <button type="button" onClick={() => { sfx.click(); onDone(correct); }} className={`${END_BUTTON} flex-none bg-[#ffe27a]! py-3`} data-testid="daily-next">
          {index + 1 === DAILY_LENGTH ? "FINISH ▶" : "NEXT QUESTION ▶"}
        </button>
      )}
    </>
  );
}

function Streak({ streak, best }: { streak: number; best: number }) {
  return (
    <div className="gb-box flex items-center justify-between gap-2 p-3 font-pixel text-[10px]" data-testid="daily-streak" data-streak={streak}>
      <span>STREAK {streak} {streak === 1 ? "DAY" : "DAYS"}</span>
      <span className="text-[#5a5078]">BEST {best}</span>
    </div>
  );
}

/** Today's five questions, the same for everyone that day; finishing one keeps the streak going. */
export function Daily() {
  const save = useSave();
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  const [today] = useState(() => dayKey(new Date()));
  const [started, setStarted] = useState(false);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const questions = useMemo(() => dailyQuestions(today), [today]);
  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;

  const d = save.daily;
  const played = playedToday(d, today);
  const done = (correct: boolean) => {
    recordAnswer(questions[n].id.split("#")[0], correct);
    const total = score + (correct ? 1 : 0);
    setScore(total);
    if (n + 1 === DAILY_LENGTH) saveDaily(today, total);
    else setN(n + 1);
  };
  const finishedNow = started && n + 1 === DAILY_LENGTH && played;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">DAILY CHALLENGE</h1>
        <span className="w-12" />
      </header>

      {finishedNow || (played && !started) ? (
        <>
          <div className="gb-box flex flex-col items-center gap-1 p-4 text-center" data-testid="daily-result" data-score={d.score}>
            <p className="font-pixel text-[9px] text-[#5a5078]">{today}</p>
            <p className="font-pixel text-lg text-[#ffe27a]" style={{ textShadow: "2px 2px 0 #1a1430" }}>
              {d.score}/{DAILY_LENGTH} RIGHT
            </p>
            <p className="text-[15px] leading-snug">Done for today. A new set of questions arrives tomorrow, and finishing it keeps your streak alive.</p>
          </div>
          <Streak streak={liveStreak(d, today)} best={d.best} />
          <Link href="/map" className={`${END_BUTTON} flex-none py-3`}>
            MAP
          </Link>
        </>
      ) : !started ? (
        <>
          <p className="msg-box p-3 text-[15px] leading-snug">
            {DAILY_LENGTH} questions picked from across every gym, the same for everyone today. Finish them to keep your streak going; the score doesn&apos;t matter, showing up does.
          </p>
          <Streak streak={liveStreak(d, today)} best={d.best} />
          <button type="button" onClick={() => { sfx.click(); setStarted(true); }} className={`${END_BUTTON} flex-none bg-[#ffe27a]! py-3`} data-testid="daily-start">
            ▶ START TODAY&apos;S CHALLENGE
          </button>
        </>
      ) : (
        <Ask key={questions[n].id} q={questions[n]} index={n} onDone={done} />
      )}
    </main>
  );
}
