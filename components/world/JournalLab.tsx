"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  JMODES, JMODE_LABEL, OUTCOMES, OUTCOME_LABEL, OUTCOME_WHY, crashAt, crashMatrix, gradeJournalProblem, journalSteps,
  makeJournalProblem, type Blk, type JMode, type Outcome,
} from "@/game/sim/journalLab";

const OUT_COLOR: Record<Outcome, string> = {
  old: "#9fc7e8", complete: "#8fd68f", "stale-data": "#f2c76e", inconsistent: "#ef8a9a", leak: "#c9a8ec",
};

function ModePicker({ mode, setMode }: { mode: JMode; setMode: (m: JMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Journaling mode">
      {JMODES.map((m) => (
        <button key={m} role="radio" aria-checked={mode === m} data-testid={`jm-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 px-0.5 font-pixel text-[8px] leading-3 ${mode === m ? "bg-[#ffe27a]!" : ""}`}>
          {JMODE_LABEL[m].toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function BlockChips({ home, label }: { home: Record<Blk, boolean>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]" aria-label={label}>
      <span className="w-14 font-pixel text-[7px] text-[#5a5078]">{label}</span>
      {(["D", "I", "B"] as const).map((b) => (
        <span key={b} className="border-2 border-[#1a1430] px-1.5 py-0.5 font-mono" style={{ background: home[b] ? "#8fd68f" : "#e6e0d0" }}>
          {b} {home[b] ? "new" : "old"}
        </span>
      ))}
    </div>
  );
}

function Sandbox() {
  const [mode, setMode] = useState<JMode>("ordered");
  const steps = journalSteps(mode);
  const [crash, setCrash] = useState(2);
  const k = Math.min(crash, steps.length);
  const res = useMemo(() => crashAt(mode, k), [mode, k]);
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Setup">
        <ModePicker mode={mode} setMode={setMode} />
        <p className="text-[12px] text-[#5a5078]">
          One append touches the new data block D, the inode I and the bitmap B. Each step is a flushed, atomic block write. Tap a step to crash <i>after</i> it.
        </p>
        <ol className="flex flex-col gap-1" data-testid="j-steps">
          <li>
            <button data-testid="jc-0" onClick={() => setCrash(0)} className={`gb-box min-h-11 w-full px-2 text-left text-[13px] ${k === 0 ? "bg-[#ffd0dd]!" : ""}`}>
              {k === 0 ? "💥 " : ""}crash before anything is written
            </button>
          </li>
          {steps.map((s, i) => (
            <li key={i}>
              <button data-testid={`jc-${i + 1}`} onClick={() => setCrash(i + 1)} className={`gb-box min-h-11 w-full px-2 text-left text-[13px] ${k === i + 1 ? "bg-[#ffd0dd]!" : ""} ${i + 1 > k ? "opacity-60" : ""}`}>
                <span className="font-pixel text-[8px] text-[#5a5078]">{i + 1}.</span> {s.label}
                {k === i + 1 ? "  💥 crash" : ""}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="After recovery">
        <BlockChips home={res.before.home} label="AT CRASH" />
        <p className="text-[13px]" data-testid="j-journal">
          Journal: {!res.before.journal.begun ? "empty" : `${res.before.journal.blocks.join(", ") || "no blocks"} logged, ${res.before.journal.committed ? "committed" : "no commit block"}${res.before.journal.retired ? ", retired" : ""}`}.
        </p>
        <p className="text-[13px]" data-testid="j-recovery">
          Recovery: {mode === "none" ? "there is no journal; only fsck could repair this." : res.replayed.length ? `replays ${res.replayed.join(", ")} from the journal.` : res.discarded ? "finds a transaction without a commit block and discards it." : "nothing to replay."}
        </p>
        <BlockChips home={res.after.home} label="AFTER" />
        <p className="border-2 border-[#1a1430] p-2 font-pixel text-[9px] leading-4" style={{ background: OUT_COLOR[res.outcome] }} data-testid="j-outcome">
          {OUTCOME_LABEL[res.outcome].toUpperCase()}
        </p>
        <p className="text-[13px] leading-snug">{OUTCOME_WHY[res.outcome]}</p>
      </section>
      <section className="gb-box flex flex-col gap-1.5 p-3" aria-label="Every crash point">
        <p className="font-pixel text-[8px]">EVERY CRASH POINT, ALL MODES</p>
        {JMODES.map((m) => (
          <div key={m} className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 font-pixel text-[6px] leading-3">{JMODE_LABEL[m].toUpperCase()}</span>
            <div className="flex min-w-0 flex-1 gap-0.5">
              {crashMatrix(m).map((r, i) => (
                <i key={i} title={`after step ${i}: ${OUTCOME_LABEL[r.outcome]}`} className="h-5 min-w-0 flex-1 border border-[#1a1430]" style={{ background: OUT_COLOR[r.outcome] }} />
              ))}
            </div>
          </div>
        ))}
        <ul className="grid grid-cols-1 gap-0.5 text-[12px] sm:grid-cols-2">
          {OUTCOMES.map((o) => (
            <li key={o} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 border border-[#1a1430]" style={{ background: OUT_COLOR[o] }} />{OUTCOME_LABEL[o]}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Predict() {
  const [seed, setSeed] = useState(1);
  const p = useMemo(() => makeJournalProblem(seed), [seed]);
  const [pick, setPick] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ right: 0, tries: 0 });
  const steps = journalSteps(p.mode);
  const done = pick !== null;
  const check = (o: Outcome) => {
    if (done) return;
    setPick(o);
    setScore((x) => ({ right: x.right + (gradeJournalProblem(p, o) ? 1 : 0), tries: x.tries + 1 }));
    sfx.click();
  };
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Predict the state">
      <p className="font-pixel text-[9px] leading-4">CRASH #{seed} · SCORE {score.right}/{score.tries}</p>
      <p className="text-[14px] leading-snug">
        Mode: <b>{JMODE_LABEL[p.mode]}</b>. Write order:
      </p>
      <ol className="flex flex-col gap-0.5 text-[13px]" data-testid="jp-steps">
        {steps.map((s, i) => (
          <li key={i} className={i < p.crashAfter ? "" : "text-[#8a82a0]"}>{i + 1}. {s.label}{i + 1 === p.crashAfter ? "  ← last write before the crash" : ""}</li>
        ))}
      </ol>
      <p className="text-[15px]" data-testid="jp-q">
        {p.crashAfter === 0 ? "The machine loses power before the first write." : `The machine loses power right after step ${p.crashAfter}.`} After reboot and recovery, what is the state?
      </p>
      <div className="flex flex-col gap-1.5" role="group" aria-label="Outcome">
        {OUTCOMES.map((o) => (
          <button key={o} data-testid={`jo-${o}`} disabled={done} onClick={() => check(o)} className={`gb-box min-h-11 px-2 text-left text-[13px] ${done && o === p.answer ? "bg-[#c9f0c0]!" : ""} ${done && o === pick && o !== p.answer ? "bg-[#ffd0dd]!" : ""}`}>
            {OUTCOME_LABEL[o]}
          </button>
        ))}
      </div>
      {done ? (
        <>
          <p className={`font-pixel text-[9px] leading-4 ${pick === p.answer ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="jp-result">
            {pick === p.answer ? "CORRECT" : "NOT QUITE"}
          </p>
          <p className="text-[13px] leading-snug">{OUTCOME_LABEL[p.answer]}. {OUTCOME_WHY[p.answer]}</p>
          <button data-testid="jp-next" onClick={() => { setSeed((s) => s + 1); setPick(null); }} className="gb-box min-h-11 font-pixel text-[9px]">NEXT</button>
        </>
      ) : null}
    </section>
  );
}

/** The journaling lab: crash a write sequence at any point and predict the state after recovery. */
export function JournalLab() {
  const [mode, setMode] = useState<"sandbox" | "predict">("sandbox");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">◀ MAP</Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">JOURNALING LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(["sandbox", "predict"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} data-testid={`jtab-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 font-pixel text-[8px] ${mode === m ? "bg-[#ffe27a]!" : ""}`}>
            {m === "sandbox" ? "CRASH SANDBOX" : "PREDICT"}
          </button>
        ))}
      </div>
      {mode === "sandbox" ? <Sandbox /> : <Predict />}
    </main>
  );
}
