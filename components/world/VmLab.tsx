"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  CHALLENGE_START, DEFAULT_VM, OUTCOME_LABEL, VM_CHALLENGES, access, gradeTraceProblem, gradeVmChallenge, makeTraceProblem, newVm, vaBits, vaLimit,
  type Outcome, type VmConfig, type VmPolicy, type VmState, type VmStep,
} from "@/game/sim/vmLab";

const STORE = "kernel-clash:vm-lab";
const OUTCOMES: Outcome[] = ["tlb-hit", "walk-hit", "fault-free", "fault-evict"];
const hex = (n: number) => n.toString(16).toUpperCase();

function Num({ value, onChange, label, min, max, disabled }: { value: number; onChange: (n: number) => void; label: string; min: number; max: number; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-2 font-pixel text-[8px]">
      {label.toUpperCase()}
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.trunc(Number(e.target.value)) || min)))}
        className="min-h-11 w-20 border-2 border-[#1a1430] bg-white px-2 text-center text-base disabled:opacity-40"
      />
    </label>
  );
}

function Knobs({ cfg, onChange, fixed = {} }: { cfg: VmConfig; onChange: (c: VmConfig) => void; fixed?: Partial<VmConfig> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Num label="frames" value={cfg.frames} min={1} max={8} disabled={fixed.frames !== undefined} onChange={(n) => onChange({ ...cfg, frames: n })} />
      <Num label="tlb entries" value={cfg.tlbSize} min={0} max={8} disabled={fixed.tlbSize !== undefined} onChange={(n) => onChange({ ...cfg, tlbSize: n })} />
      <label className="flex items-center justify-between gap-2 font-pixel text-[8px]">
        REPLACEMENT
        <select
          aria-label="replacement policy"
          value={cfg.policy}
          disabled={fixed.policy !== undefined}
          onChange={(e) => onChange({ ...cfg, policy: e.target.value as VmPolicy })}
          className="min-h-11 w-28 border-2 border-[#1a1430] bg-white px-2 text-base disabled:opacity-40"
        >
          <option value="fifo">FIFO</option>
          <option value="lru">LRU</option>
        </select>
      </label>
    </div>
  );
}

/** TLB, page table and frames, drawn as small tables. */
function Machine({ s }: { s: VmState }) {
  const rows = Object.entries(s.tables).flatMap(([l1, t]) => Object.entries(t).map(([l2, f]) => ({ vpn: Number(l1) * 2 ** s.cfg.l2Bits + Number(l2), l1, l2, f })));
  rows.sort((a, b) => a.vpn - b.vpn);
  return (
    <div className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3" data-testid="machine">
      <div>
        <p className="font-pixel text-[8px]">TLB</p>
        {s.tlb.length === 0 ? <p className="text-[#5a5078]">empty</p> : s.tlb.map((e) => <p key={e.vpn}>page {e.vpn} → frame {e.frame}</p>)}
      </div>
      <div>
        <p className="font-pixel text-[8px]">PAGE TABLE</p>
        {rows.length === 0 ? <p className="text-[#5a5078]">empty</p> : rows.map((r) => <p key={r.vpn}>[{r.l1}][{r.l2}] page {r.vpn} → frame {r.f}</p>)}
      </div>
      <div>
        <p className="font-pixel text-[8px]">FRAMES</p>
        {s.frames.map((f, i) => (
          <p key={i}>
            {i}: {f ? `page ${f.vpn}` : "free"}
          </p>
        ))}
      </div>
    </div>
  );
}

function StepLog({ step }: { step: VmStep | null }) {
  if (!step) return <p className="text-[13px] text-[#5a5078]">Enter an address and press ACCESS.</p>;
  return (
    <div className="flex flex-col gap-1" data-testid="steplog">
      <p className="font-pixel text-[9px] leading-4" data-testid="outcome">
        {OUTCOME_LABEL[step.outcome].toUpperCase()} · PA 0x{hex(step.pa)} · {step.memRefs} REF{step.memRefs > 1 ? "S" : ""}
      </p>
      <ol className="list-decimal pl-5 text-[13px] leading-snug">
        {step.log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </div>
  );
}

function Sandbox() {
  const [cfg, setCfg] = useState<VmConfig>(DEFAULT_VM);
  const [state, setState] = useState<VmState>(() => newVm(DEFAULT_VM));
  const [step, setStep] = useState<VmStep | null>(null);
  const [text, setText] = useState("0300");
  const digits = Math.ceil(vaBits(cfg) / 4);
  const reset = (c: VmConfig) => {
    setCfg(c);
    setState(newVm(c));
    setStep(null);
  };
  const go = (va: number) => {
    const r = access(state, va % vaLimit(cfg));
    setState(r.state);
    setStep(r.step);
    sfx.click();
  };
  const parsed = parseInt(text, 16);
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Setup">
        <p className="font-pixel text-[9px]">
          {vaBits(cfg)}-BIT VA = {cfg.l1Bits} OUTER + {cfg.l2Bits} INNER + {cfg.offsetBits} OFFSET
        </p>
        <Knobs cfg={cfg} onChange={reset} />
        <label className="flex items-center justify-between gap-2 font-pixel text-[8px]">
          ADDRESS (HEX)
          <input
            aria-label="virtual address in hex"
            data-testid="va-input"
            value={text}
            maxLength={digits}
            onChange={(e) => setText(e.target.value.replace(/[^0-9a-fA-F]/g, ""))}
            className="min-h-11 w-28 border-2 border-[#1a1430] bg-white px-2 text-center font-mono text-base uppercase"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button data-testid="access" disabled={Number.isNaN(parsed)} onClick={() => go(parsed)} className="gb-box min-h-11 font-pixel text-[9px] disabled:opacity-40">
            ACCESS
          </button>
          <button onClick={() => go(Math.floor(Math.random() * vaLimit(cfg)))} className="gb-box min-h-11 font-pixel text-[9px]">
            RANDOM
          </button>
        </div>
        <button onClick={() => reset(cfg)} className="gb-box min-h-11 font-pixel text-[9px]">
          RESET MACHINE
        </button>
      </section>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Last access">
        <StepLog step={step} />
      </section>
      <section className="gb-box p-3" aria-label="Machine state">
        <Machine s={state} />
      </section>
    </>
  );
}

function Trace() {
  const [seed, setSeed] = useState(1);
  const p = useMemo(() => makeTraceProblem(seed), [seed]);
  const [pick, setPick] = useState<Outcome | null>(null);
  const [paText, setPaText] = useState("");
  const [shown, setShown] = useState(false);
  const [score, setScore] = useState({ right: 0, tries: 0 });
  const pa = parseInt(paText, 16);
  const result = shown && pick ? gradeTraceProblem(p, pick, Number.isNaN(pa) ? -1 : pa) : null;
  const hexDigits = Math.ceil(vaBits(p.cfg) / 4);
  const next = () => {
    setSeed((s) => s + 1);
    setPick(null);
    setPaText("");
    setShown(false);
  };
  const check = () => {
    if (!pick) return;
    const g = gradeTraceProblem(p, pick, Number.isNaN(pa) ? -1 : pa);
    setShown(true);
    setScore((x) => ({ right: x.right + (g.outcomeOk && g.paOk ? 1 : 0), tries: x.tries + 1 }));
    sfx.click();
  };
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Trace this access">
      <p className="font-pixel text-[9px] leading-4">
        TRACE #{seed} · SCORE {score.right}/{score.tries}
      </p>
      <p className="text-[14px] leading-snug">
        {p.cfg.l1Bits}+{p.cfg.l2Bits} bit page table, {2 ** p.cfg.offsetBits}-byte pages, {p.cfg.frames} frames, {p.cfg.tlbSize}-entry TLB, {p.cfg.policy.toUpperCase()} replacement everywhere. Starting cold, these addresses were accessed in order:
      </p>
      <p className="break-words font-mono text-[14px]" data-testid="warmup">
        {p.warmup.map((v) => v.toString(16).toUpperCase().padStart(hexDigits, "0")).join("  ")}
      </p>
      <p className="text-[15px]" data-testid="target">
        Next: <b className="font-mono">{p.target.toString(16).toUpperCase().padStart(hexDigits, "0")}</b>. What happens, and what is the physical address?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {OUTCOMES.map((o) => (
          <button key={o} aria-pressed={pick === o} data-testid={`pick-${o}`} disabled={shown} onClick={() => setPick(o)} className={`gb-box min-h-11 px-1 font-pixel text-[8px] leading-4 ${pick === o ? "bg-[#ffe27a]" : ""}`}>
            {OUTCOME_LABEL[o].toUpperCase()}
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-2 font-pixel text-[8px]">
        PHYSICAL ADDRESS (HEX)
        <input aria-label="physical address in hex" data-testid="pa-input" value={paText} disabled={shown} onChange={(e) => setPaText(e.target.value.replace(/[^0-9a-fA-F]/g, ""))} className="min-h-11 w-28 border-2 border-[#1a1430] bg-white px-2 text-center font-mono text-base uppercase" />
      </label>
      {result ? (
        <div className="flex flex-col gap-1">
          <p className={`font-pixel text-[9px] leading-4 ${result.outcomeOk && result.paOk ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="trace-result">
            {result.outcomeOk && result.paOk ? "CORRECT" : `NOT QUITE: ${OUTCOME_LABEL[p.outcome].toUpperCase()}, PA 0x${hex(p.pa)}`}
          </p>
          {p.victim !== null ? <p className="text-[13px]">The evicted page was {p.victim}.</p> : null}
        </div>
      ) : null}
      <button data-testid="trace-go" disabled={!shown && !pick} onClick={shown ? next : check} className="gb-box min-h-11 font-pixel text-[9px] disabled:opacity-40">
        {shown ? "NEXT TRACE" : "CHECK"}
      </button>
    </section>
  );
}

function Challenges() {
  const [ci, setCi] = useState(0);
  const [cfg, setCfg] = useState<VmConfig>(CHALLENGE_START);
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const v = JSON.parse(localStorage.getItem(STORE) ?? "[]");
        if (Array.isArray(v)) setDone(v.filter((x): x is string => typeof x === "string"));
      } catch {
        /* storage may be unavailable */
      }
    });
  }, []);
  const ch = VM_CHALLENGES[ci];
  const cur = { ...cfg, ...ch.fixed };
  const g = gradeVmChallenge(ch, cur);
  const solved = done.includes(ch.id);
  const claim = () => {
    if (!g.ok || solved) return;
    sfx.click();
    const next = [...done, ch.id];
    setDone(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <>
      <div className="grid grid-cols-5 gap-1.5" aria-label="Challenges">
        {VM_CHALLENGES.map((c, i) => (
          <button key={c.id} data-testid={`vch-${i}`} aria-pressed={ci === i} onClick={() => setCi(i)} className={`gb-box min-h-11 font-pixel text-[9px] ${ci === i ? "bg-[#ffe27a]" : ""}`}>
            {done.includes(c.id) ? "★" : i + 1}
          </button>
        ))}
      </div>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Challenge">
        <p className="font-pixel text-[9px] leading-4">
          {ci + 1}. {ch.title.toUpperCase()}
          {solved ? " ★" : ""}
        </p>
        <p className="text-[15px] leading-snug" data-testid="vgoal">{ch.goal}</p>
        <p className="text-[13px] leading-snug text-[#5a5078]">Hint: {ch.hint}</p>
        <p className="font-pixel text-[7px] leading-4 text-[#5a5078]">PAGES: {ch.pages.join(" ")}</p>
        <Knobs cfg={cur} fixed={ch.fixed} onChange={setCfg} />
        <p className="text-[13px]" data-testid="vstats">
          {g.stats.faults} faults · {g.stats.evictions} evictions · TLB hits {g.stats.tlbHits}/{ch.pages.length} · {g.stats.memRefs} memory refs
        </p>
        <p className={`font-pixel text-[9px] ${g.ok ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="vgrade">
          {g.ok ? "GOAL MET" : "GOAL NOT MET YET"}
        </p>
        <button data-testid="vclaim" onClick={claim} disabled={!g.ok} className="gb-box min-h-11 font-pixel text-[9px] disabled:opacity-40">
          {solved ? "CLEARED ★" : "CLAIM STAR"}
        </button>
      </section>
    </>
  );
}

/** The address-translation lab: step addresses through TLB and page tables, trace generated accesses, clear challenges. */
export function VmLab() {
  const [mode, setMode] = useState<"sandbox" | "trace" | "challenge">("sandbox");
  const labels = { sandbox: "SANDBOX", trace: "TRACE", challenge: "CHALLENGES" } as const;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">ADDRESS LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} data-testid={`vtab-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 font-pixel text-[8px] ${mode === m ? "bg-[#ffe27a]" : ""}`}>
            {labels[m]}
          </button>
        ))}
      </div>
      {mode === "sandbox" ? <Sandbox /> : mode === "trace" ? <Trace /> : <Challenges />}
    </main>
  );
}
