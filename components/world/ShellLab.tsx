"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  SHELL_CHALLENGES, checkShellChallenge, fileToPipe, gradeShellProblem, makeShellProblem, outcomeOf, pipeline, redirect, runShell, shellSource,
  type Op, type ProcView,
} from "@/game/sim/shellLab";

const STATE_COLOR = { running: "#9fe0b0", blocked: "#f5d07a", zombie: "#f0a0a0" } as const;

function ProcTable({ procs }: { procs: ProcView[] }) {
  return (
    <div className="flex flex-col gap-1.5" data-testid="sh-procs">
      {procs.map((p) => (
        <div key={p.pid} className="border-2 border-[#1a1430] p-1.5" style={{ background: STATE_COLOR[p.state] }}>
          <p className="font-pixel text-[8px] leading-4">PID {p.pid} · PPID {p.ppid} · {p.state.toUpperCase()} · {p.name}</p>
          <p className="text-[12px]">{p.fds.length ? p.fds.map(([n, l]) => `${n}→${l}`).join("  ") : "no open files"}</p>
        </div>
      ))}
    </div>
  );
}

function Player({ ops }: { ops: Op[] }) {
  const r = useMemo(() => runShell(ops), [ops]);
  const [i, setI] = useState(0);
  const k = Math.min(i, r.steps.length - 1);
  const s = r.steps[k]!;
  return (
    <>
      <pre className="overflow-x-auto bg-[#1a1430] p-2 text-[11px] leading-4 text-[#e6efc8]" data-testid="sh-src">{shellSource(ops)}</pre>
      <div className="flex items-center gap-2">
        <button data-testid="sh-prev" disabled={k === 0} onClick={() => setI(k - 1)} className="gb-box min-h-11 min-w-11 font-pixel text-[10px]">◀</button>
        <p className="flex-1 text-center font-pixel text-[8px]">STEP {k + 1}/{r.steps.length}</p>
        <button data-testid="sh-next" disabled={k >= r.steps.length - 1} onClick={() => { setI(k + 1); sfx.click(); }} className="gb-box min-h-11 min-w-11 font-pixel text-[10px]">▶</button>
      </div>
      <p className="text-[13px]" data-testid="sh-what"><b>pid {s.pid}:</b> {s.what}</p>
      <ProcTable procs={s.procs} />
      <p className="font-pixel text-[8px]">TERMINAL</p>
      <pre className="min-h-8 bg-[#1a1430] p-2 text-[12px] text-[#9fe0b0]" data-testid="sh-tty">{s.tty.join("\n")}</pre>
      {k === r.steps.length - 1 ? (
        <p className="border-2 border-[#1a1430] p-2 font-pixel text-[8px] leading-4" style={{ background: r.hung ? "#f0a0a0" : "#e6efc8" }} data-testid="sh-final">
          {r.hung ? "HUNG: a process waits for input that can never come" : `DONE: ${outcomeOf(r).toUpperCase()}`}
        </p>
      ) : null}
    </>
  );
}

const PRESETS: { id: string; label: string; build: (bug: boolean) => Op[] }[] = [
  { id: "pipe", label: "echo | wc", build: (b) => pipeline("kernel", { closeParent: !b }) },
  { id: "redir", label: "echo > file", build: (b) => redirect("ping", { dup: !b }) },
  { id: "cat", label: "cat < file | wc", build: (b) => fileToPipe({ dup: !b }) },
];

function Sandbox() {
  const [p, setP] = useState(0);
  const [bug, setBug] = useState(false);
  const ops = useMemo(() => PRESETS[p]!.build(bug), [p, bug]);
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Sandbox">
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Program">
        {PRESETS.map((x, i) => (
          <button key={x.id} role="radio" aria-checked={p === i} data-testid={`shp-${x.id}`} onClick={() => setP(i)} className={`gb-box min-h-11 px-0.5 font-pixel text-[8px] leading-3 ${p === i ? "bg-[#ffe27a]!" : ""}`}>{x.label.toUpperCase()}</button>
        ))}
      </div>
      <button data-testid="sh-bug" aria-pressed={bug} onClick={() => setBug(!bug)} className={`gb-box min-h-11 font-pixel text-[8px] ${bug ? "bg-[#f0a0a0]!" : ""}`}>
        {bug ? "BUG ON: plumbing step left out" : "BUG OFF: correct program"}
      </button>
      <Player key={`${p}-${bug}`} ops={ops} />
    </section>
  );
}

function Predict() {
  const [seed, setSeed] = useState(1);
  const q = useMemo(() => makeShellProblem(seed), [seed]);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, tries: 0 });
  const ok = picked !== null && gradeShellProblem(q, picked);
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="What happens">
      <p className="font-pixel text-[9px] leading-4">PUZZLE #{seed} · SCORE {score.right}/{score.tries}</p>
      <pre className="overflow-x-auto bg-[#1a1430] p-2 text-[11px] leading-4 text-[#e6efc8]">{shellSource(q.ops)}</pre>
      <p className="text-[14px]">The shell starts with fd 0, 1, 2 on the terminal. Fresh descriptors take the lowest free number, and the first pipe gets 3 and 4. What happens?</p>
      <div className="flex flex-col gap-1.5">
        {q.options.map((o, i) => (
          <button key={o} data-testid={`shq-${i}`} disabled={picked !== null} onClick={() => { setPicked(o); setScore((x) => ({ right: x.right + (o === q.answer ? 1 : 0), tries: x.tries + 1 })); sfx.click(); }} className={`gb-box min-h-11 px-2 text-left text-[13px] ${picked === o ? (ok ? "bg-[#9fe0b0]!" : "bg-[#f0a0a0]!") : ""}`}>{o}</button>
        ))}
      </div>
      {picked ? <p className="text-[13px]" data-testid="sh-why"><b>{ok ? "Correct. " : `Answer: ${q.answer}. `}</b>{q.why}</p> : null}
      {picked ? <button data-testid="shq-next" onClick={() => { setSeed(seed + 1); setPicked(null); }} className="gb-box min-h-11 font-pixel text-[9px]">NEXT</button> : null}
    </section>
  );
}

const KEY = "kc-shell-lab-v1";

function Fix() {
  const [done, setDone] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        if (Array.isArray(raw)) setDone(raw.filter((x): x is string => typeof x === "string"));
      } catch { /* storage unavailable */ }
    });
  }, []);
  const c = SHELL_CHALLENGES[idx]!;
  const pick = (f: number) => {
    const ok = checkShellChallenge(c, f);
    setVerdict(ok);
    if (ok && !done.includes(c.id)) {
      const next = [...done, c.id];
      setDone(next);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
    sfx.click();
  };
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Fix the shell">
      <div className="grid grid-cols-4 gap-1">
        {SHELL_CHALLENGES.map((x, i) => (
          <button key={x.id} data-testid={`shc-${i}`} onClick={() => { setIdx(i); setVerdict(null); }} className={`gb-box min-h-11 font-pixel text-[8px] ${i === idx ? "bg-[#ffe27a]!" : ""}`}>{i + 1}{done.includes(x.id) ? "★" : ""}</button>
        ))}
      </div>
      <p className="font-pixel text-[9px] leading-4">{c.title.toUpperCase()}</p>
      <p className="text-[14px]">{c.goal}</p>
      <pre className="overflow-x-auto bg-[#1a1430] p-2 text-[11px] leading-4 text-[#e6efc8]">{shellSource(c.buggy)}</pre>
      <div className="flex flex-col gap-1.5">
        {c.fixes.map((f, i) => (
          <button key={f.label} data-testid={`shf-${i}`} onClick={() => pick(i)} className="gb-box min-h-11 px-2 text-left text-[13px]">{f.label}</button>
        ))}
      </div>
      {verdict !== null ? (
        <p className={`font-pixel text-[9px] leading-4 ${verdict ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="shc-result">
          {verdict ? "CLEARED ★" : "NOT YET. Try the sandbox with the bug switched on and step through it."}
        </p>
      ) : null}
    </section>
  );
}

/** The shell and process lab: watch fork/pipe/dup2/exec build a pipeline, process tree and fd tables included. */
export function ShellLab() {
  const [tab, setTab] = useState<"sandbox" | "predict" | "fix">("sandbox");
  const labels = { sandbox: "SANDBOX", predict: "PUZZLES", fix: "FIX IT" } as const;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">◀ MAP</Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">SHELL LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((m) => (
          <button key={m} role="tab" aria-selected={tab === m} data-testid={`shtab-${m}`} onClick={() => setTab(m)} className={`gb-box min-h-11 font-pixel text-[8px] ${tab === m ? "bg-[#ffe27a]!" : ""}`}>{labels[m]}</button>
        ))}
      </div>
      {tab === "sandbox" ? <Sandbox /> : tab === "predict" ? <Predict /> : <Fix />}
    </main>
  );
}
