"use client";
import Link from "next/link";
import { Fragment, useState, useSyncExternalStore } from "react";
import { AnswerPanel, type Reveal } from "@/components/battle/AnswerPanel";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { TypeBadge } from "@/components/ui/kit";
import { GYMS } from "@/content/gyms";
import { lessonsOf, type Lesson } from "@/content/lessons";
import { isEvolved, starterById } from "@/content/starters";
import { sfx } from "@/game/audio/synth";
import { gymFlow } from "@/game/world/progress";
import { answerText, grade, kindOf, type Response } from "@/game/engine/question";
import { BOSSES, partnerArt } from "@/game/sprites/index";
import { PLATFORM } from "@/game/sprites/scenery";
import { saveLessonDone, useSave } from "@/lib/save";
import { GymFlowStrip } from "@/components/world/GymFlow";
import { Diagram } from "./Diagrams";

const noSub = () => () => {};
const BAR_BUTTON = "gb-box flex min-h-12 flex-1 items-center justify-center px-2 text-center font-pixel text-[10px] leading-4 !text-[var(--box-ink)] disabled:opacity-40";

/** Paragraph text with `code` spans. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 ? (
          <code key={i} className="rounded-[2px] bg-[#2a2440] px-1 font-mono text-[14px] text-[#ffe27a]">
            {part}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * A gym's lecture hall: the list of concept lessons, and a reader that pages
 * through one (the partner narrates, diagrams illustrate) and ends with a
 * quick check. Passing the check marks the lesson as done in the save.
 */
export function LessonHall({ gymId }: { gymId: string }) {
  const gym = GYMS.find((g) => g.id === gymId)!;
  const lessons = lessonsOf(gym.id);
  const save = useSave();
  const hydrated = useSyncExternalStore(
    noSub,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState<number | null>(null);

  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;
  const starter = save.starter ? starterById(save.starter) : null;
  const art = starter ? partnerArt(starter, isEvolved(starter, save.evolved)) : BOSSES[gym.id];
  const done = lessons.filter((l) => save.lessons.includes(l.id)).length;
  const flow = gymFlow(gym, save);

  if (open !== null) {
    const lesson = lessons[open];
    return (
      <LessonReader
        key={lesson.id}
        lesson={lesson}
        n={open + 1}
        total={lessons.length}
        narrator={art.front}
        narratorName={starter ? (isEvolved(starter, save.evolved) ? starter.evolution.name : starter.name) : gym.boss.name}
        onExit={() => setOpen(null)}
        onNext={open + 1 < lessons.length ? () => setOpen(open + 1) : null}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-3 bg-[#100e24] px-4 pb-8 pt-3">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <span className="font-pixel text-[10px] text-[#5eead4] pixel-shadow" data-testid="lesson-count">
          {done}/{lessons.length} DONE
        </span>
      </header>
      <section className="gb-box flex items-center gap-3 p-3">
        <PixelSprite sprite={BOSSES[gym.id].front} scale={1} className="h-auto w-16 shrink-0" still />
        <div className="min-w-0">
          <p className="font-pixel text-[8px] leading-4 text-[#8a3a3a]">GYM {gym.n} · LECTURE HALL</p>
          <h1 className="font-pixel text-[12px] leading-5">{gym.chapter.toUpperCase()}</h1>
          <p className="text-[14px] leading-snug">Read each lesson and pass its quick check{gym.trainer ? `, then beat ${gym.trainer.name} twice` : ""} before you face {gym.boss.name}.</p>
        </div>
        <span className="ml-auto hidden sm:block">
          <TypeBadge type={gym.type} />
        </span>
      </section>
      <ol className="flex flex-col gap-2" data-testid="lesson-list">
        {lessons.map((l, i) => {
          const passed = save.lessons.includes(l.id);
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  sfx.click();
                  setOpen(i);
                }}
                className="gb-box flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#fff6dc]"
                data-testid={`lesson-${l.id}`}
                data-done={passed}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border-[3px] border-[var(--box-edge)] font-pixel text-[10px] ${passed ? "bg-[#7ad66b]" : "bg-white"}`}
                >
                  {passed ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-pixel text-[10px] leading-4">{l.title.toUpperCase()}</span>
                  <span className="block text-[13px] text-[#5a5078]">
                    {l.pages.length} pages · quick check
                    {passed ? " passed" : ""}
                  </span>
                </span>
                <span className="font-pixel text-[10px] text-[#e04848]">▶</span>
              </button>
            </li>
          );
        })}
      </ol>
      <GymFlowStrip flow={flow} className="justify-center" />
      <Link
        href={flow.bossReady ? `/gym/${gym.id}` : `/gym/${gym.id}/trainer`}
        onClick={() => sfx.click()}
        className={`${BAR_BUTTON} flex-none !bg-[#ffe27a]`}
        data-testid="hall-boss"
      >
        {flow.bossReady ? `${flow.state === "cleared" ? "▶ REMATCH" : "▶ CHALLENGE"} ${gym.boss.name.toUpperCase()}` : `▶ TRAINER ${gym.trainer!.name.toUpperCase()} ${flow.trainers.won + 1}/${flow.trainers.total}`}
      </Link>
    </main>
  );
}

function LessonReader({
  lesson,
  n,
  total,
  narrator,
  narratorName,
  onExit,
  onNext,
}: {
  lesson: Lesson;
  n: number;
  total: number;
  narrator: Parameters<typeof PixelSprite>[0]["sprite"];
  narratorName: string;
  onExit: () => void;
  onNext: (() => void) | null;
}) {
  const [page, setPage] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [attempt, setAttempt] = useState(0);
  const checking = page === lesson.pages.length;
  const p = lesson.pages[page];
  const go = (to: number) => {
    sfx.click();
    setPage(to);
    window.scrollTo({ top: 0 });
  };

  function submit(r: Response) {
    const correct = grade(lesson.check, r);
    setReveal({ response: r, correct });
    if (correct) {
      sfx.levelUp();
      saveLessonDone(lesson.id);
    } else sfx.click();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-3 bg-[#100e24] px-4 pb-28 pt-3" data-testid="lesson-reader">
      <header className="flex items-center justify-between gap-2">
        <button type="button" onClick={onExit} className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow" data-testid="lesson-exit">
          ◀ LESSONS
        </button>
        <span className="truncate font-pixel text-[9px] text-[#b9b0d8]">
          LESSON {n}/{total}
        </span>
      </header>
      <h1 className="font-pixel text-[12px] leading-5 text-[#f4f1ff] pixel-shadow">{lesson.title.toUpperCase()}</h1>
      {/* page pips */}
      <div className="flex gap-1.5" aria-label={checking ? "Quick check" : `Page ${page + 1} of ${lesson.pages.length}`}>
        {[...lesson.pages, null].map((_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-[1px] border-2 border-[#1a1430] ${i < page ? "bg-[#5eead4]" : i === page ? "bg-[#ffe27a]" : "bg-[#3c3466]"}`} />
        ))}
      </div>

      {!checking ? (
        <>
          <div className="overflow-hidden rounded-[6px] border-4 border-[#1f1a3a] shadow-[0_4px_0_#0006]">
            {p.diagram ? (
              <Diagram id={p.diagram} />
            ) : (
              <div className="relative flex h-44 items-end justify-center bg-[linear-gradient(#1b1446_0_20%,#251a5c_20%_40%,#33226e_40%_60%,#4a2c7e_60%_80%,#6b3a86_80%)]">
                <div className="absolute inset-x-0 bottom-0 h-10 bg-[#1d1640]" />
                <PixelSprite sprite={PLATFORM} scale={3} className="absolute bottom-2" still />
                <PixelSprite sprite={narrator} scale={2} className="relative bottom-6" data-testid="narrator" />
              </div>
            )}
          </div>
          <article className="msg-box flex flex-col gap-2 px-4 py-3" data-testid="lesson-page">
            <div className="flex items-center gap-2">
              {p.diagram && <PixelSprite sprite={narrator} scale={1} className="h-auto w-10 shrink-0" />}
              <h2 className="font-pixel text-[10px] leading-4 text-[#8a3a3a]">{p.heading.toUpperCase()}</h2>
            </div>
            {p.body.map((t, i) => (
              <p key={i} className="text-[16px] leading-[1.4]">
                <Rich text={t} />
              </p>
            ))}
          </article>
        </>
      ) : (
        <section className="flex flex-col gap-3" data-testid="lesson-check">
          <div className="msg-box flex items-start gap-3 px-4 py-3">
            <PixelSprite sprite={narrator} scale={1} className="h-auto w-12 shrink-0" />
            <div className="min-w-0">
              <p className="font-pixel text-[9px] leading-4 text-[#8a3a3a]">QUICK CHECK · {narratorName.toUpperCase()} ASKS</p>
              <p className="text-[16px] leading-[1.35]">{lesson.check.prompt}</p>
            </div>
          </div>
          <AnswerPanel key={attempt} q={lesson.check} disabled={reveal !== null} reveal={reveal} onSubmit={submit} />
          {reveal && (
            <div className={`msg-box px-4 py-3 text-[15px] leading-[1.35]`} data-testid="check-result" data-correct={reveal.correct}>
              <p className={`font-pixel text-[10px] leading-5 ${reveal.correct ? "text-[#2f8a3a]" : "text-[#c83a4a]"}`}>{reveal.correct ? "✓ LESSON COMPLETE!" : "✗ NOT QUITE"}</p>
              {!reveal.correct && kindOf(lesson.check) !== "mcq" && <p>{kindOf(lesson.check) === "order" ? "Here is the right order." : `The answer: ${answerText(lesson.check)}.`}</p>}
              <p>{lesson.check.explain}</p>
            </div>
          )}
        </section>
      )}

      {/* fixed bottom action bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t-4 border-[#1f1a3a] bg-[#100e24]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          {!checking ? (
            <>
              <button type="button" className={BAR_BUTTON} disabled={page === 0} onClick={() => go(page - 1)} data-testid="lesson-prev">
                ◀ BACK
              </button>
              <button type="button" className={`${BAR_BUTTON} !bg-[#ffe27a]`} onClick={() => go(page + 1)} data-testid="lesson-next">
                {page + 1 === lesson.pages.length ? "QUICK CHECK ▶" : "NEXT ▶"}
              </button>
            </>
          ) : reveal?.correct ? (
            <>
              <button type="button" className={BAR_BUTTON} onClick={onExit} data-testid="lesson-done">
                ◀ LESSONS
              </button>
              {onNext && (
                <button type="button" className={`${BAR_BUTTON} !bg-[#ffe27a]`} onClick={onNext} data-testid="lesson-onward">
                  NEXT LESSON ▶
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className={BAR_BUTTON}
                onClick={() => {
                  setReveal(null);
                  setAttempt((a) => a + 1);
                  go(0);
                }}
                data-testid="lesson-reread"
              >
                ◀ REREAD
              </button>
              {reveal && (
                <button
                  type="button"
                  className={`${BAR_BUTTON} !bg-[#ffe27a]`}
                  onClick={() => {
                    sfx.click();
                    setReveal(null);
                    setAttempt((a) => a + 1);
                  }}
                  data-testid="lesson-retry"
                >
                  TRY AGAIN ▶
                </button>
              )}
            </>
          )}
        </div>
      </nav>
    </main>
  );
}
