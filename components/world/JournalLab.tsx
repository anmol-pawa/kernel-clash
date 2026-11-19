"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  JOURNAL_MODES, MODE_LABEL, OUTCOME_LABEL, REACHABLE_OUTCOMES, alwaysSafe, crashTable, gradeJournalProblem, isSafe, makeJournalProblem,
  totalBlockWrites, writeSteps, type DiskState, type JournalMode, type Outcome,
} from "@/game/sim/journalLab";

const OUTCOME_COLOR: Record<Outcome, string> = { old: "#2f7a2a", new: "#2f7a2a", garbage: "#a02040", leak: "#b36b00", inconsistent: "#a02040" };

function Cell({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex h-7 min-w-7 items-center justify-center border-2 border-[#1a1430] px-1 font-pixel text-[8px] ${on ? "bg-[#ffe27a]" : "bg-white text-[#9a90b8]"}`} aria-label={`${label} ${on ? "written" : "not written"}`}>
      {label}
    </span>
  );
}

function DiskView({ s, title }: { s: DiskState; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-pixel text-[7px] text-[#5a5078]">{title}</span>
      <div className="flex flex-wrap items-center gap-1">
        <Cell on={s.data} label="D" />
        <Cell on={s.inode} label="I" />
        <Cell on={s.bitmap} label="B" />
        <span className="mx-1 text-[#5a5078]">|</span>
        <Cell on={s.jBegin && !s.jFreed} label="TxB" />
        <Cell on={s.jData && !s.jFreed} label="jD" />
        <Cell on={s.jInode && !s.jFreed} label="jI" />
        <Cell on={s.jBitmap && !s.jFreed} label="jB" />
        <Cell on={s.jCommit && !s.jFreed} label="TxE" />
      </div>
    </div>
  );
}

function Explore() {
  const [mode, setMode] = useState<JournalMode>("ordered");
  const [crash, setCrash] = useState(2);
  const steps = writeSteps(mode);
  const table = useMemo(() => crashTable(mode), [mode]);
  const row = table[Math.min(crash, steps.length)];
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Setup">
        <p className="text-[13px] text-[#5a5078]">Appending a block to a file writes <b>D</b> (data), <b>I</b> (inode) and <b>B</b> (bitmap). Tap a step to crash right after it.</p>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Journaling mode">
          {JOURNAL_MODES.map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} data-testid={`jm-${m}`} onClick={() => { setMode(m); setCrash(Math.min(crash, writeSteps(m).length)); }} className={`gb-box min-h-11 px-1 font-pixel text-[8px] ${mode === m ? "bg-[#ffe27a]!" : ""}`}>
              {MODE_LABEL[m].toUpperCase()}
            </button>
          ))}
        </div>
        <p className="font-pixel text-[8px] leading-4" data-testid="jr-cost">
          {totalBlockWrites(mode)} BLOCK WRITES PER APPEND · {alwaysSafe(mode) ? "SAFE AT EVERY CRASH POINT" : "UNSAFE AT SOME CRASH POINT"}
        </p>
      </section>
      <section className="gb-box flex flex-col gap-1 p-3" aria-label="Write sequence">
        <p className="font-pixel text-[8px]">WRITE SEQUENCE · CRASH AFTER:</p>
        <ol className="flex flex-col gap-1">
          <li>
            <button data-testid="jc-0" onClick={() => setCrash(0)} className={`gb-box min-h-11 w-full px-2 text-left text-[13px] ${crash === 0 ? "bg-[#ffe27a]!" : ""}`}>0. nothing written yet</button>
          </li>
          {steps.map((s, i) => (
            <li key={i}>
              <button data-testid={`jc-${i + 1}`} onClick={() => { setCrash(i + 1); sfx.click(); }} className={`gb-box min-h-11 w-full px-2 text-left text-[13px] ${crash === i + 1 ? "bg-[#ffe27a]!" : ""}`}>
                {i + 1}. {s.label}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="After the crash">
        <DiskView s={row.crashed} title="ON DISK AT THE CRASH (Tx* = journal area)" />
        <p className="text-[13px]" data-testid="jr-action">
          Recovery: {row.recovery.action === "replay" ? "the transaction is committed, so replay it" : row.recovery.action === "discard" ? "no commit block, so throw the transaction away" : row.recovery.action === "fsck-needed" ? "no journal: nothing to replay, fsck must scan and guess" : "nothing to replay"}.
        </p>
        <DiskView s={row.recovery.state} title="AFTER RECOVERY" />
        <p className="font-pixel text-[9px] leading-4" style={{ color: OUTCOME_COLOR[row.outcome] }} data-testid="jr-outcome">
          {isSafe(row.outcome) ? "OK: " : "BAD: "}{OUTCOME_LABEL[row.outcome]}
        </p>
      </section>
    </>
  );
}

function Predict() {
  const [seed, setSeed] = useState(1);
  const p = useMemo(() => makeJournalProblem(seed), [seed]);
  const [pick, setPick] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ right: 0, tries: 0 });
  const steps = writeSteps(p.mode);
  const choose = (o: Outcome) => {
    if (pick) return;
    setPick(o);
    setScore((x) => ({ right: x.right + (gradeJournalProblem(p, o) ? 1 : 0), tries: x.tries + 1 }));
    sfx.click();
  };
  const next = () => { setSeed((s) => s + 1); setPick(null); };
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Predict the state">
      <p className="font-pixel text-[9px] leading-4">CRASH #{seed} · SCORE {score.right}/{score.tries}</p>
      <p className="text-[14px]">Mode: <b>{MODE_LABEL[p.mode]}</b>. Writes in order:</p>
      <ol className="flex flex-col gap-0.5 text-[13px]" data-testid="jp-steps">
        {steps.map((s, i) => <li key={i} className={i < p.done ? "" : "text-[#9a90b8] line-through"}>{i + 1}. {s.label}</li>)}
      </ol>
      <p className="text-[15px]" data-testid="jp-q">
        {p.done === 0 ? "The power fails before any write lands." : `The power fails right after write ${p.done} (the crossed-out writes never happen).`} After the machine reboots and recovery runs, what state is the file in?
      </p>
      <div className="flex flex-col gap-1.5">
        {REACHABLE_OUTCOMES.map((o) => (
          <button key={o} data-testid={`jp-${o}`} disabled={pick !== null} onClick={() => choose(o)} className={`gb-box min-h-11 px-2 text-left text-[13px] ${pick === o ? "bg-[#ffe27a]!" : ""}`}>
            {OUTCOME_LABEL[o]}
          </button>
        ))}
      </div>
      {pick ? (
        <p className={`font-pixel text-[9px] leading-4 ${gradeJournalProblem(p, pick) ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="jp-result">
          {gradeJournalProblem(p, pick) ? "CORRECT" : `NOT QUITE: ${OUTCOME_LABEL[p.answer].toUpperCase()}`}
        </p>
      ) : null}
      {pick ? <button data-testid="jp-next" onClick={next} className="gb-box min-h-11 font-pixel text-[9px]">NEXT</button> : null}
    </section>
  );
}

/** The journaling lab: crash a file append at any point and see what recovery leaves behind. */
export function JournalLab() {
  const [mode, setMode] = useState<"explore" | "predict">("explore");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">◀ MAP</Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">JOURNALING LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(["explore", "predict"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} data-testid={`jtab-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 font-pixel text-[8px] ${mode === m ? "bg-[#ffe27a]!" : ""}`}>
            {m === "explore" ? "CRASH IT" : "PREDICT"}
          </button>
        ))}
      </div>
      {mode === "explore" ? <Explore /> : <Predict />}
    </main>
  );
}
