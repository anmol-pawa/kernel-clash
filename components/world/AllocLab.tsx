"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  ALLOC_CHALLENGES, HEAP_UNITS, STRATEGIES, STRATEGY_LABEL, externalFragmentation, gradeAllocChallenge, runTrace,
  type Op, type OpResult, type Segment, type Snapshot, type Strategy,
} from "@/game/sim/allocLab";

const STORE = "kernel-clash:alloc-lab";
const COLORS: Record<Segment["kind"], string> = { used: "#5b9fe3", free: "#e6efc8", waste: "#e0707f" };

/** The heap as a strip: used blocks, free holes and wasted (rounded-up) space, to scale. */
function Strip({ snap }: { snap: Snapshot }) {
  return (
    <div data-testid="strip" className="flex h-12 w-full overflow-hidden border-2 border-[#1a1430] bg-white" role="img" aria-label="Heap layout">
      {snap.segments.map((g, i) => (
        <div
          key={i}
          title={`${g.kind} ${g.id ?? ""} @${g.addr} size ${g.size}`}
          style={{ width: `${(g.size / HEAP_UNITS) * 100}%`, background: COLORS[g.kind] }}
          className="flex items-center justify-center overflow-hidden border-r border-[#1a1430]/50 font-pixel text-[7px] leading-none text-[#1a1430]"
        >
          {g.kind === "used" && g.size >= 3 ? g.id : g.kind === "free" && g.size >= 6 ? g.size : ""}
        </div>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#5a5078]">
      <span><i className="mr-1 inline-block h-2.5 w-2.5 border border-[#1a1430] align-middle" style={{ background: COLORS.used }} />used</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 border border-[#1a1430] align-middle" style={{ background: COLORS.free }} />free</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 border border-[#1a1430] align-middle" style={{ background: COLORS.waste }} />wasted by rounding</span>
      <span>heap = {HEAP_UNITS} units</span>
    </p>
  );
}

function StrategyPick({ value, onChange }: { value: Strategy; onChange: (s: Strategy) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Allocation strategy">
      {STRATEGIES.map((s) => (
        <button key={s} role="radio" aria-checked={value === s} data-testid={`strat-${s}`} onClick={() => onChange(s)} className={`gb-box min-h-11 px-0.5 font-pixel text-[7px] leading-3 ${value === s ? "bg-[#ffe27a]!" : ""}`}>
          {STRATEGY_LABEL[s].toUpperCase()}
        </button>
      ))}
    </div>
  );
}

const stats = (snap: Snapshot) =>
  `free ${snap.freeUnits} · largest piece ${snap.largestFree} · external frag ${Math.round(externalFragmentation(snap) * 100)}% · internal waste ${snap.internalWaste}`;

function Sandbox() {
  const [strategy, setStrategy] = useState<Strategy>("first");
  const [ops, setOps] = useState<Op[]>([]);
  const [size, setSize] = useState(10);
  const run = useMemo(() => runTrace(strategy, ops), [strategy, ops]);
  const live = useMemo(() => {
    const s = new Set<string>();
    ops.forEach((o, i) => {
      if (o.op === "free") s.delete(o.id);
      else if (run.results[i].ok) s.add(o.id);
    });
    return [...s];
  }, [ops, run]);
  const nextId = () => {
    const used = new Set(ops.map((o) => o.id));
    for (let i = 0; ; i++) {
      const id = i < 26 ? String.fromCharCode(97 + i) : `a${i}`;
      if (!used.has(id)) return id;
    }
  };
  const last: OpResult | undefined = run.results[run.results.length - 1];
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Setup">
        <StrategyPick value={strategy} onChange={setStrategy} />
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center justify-between gap-2 font-pixel text-[8px]">
            SIZE
            <input type="number" inputMode="numeric" aria-label="allocation size" data-testid="size" min={1} max={HEAP_UNITS} value={size} onChange={(e) => setSize(Math.min(HEAP_UNITS, Math.max(1, Math.trunc(Number(e.target.value)) || 1)))} className="min-h-11 w-20 border-2 border-[#1a1430] bg-white px-2 text-center text-base" />
          </label>
          <button data-testid="malloc" onClick={() => { setOps([...ops, { op: "alloc", id: nextId(), size }]); sfx.click(); }} className="gb-box min-h-11 flex-1 font-pixel text-[9px]">
            MALLOC
          </button>
        </div>
        {live.length ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Live blocks">
            {live.map((id) => (
              <button key={id} data-testid={`free-${id}`} onClick={() => { setOps([...ops, { op: "free", id }]); sfx.click(); }} className="gb-box min-h-11 min-w-11 px-2 font-pixel text-[8px]">
                FREE {id}
              </button>
            ))}
          </div>
        ) : null}
        <button onClick={() => setOps([])} className="gb-box min-h-11 font-pixel text-[9px]">
          RESET HEAP
        </button>
      </section>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Heap">
        <Strip snap={run.final} />
        <Legend />
        <p className="text-[13px]" data-testid="stats">{stats(run.final)}</p>
        <p className={`text-[13px] ${last && !last.ok ? "text-[#a02040]" : ""}`} data-testid="last">
          {last ? (last.ok ? `${last.op.op === "alloc" ? `malloc(${last.op.size}) as ${last.op.id} → address ${last.addr}` : `free(${last.op.id})`}` : `FAILED: ${last.why}`) : "Allocate something."}
        </p>
      </section>
      {ops.length ? (
        <section className="gb-box overflow-x-auto p-3" aria-label="Compare strategies">
          <p className="font-pixel text-[8px]">SAME OPERATIONS, EVERY STRATEGY</p>
          <table className="mt-1 w-full text-left text-[13px]" data-testid="compare">
            <thead>
              <tr className="text-[#5a5078]"><th>strategy</th><th>failed</th><th>largest piece</th><th>internal waste</th></tr>
            </thead>
            <tbody>
              {STRATEGIES.map((s) => {
                const r = runTrace(s, ops);
                return (
                  <tr key={s} className={s === strategy ? "font-bold" : ""}>
                    <td>{STRATEGY_LABEL[s]}</td><td>{r.failures}</td><td>{r.final.largestFree}</td><td>{r.final.internalWaste}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}

function Challenges() {
  const [ci, setCi] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>("first");
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
  const ch = ALLOC_CHALLENGES[ci];
  const g = gradeAllocChallenge(ch, strategy);
  const run = runTrace(strategy, ch.ops);
  const failed = run.results.filter((r) => !r.ok);
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
  const fmt = (o: Op) => (o.op === "alloc" ? `${o.id}=${o.size}` : `free ${o.id}`);
  return (
    <>
      <div className="grid grid-cols-6 gap-1.5" aria-label="Challenges">
        {ALLOC_CHALLENGES.map((c, i) => (
          <button key={c.id} data-testid={`ach-${i}`} aria-pressed={ci === i} onClick={() => setCi(i)} className={`gb-box min-h-11 font-pixel text-[9px] ${ci === i ? "bg-[#ffe27a]!" : ""}`}>
            {done.includes(c.id) ? "★" : i + 1}
          </button>
        ))}
      </div>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Challenge">
        <p className="font-pixel text-[9px] leading-4">
          {ci + 1}. {ch.title.toUpperCase()}
          {solved ? " ★" : ""}
        </p>
        <p className="text-[15px] leading-snug" data-testid="agoal">{ch.goal}</p>
        <p className="text-[13px] leading-snug text-[#5a5078]">Hint: {ch.hint}</p>
        <p className="break-words font-mono text-[12px] leading-snug text-[#5a5078]">TRACE: {ch.ops.map(fmt).join(" · ")}</p>
        <StrategyPick value={strategy} onChange={setStrategy} />
        <Strip snap={run.final} />
        <Legend />
        <p className="text-[13px]" data-testid="astats">
          {g.failures} failed request{g.failures === 1 ? "" : "s"} · peak internal waste {g.peakWaste}
          {ch.maxWaste !== undefined ? ` (cap ${ch.maxWaste})` : ""}
        </p>
        {failed.length ? <p className="text-[13px] text-[#a02040]" data-testid="afail">First failure: {failed[0].op.op === "alloc" ? `${failed[0].op.id} (${failed[0].op.size})` : failed[0].op.id} — {failed[0].why}</p> : null}
        <p className={`font-pixel text-[9px] ${g.ok ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="agrade">
          {g.ok ? "GOAL MET" : "GOAL NOT MET YET"}
        </p>
        <button data-testid="aclaim" onClick={claim} disabled={!g.ok} className="gb-box min-h-11 font-pixel text-[9px] disabled:opacity-40">
          {solved ? "CLEARED ★" : "CLAIM STAR"}
        </button>
      </section>
    </>
  );
}

/** The allocator lab: malloc/free by hand on five strategies, with a fragmentation view and graded challenges. */
export function AllocLab() {
  const [mode, setMode] = useState<"sandbox" | "challenge">("sandbox");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">ALLOCATOR LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(["sandbox", "challenge"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} data-testid={`atab-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 font-pixel text-[8px] ${mode === m ? "bg-[#ffe27a]!" : ""}`}>
            {m === "sandbox" ? "SANDBOX" : "CHALLENGES"}
          </button>
        ))}
      </div>
      {mode === "sandbox" ? <Sandbox /> : <Challenges />}
    </main>
  );
}
