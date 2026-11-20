"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  BLOCKS, JMODES, JMODE_LABEL, J_CHALLENGES, OUTCOME_LABEL, allCrashes, checkJChallenge, crash, gradeJProblem, makeJProblem, writeSequence,
  type Blk, type Fresh, type JMode, type Outcome,
} from "@/game/sim/journalLab";

const OUT_COLOR: Record<Outcome, string> = { old: "#e6efc8", new: "#9fe0b0", garbage: "#f0a0a0", corrupt: "#f08080", leak: "#f5d07a" };
const BLK_LABEL: Record<Blk, string> = { data: "DATA", inode: "INODE", bitmap: "BITMAP" };

function Cells({ title, f, testid }: { title: string; f: Fresh; testid?: string }) {
  return (
    <div className="flex flex-col gap-1" data-testid={testid}>
      <p className="font-pixel text-[7px] text-[#5a5078]">{title}</p>
      <div className="grid grid-cols-3 gap-1">
        {BLOCKS.map((b) => (
          <span key={b} className="border-2 border-[#1a1430] py-1 text-center font-pixel text-[7px]" style={{ background: f[b] ? "#9fe0b0" : "#e8e2d0" }}>
            {BLK_LABEL[b]}<br />{f[b] ? "NEW" : "old"}
          </span>
        ))}
      </div>
    </div>
  );
}

function ModeTabs({ mode, setMode }: { mode: JMode; setMode: (m: JMode) => void }) {
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

function Sandbox() {
  const [mode, setMode] = useState<JMode>("ordered");
  const [k, setK] = useState(2);
  const steps = writeSequence(mode);
  const kk = Math.min(k, steps.length);
  const r = crash(mode, kk);
  const rows = useMemo(() => allCrashes(mode), [mode]);
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Setup">
        <ModeTabs mode={mode} setMode={(m) => { setMode(m); setK(Math.min(k, writeSequence(m).length)); }} />
        <p className="text-[12px] text-[#5a5078]">One operation: append a block to a file. It writes DATA, the INODE (size and pointer) and the allocation BITMAP. Tap a step to crash right after it.</p>
        <ol className="flex flex-col gap-1" data-testid="j-steps">
          <li>
            <button onClick={() => setK(0)} data-testid="j-crash-0" className={`gb-box min-h-11 w-full px-2 text-left text-[13px] ${kk === 0 ? "bg-[#f0a0a0]!" : ""}`}>💥 crash before any write</button>
          </li>
          {steps.map((s, i) => (
            <li key={i}>
              <button onClick={() => { setK(i + 1); sfx.click(); }} data-testid={`j-crash-${i + 1}`} className={`gb-box min-h-11 w-full px-2 text-left text-[13px] ${kk === i + 1 ? "bg-[#f0a0a0]!" : ""}`}>
                <span className="font-pixel text-[8px] text-[#5a5078]">{i + 1}. </span>{s.label}{kk === i + 1 ? "  💥" : ""}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Recovery">
        <div className="grid grid-cols-2 gap-2">
          <Cells title="HOME BLOCKS AT CRASH" f={r.onDisk} />
          <Cells title="IN THE JOURNAL" f={r.journaled} />
        </div>
        <p className="text-[13px]" data-testid="j-recovery">
          {r.replayed ? "Commit record found: recovery replays the journal." : r.journaled.inode || r.journaled.data ? "No commit record: recovery discards the transaction." : "Nothing journaled."}
        </p>
        <Cells title="HOME BLOCKS AFTER RECOVERY" f={r.after} />
        <p className="border-2 border-[#1a1430] p-2 font-pixel text-[8px] leading-4" style={{ background: OUT_COLOR[r.outcome] }} data-testid="j-outcome">
          {OUTCOME_LABEL[r.outcome].toUpperCase()}
        </p>
      </section>
      <section className="gb-box overflow-x-auto p-3" aria-label="Every crash point">
        <p className="font-pixel text-[8px]">EVERY CRASH POINT, {JMODE_LABEL[mode].toUpperCase()}</p>
        <table className="mt-1 w-full text-left text-[13px]" data-testid="j-table">
          <thead><tr className="text-[#5a5078]"><th>crash after</th><th>result</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.crashAfter} className={x.crashAfter === kk ? "font-bold" : ""}>
                <td>{x.crashAfter === 0 ? "nothing" : `step ${x.crashAfter}`}</td>
                <td><span className="inline-block h-3 w-3 border border-[#1a1430] align-middle" style={{ background: OUT_COLOR[x.outcome] }} /> {OUTCOME_LABEL[x.outcome]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Predict() {
  const [seed, setSeed] = useState(1);
  const p = useMemo(() => makeJProblem(seed), [seed]);
  const [picked, setPicked] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ right: 0, tries: 0 });
  const steps = writeSequence(p.mode);
  const pick = (o: Outcome) => {
    if (picked) return;
    setPicked(o);
    const ok = gradeJProblem(p, o);
    setScore((x) => ({ right: x.right + (ok ? 1 : 0), tries: x.tries + 1 }));
    sfx.click();
  };
  const right = picked !== null && gradeJProblem(p, picked);
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Predict the state">
      <p className="font-pixel text-[9px] leading-4">PREDICT #{seed} · SCORE {score.right}/{score.tries}</p>
      <p className="text-[14px]">Mode: <b>{JMODE_LABEL[p.mode]}</b>. Write order:</p>
      <ol className="list-decimal pl-5 text-[13px]">{steps.map((s, i) => <li key={i}>{s.label}</li>)}</ol>
      <p className="text-[15px]" data-testid="j-q">
        The machine loses power {p.crashAfter === 0 ? "before any write" : `right after step ${p.crashAfter}`}. After recovery, what state is the file system in?
      </p>
      <div className="flex flex-col gap-1.5">
        {p.options.map((o) => (
          <button key={o} data-testid={`jp-${o}`} disabled={picked !== null} onClick={() => pick(o)} className={`gb-box min-h-11 px-2 text-left text-[13px] ${picked === o ? (right ? "bg-[#9fe0b0]!" : "bg-[#f0a0a0]!") : ""}`}>
            {OUTCOME_LABEL[o]}
          </button>
        ))}
      </div>
      {picked ? (
        <p className={`font-pixel text-[9px] leading-4 ${right ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="j-result">
          {right ? "CORRECT" : `NOT QUITE: ${OUTCOME_LABEL[p.answer].toUpperCase()}`}
        </p>
      ) : null}
      {picked ? <button data-testid="jp-next" onClick={() => { setSeed(seed + 1); setPicked(null); }} className="gb-box min-h-11 font-pixel text-[9px]">NEXT</button> : null}
    </section>
  );
}

const KEY = "kc-journal-lab-v1";

function Challenges() {
  const [mode, setMode] = useState<JMode>("none");
  const [done, setDone] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  useEffect(() => {
    // read after hydration so server and client markup agree
    queueMicrotask(() => {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        if (Array.isArray(raw)) setDone(raw.filter((x): x is string => typeof x === "string"));
      } catch { /* storage unavailable */ }
    });
  }, []);
  const c = J_CHALLENGES[idx]!;
  const submit = () => {
    const ok = checkJChallenge(c, mode);
    setVerdict(ok);
    if (ok && !done.includes(c.id)) {
      const next = [...done, c.id];
      setDone(next);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
    sfx.click();
  };
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Challenges">
      <div className="grid grid-cols-5 gap-1">
        {J_CHALLENGES.map((x, i) => (
          <button key={x.id} data-testid={`jc-${i}`} onClick={() => { setIdx(i); setVerdict(null); }} className={`gb-box min-h-11 font-pixel text-[8px] ${i === idx ? "bg-[#ffe27a]!" : ""}`}>
            {i + 1}{done.includes(x.id) ? "★" : ""}
          </button>
        ))}
      </div>
      <p className="font-pixel text-[9px] leading-4">{c.title.toUpperCase()}</p>
      <p className="text-[14px]">{c.goal}</p>
      <ModeTabs mode={mode} setMode={(m) => { setMode(m); setVerdict(null); }} />
      <button data-testid="jc-submit" onClick={submit} className="gb-box min-h-11 font-pixel text-[9px]">SUBMIT</button>
      {verdict !== null ? (
        <p className={`font-pixel text-[9px] leading-4 ${verdict ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="jc-result">
          {verdict ? "CLEARED ★" : "NOT YET. Crash it at every point in the sandbox and look at the table."}
        </p>
      ) : null}
    </section>
  );
}

/** The journaling lab: crash a file-system append at any point and predict the post-recovery state. */
export function JournalLab() {
  const [tab, setTab] = useState<"sandbox" | "predict" | "challenge">("sandbox");
  const labels = { sandbox: "SANDBOX", predict: "PREDICT", challenge: "CHALLENGES" } as const;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">◀ MAP</Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">JOURNALING LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((m) => (
          <button key={m} role="tab" aria-selected={tab === m} data-testid={`jtab-${m}`} onClick={() => setTab(m)} className={`gb-box min-h-11 font-pixel text-[8px] ${tab === m ? "bg-[#ffe27a]!" : ""}`}>
            {labels[m]}
          </button>
        ))}
      </div>
      {tab === "sandbox" ? <Sandbox /> : tab === "predict" ? <Predict /> : <Challenges />}
    </main>
  );
}
