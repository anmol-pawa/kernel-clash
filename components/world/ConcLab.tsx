"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import { CONC_CHALLENGES, checkConcChallenge, runConc, verdict } from "@/game/sim/concLab";

const KEY = "kc-conc-lab-v1";
const FREE = CONC_CHALLENGES[0]!.solution;

function Result({ src }: { src: string }) {
  const r = useMemo(() => runConc(src), [src]);
  if (!r.ok) return <p className="border-2 border-[#1a1430] bg-[#f0a0a0] p-2 text-[13px]" data-testid="cl-verdict">Line {r.error.line}: {r.error.message}</p>;
  const v = verdict(r.report);
  return (
    <>
      <p className="border-2 border-[#1a1430] p-2 text-[13px]" style={{ background: v.safe ? "#9fe0b0" : "#f0a0a0" }} data-testid="cl-verdict">{v.text}</p>
      {v.trace.length ? (
        <>
          <p className="font-pixel text-[8px]">SHORTEST BAD SCHEDULE ({v.trace.length} STEPS)</p>
          <ol className="list-decimal bg-[#1a1430] py-2 pl-8 pr-2 text-[12px] leading-5 text-[#e6efc8]" data-testid="cl-trace">
            {v.trace.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </>
      ) : null}
    </>
  );
}

/** Edit small thread programs, explore every interleaving, and fix the broken ones. */
export function ConcLab() {
  const [idx, setIdx] = useState(0); // -1 = sandbox
  const [srcs, setSrcs] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[]>([]);
  const [checked, setChecked] = useState<{ passed: boolean; message: string } | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        if (Array.isArray(raw)) setDone(raw.filter((x): x is string => typeof x === "string"));
      } catch { /* storage unavailable */ }
    });
  }, []);
  const c = idx >= 0 ? CONC_CHALLENGES[idx]! : null;
  const id = c ? c.id : "free";
  const src = srcs[id] ?? (c ? c.starter : FREE);
  const check = () => {
    if (!c) return;
    const res = checkConcChallenge(c, src);
    setChecked(res);
    if (res.passed && !done.includes(c.id)) {
      const next = [...done, c.id];
      setDone(next);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
    sfx.click();
  };
  const go = (i: number) => { setIdx(i); setChecked(null); };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">◀ MAP</Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">THREAD LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-5 gap-1" role="tablist" aria-label="Challenges">
        {CONC_CHALLENGES.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={i === idx} data-testid={`clc-${i}`} onClick={() => go(i)} className={`gb-box min-h-11 font-pixel text-[8px] ${i === idx ? "bg-[#ffe27a]!" : ""}`}>{i + 1}{done.includes(x.id) ? "★" : ""}</button>
        ))}
        <button role="tab" aria-selected={idx < 0} data-testid="clc-free" onClick={() => go(-1)} className={`gb-box min-h-11 font-pixel text-[8px] ${idx < 0 ? "bg-[#ffe27a]!" : ""}`}>FREE</button>
      </div>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Editor">
        <p className="font-pixel text-[9px] leading-4">{c ? c.title.toUpperCase() : "SANDBOX"}</p>
        <p className="text-[14px]">{c ? c.goal : "Write any program (up to 3 threads). The explorer tries every interleaving."}</p>
        <textarea
          data-testid="cl-src"
          aria-label="Program"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={src}
          onChange={(e) => { setSrcs({ ...srcs, [id]: e.target.value }); setChecked(null); }}
          rows={Math.min(22, src.split("\n").length + 1)}
          className="w-full resize-y bg-[#1a1430] p-2 font-mono text-[16px] leading-5 text-[#e6efc8]"
        />
        <div className="flex gap-2">
          {c ? <button data-testid="cl-check" onClick={check} className="gb-box min-h-11 flex-1 font-pixel text-[9px]">CHECK</button> : null}
          <button data-testid="cl-reset" onClick={() => { const n = { ...srcs }; delete n[id]; setSrcs(n); setChecked(null); }} className="gb-box min-h-11 flex-1 font-pixel text-[9px]">RESET</button>
        </div>
        {checked ? (
          <p className={`font-pixel text-[9px] leading-4 ${checked.passed ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="cl-result">
            {checked.passed ? "CLEARED ★" : "NOT YET."}
          </p>
        ) : null}
        {c ? <p className="text-[12px] text-[#4a3f6a]">Hint: {c.hint}</p> : null}
        <Result src={src} />
      </section>
      <details className="gb-box p-3 text-[12px]">
        <summary className="min-h-11 cursor-pointer font-pixel text-[9px] leading-[44px]">LANGUAGE</summary>
        <pre className="overflow-x-auto leading-4">{`var n = 0        shared integer
sem s = 1       semaphore
spurious        sleepers may wake alone
thread A        start a thread
lock m / unlock m
wait s / post s
cwait c m / signal c / broadcast c
r = x           load   (r, r1, r2...)
x = r           store
x = 5 / x += 1 / r += 1
if a == b goto L / goto L
assert a == b
L:              label`}</pre>
      </details>
    </main>
  );
}
