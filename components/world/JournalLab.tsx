"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  BLOCK_NAME, JOURNAL_MODES, MODE_LABEL, OUTCOME_LABEL, crashAfter, gradeJournalProblem, makeJournalProblem, writeSequence,
  type Block, type JournalMode, type Outcome, type Version,
} from "@/game/sim/journalLab";

const OUTCOMES: Outcome[] = ["old", "new", "stale-data"];
const SHORT: Record<Outcome, string> = { old: "OLD FILE", new: "FULLY NEW", "stale-data": "NEW METADATA, STALE DATA" };

function Cell({ b, v }: { b: Block; v: Version }) {
  return (
    <div className={`flex-1 border-2 border-[#1a1430] p-1.5 text-center ${v === "new" ? "bg-[#bfeaa0]" : "bg-[#e6efc8]"}`}>
      <p className="font-pixel text-[9px]">{b}</p>
      <p className="text-[11px]">{BLOCK_NAME[b]}</p>
      <p className="font-pixel text-[8px]">{v.toUpperCase()}</p>
    </div>
  );
}

function Sandbox() {
  const [mode, setMode] = useState<JournalMode>("ordered");
  const [after, setAfter] = useState(2);
  const seq = useMemo(() => writeSequence(mode), [mode]);
  const r = crashAfter(mode, after);
  const bad = r.outcome === "stale-data";
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Setup">
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Journal mode">
          {JOURNAL_MODES.map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} data-testid={`jm-${m}`} onClick={() => { setMode(m); setAfter(Math.min(after, writeSequence(m).length)); }} className={`gb-box min-h-11 px-0.5 font-pixel text-[8px] leading-3 ${mode === m ? "bg-[#ffe27a]!" : ""}`}>
              {MODE_LABEL[m].toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-[#5a5078]">
          One append dirties a data block D, the inode I and the bitmap B. Each line is one atomic block write. Tap a gap to crash there.
        </p>
      </section>
      <section className="gb-box flex flex-col gap-1 p-3" aria-label="Write sequence">
        <button data-testid="jc-0" aria-pressed={after === 0} onClick={() => setAfter(0)} className={`min-h-11 border-2 border-dashed px-2 text-left font-pixel text-[8px] ${after === 0 ? "border-[#e8566b] bg-[#ffd0dd]" : "border-transparent text-[#5a5078]"}`}>
          {after === 0 ? "✖ CRASH HERE" : "· crash before any write"}
        </button>
        {seq.map((s, i) => (
          <div key={i} className="flex flex-col gap-1">
            <p className={`flex items-center gap-2 text-[13px] ${i < after ? "" : "text-[#8a82a8]"}`}>
              <span className="w-5 text-right font-pixel text-[8px]">{i + 1}</span>
              <span>{i < after ? "✔" : "○"} {s.label}</span>
            </p>
            <button data-testid={`jc-${i + 1}`} aria-pressed={after === i + 1} onClick={() => setAfter(i + 1)} className={`min-h-11 border-2 border-dashed px-2 text-left font-pixel text-[8px] ${after === i + 1 ? "border-[#e8566b] bg-[#ffd0dd]" : "border-transparent text-[#5a5078]"}`}>
              {after === i + 1 ? "✖ CRASH HERE" : "· crash after this write"}
            </button>
          </div>
        ))}
      </section>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="After the crash">
        <p className="font-pixel text-[8px]">DISK RIGHT AFTER THE CRASH</p>
        <div className="flex gap-1.5" data-testid="j-before">{(["D", "I", "B"] as const).map((b) => <Cell key={b} b={b} v={r.beforeRecovery[b]} />)}</div>
        <p className="text-[13px]" data-testid="j-replay">
          {r.replays ? "Recovery finds a committed transaction and replays it." : "Recovery finds no committed, unfreed transaction: nothing to replay (an uncommitted one is discarded)."}
        </p>
        <p className="font-pixel text-[8px]">AFTER RECOVERY</p>
        <div className="flex gap-1.5">{(["D", "I", "B"] as const).map((b) => <Cell key={b} b={b} v={r.afterRecovery[b]} />)}</div>
        <p className={`font-pixel text-[9px] leading-4 ${bad ? "text-[#a02040]" : "text-[#2f7a2a]"}`} data-testid="j-outcome">
          {OUTCOME_LABEL[r.outcome].toUpperCase()}
        </p>
        {r.orphanData ? <p className="text-[12px] text-[#5a5078]">Block D reached disk but nothing points to it: harmless, the space is reused later.</p> : null}
        {bad ? <p className="text-[12px] text-[#a02040]">Writeback mode does not order data against the commit, so the file can grow over a block holding another file&apos;s old bytes.</p> : null}
      </section>
    </>
  );
}

function Predict() {
  const [seed, setSeed] = useState(1);
  const p = useMemo(() => makeJournalProblem(seed), [seed]);
  const [pick, setPick] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ right: 0, tries: 0 });
  const seq = writeSequence(p.mode);
  const ok = pick !== null && gradeJournalProblem(p, pick);
  const choose = (o: Outcome) => {
    if (pick) return;
    setPick(o);
    setScore((x) => ({ right: x.right + (gradeJournalProblem(p, o) ? 1 : 0), tries: x.tries + 1 }));
    sfx.click();
  };
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Predict the state">
      <p className="font-pixel text-[9px] leading-4">CRASH #{seed} · SCORE {score.right}/{score.tries}</p>
      <p className="text-[14px] leading-snug">{MODE_LABEL[p.mode]} appending to a file. Writes in order:</p>
      <ol className="flex flex-col gap-0.5 text-[12px]">
        {seq.map((s, i) => <li key={i}>{i + 1}. {s.label}</li>)}
      </ol>
      <p className="text-[15px]" data-testid="j-q">
        The power fails {p.after === 0 ? <b>before the first write</b> : <>right after write <b>{p.after}</b></>}. After reboot and recovery, what state is the file in?
      </p>
      <div className="flex flex-col gap-1.5" role="group" aria-label="Outcome">
        {OUTCOMES.map((o) => (
          <button key={o} data-testid={`jp-${o}`} disabled={pick !== null} onClick={() => choose(o)} className={`gb-box min-h-11 px-2 text-left font-pixel text-[8px] leading-3 disabled:opacity-100 ${pick === o ? (ok ? "bg-[#bfeaa0]!" : "bg-[#ffd0dd]!") : ""}`}>
            {SHORT[o]}
          </button>
        ))}
      </div>
      {pick ? (
        <>
          <p className={`font-pixel text-[9px] leading-4 ${ok ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="j-result">{ok ? "CORRECT" : `NOT QUITE: ${SHORT[p.answer]}`}</p>
          <p className="text-[13px]">{crashAfter(p.mode, p.after).replays ? "The commit record was on disk, so recovery replays the journaled blocks." : "No committed transaction was pending, so recovery changes nothing."} {OUTCOME_LABEL[p.answer]}.</p>
          <button data-testid="j-next" onClick={() => { setSeed((s) => s + 1); setPick(null); }} className="gb-box min-h-11 font-pixel text-[9px]">NEXT</button>
        </>
      ) : null}
    </section>
  );
}

/** The journaling lab: crash a file append at any write and see what recovery gives, per journal mode. */
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
