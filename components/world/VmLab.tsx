"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  DEFAULT_CONFIG,
  access,
  cloneMachine,
  gradeTrace,
  hexDigits,
  levelBits,
  makeTrace,
  newMachine,
  parseHex,
  sanitizeConfig,
  solveTrace,
  type AccessResult,
  type LabPolicy,
  type Machine,
  type Outcome,
  type VmConfig,
} from "@/game/sim/vmLab";

const STORE = "kernel-clash:vm-lab";
const OUTCOME_LABEL: Record<Outcome, string> = { "tlb-hit": "TLB HIT", walk: "PAGE WALK", fault: "PAGE FAULT" };
const hex = (n: number, d = 4) => "0x" + n.toString(16).toUpperCase().padStart(d, "0");

/** TLB and frame tables for a machine snapshot. */
function State({ m }: { m: Machine }) {
  const pageBytes = 2 ** m.config.offsetBits;
  return (
    <div className="grid grid-cols-2 gap-2 text-[13px]" data-testid="state">
      <div className="flex flex-col gap-1">
        <p className="font-pixel text-[8px]">TLB ({m.config.tlbEntries})</p>
        {m.config.tlbEntries === 0 ? <p className="text-[#5a5078]">none</p> : null}
        {m.tlb.map((e) => (
          <p key={e.vpn} className="border border-[#1a1430] bg-white px-1.5 py-0.5">
            page {e.vpn} → frame {e.frame}
          </p>
        ))}
        {m.tlb.length === 0 && m.config.tlbEntries > 0 ? <p className="text-[#5a5078]">empty</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-pixel text-[8px]">FRAMES ({m.frames.length} × {pageBytes} B)</p>
        {m.frames.map((f, i) => (
          <p key={i} className={`border border-[#1a1430] px-1.5 py-0.5 ${f ? "bg-white" : "bg-[#e6e1f3] text-[#5a5078]"}`}>
            {i}: {f ? `page ${f.vpn}` : "free"}
          </p>
        ))}
      </div>
    </div>
  );
}

function ConfigPanel({ cfg, onChange }: { cfg: VmConfig; onChange: (c: VmConfig) => void }) {
  const { l1, l2 } = levelBits(cfg.offsetBits);
  const sel = "min-h-11 w-full border-2 border-[#1a1430] bg-white px-2 text-base";
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Machine">
      <p className="font-pixel text-[9px]">MACHINE · 16-BIT ADDRESSES</p>
      <div className="grid grid-cols-2 gap-2 font-pixel text-[8px]">
        <label className="flex flex-col gap-1">
          PAGE SIZE
          <select aria-label="page size" className={sel} value={cfg.offsetBits} onChange={(e) => onChange(sanitizeConfig({ ...cfg, offsetBits: Number(e.target.value) }))}>
            {[6, 8, 10].map((b) => (
              <option key={b} value={b}>
                {2 ** b} B
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          REPLACEMENT
          <select aria-label="replacement policy" className={sel} value={cfg.policy} onChange={(e) => onChange({ ...cfg, policy: e.target.value as LabPolicy })}>
            <option value="lru">LRU</option>
            <option value="fifo">FIFO</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          FRAMES
          <select aria-label="frames" className={sel} value={cfg.frames} onChange={(e) => onChange({ ...cfg, frames: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          TLB ENTRIES
          <select aria-label="TLB entries" className={sel} value={cfg.tlbEntries} onChange={(e) => onChange({ ...cfg, tlbEntries: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[13px] text-[#5a5078]">
        Address = L1 index ({l1} bits) | L2 index ({l2} bits) | offset ({cfg.offsetBits} bits).
      </p>
    </section>
  );
}

function Sandbox() {
  const [cfg, setCfg] = useState<VmConfig>(DEFAULT_CONFIG);
  const [machine, setMachine] = useState<Machine>(() => newMachine(DEFAULT_CONFIG));
  const [before, setBefore] = useState<Machine | null>(null);
  const [text, setText] = useState("1234");
  const [last, setLast] = useState<AccessResult | null>(null);
  const [shown, setShown] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  const parsed = parseHex(text);
  const valid = parsed !== null && parsed < 65536;
  const running = last !== null && shown < last.steps.length;

  const reset = (c: VmConfig) => {
    setMachine(newMachine(c));
    setBefore(null);
    setLast(null);
    setShown(0);
    setHistory([]);
  };
  const go = (v: number) => {
    const snap = cloneMachine(machine);
    const next = cloneMachine(machine);
    const r = access(next, v);
    sfx.click();
    setBefore(snap);
    setMachine(next);
    setLast(r);
    setShown(1);
    setHistory((h) => [...h.slice(-11), `${hex(v)} ${OUTCOME_LABEL[r.outcome]}`]);
  };
  const view = running && before ? before : machine;

  return (
    <>
      <ConfigPanel
        cfg={cfg}
        onChange={(c) => {
          setCfg(c);
          reset(c);
        }}
      />
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Access">
        <p className="font-pixel text-[9px]">VIRTUAL ADDRESS (HEX)</p>
        <div className="flex gap-2">
          <input
            aria-label="virtual address in hex"
            data-testid="vaddr"
            value={text}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            className="min-h-11 min-w-0 flex-1 border-2 border-[#1a1430] bg-white px-2 font-mono text-base uppercase"
          />
          <button data-testid="access" disabled={!valid || running} onClick={() => valid && go(parsed)} className="gb-box min-h-11 px-4 font-pixel text-[9px] disabled:opacity-40">
            ACCESS
          </button>
        </div>
        {!valid ? <p className="text-[13px] text-[#a02040]">Enter 1 to 4 hex digits (0000 to FFFF).</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {[0x0000, 0x0104, 0x1234, 0x1299, 0x8010, 0xff00].map((v) => (
            <button key={v} onClick={() => setText(v.toString(16).toUpperCase().padStart(4, "0"))} className="min-h-11 border-2 border-[#1a1430] bg-white px-2 font-mono text-sm">
              {v.toString(16).toUpperCase().padStart(4, "0")}
            </button>
          ))}
        </div>
      </section>

      {last ? (
        <section className="gb-box flex flex-col gap-2 p-3" aria-label="Walk-through" data-testid="walk">
          <p className="font-pixel text-[9px]">
            {hex(last.vaddr)}
            {!running ? ` · ${OUTCOME_LABEL[last.outcome]}` : ""}
          </p>
          <ol className="flex flex-col gap-1 text-[14px] leading-snug">
            {last.steps.slice(0, shown).map((s, i) => (
              <li key={i} className={`border-l-4 pl-2 ${s.kind === "fault" ? "border-[#e8566b]" : s.kind === "tlb-hit" ? "border-[#5ad66b]" : "border-[#8fb4ff]"}`}>
                {s.text}
              </li>
            ))}
          </ol>
          {running ? (
            <div className="flex gap-2">
              <button data-testid="next-step" onClick={() => setShown((n) => n + 1)} className="gb-box min-h-11 flex-1 font-pixel text-[9px]">
                NEXT STEP ▶
              </button>
              <button data-testid="skip" onClick={() => setShown(last.steps.length)} className="gb-box min-h-11 flex-1 font-pixel text-[9px]">
                SKIP
              </button>
            </div>
          ) : (
            <p className="font-pixel text-[8px]" data-testid="result">
              PHYSICAL {hex(last.physical ?? 0, 3)} · {last.memRefs} MEM REF{last.memRefs === 1 ? "" : "S"}
              {last.victim !== null ? ` · EVICTED PAGE ${last.victim}` : ""}
            </p>
          )}
        </section>
      ) : null}

      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Machine state">
        <p className="font-pixel text-[9px]">{running ? "STATE BEFORE THIS ACCESS" : "STATE NOW"}</p>
        <State m={view} />
        {history.length ? (
          <p className="text-[12px] leading-snug text-[#5a5078]" data-testid="history">
            {history.join(" · ")}
          </p>
        ) : null}
        <button onClick={() => reset(cfg)} className="gb-box min-h-11 font-pixel text-[9px]">
          RESET MACHINE
        </button>
      </section>
    </>
  );
}

function Challenge() {
  const [seed, setSeed] = useState(1);
  const [solved, setSolved] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [phys, setPhys] = useState("");
  const [victim, setVictim] = useState("none");
  const [verdict, setVerdict] = useState<null | { outcome: boolean; physical: boolean; victim: boolean; ok: boolean }>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const v = JSON.parse(localStorage.getItem(STORE) ?? "{}");
        if (typeof v.solved === "number") setSolved(v.solved);
      } catch {
        /* storage can be unavailable; the lab still works */
      }
    });
  }, []);

  const c = makeTrace(seed);
  const { before, result } = solveTrace(c);
  const pa = parseHex(phys);
  const ready = outcome !== "" && pa !== null;
  const digits = Math.max(3, hexDigits(Math.log2(c.config.frames * 2 ** c.config.offsetBits)));
  const { l1, l2 } = levelBits(c.config.offsetBits);

  const check = () => {
    if (!ready) return;
    const g = gradeTrace(c, { outcome, physical: pa, victim: victim === "none" ? null : Number(victim) });
    setVerdict(g);
    if (g.ok) {
      sfx.click();
      const n = solved + 1;
      setSolved(n);
      try {
        localStorage.setItem(STORE, JSON.stringify({ solved: n }));
      } catch {
        /* ignore */
      }
    }
  };
  const next = () => {
    setSeed((s) => s + 1);
    setOutcome("");
    setPhys("");
    setVictim("none");
    setVerdict(null);
  };

  const sel = "min-h-11 w-full border-2 border-[#1a1430] bg-white px-2 text-base";
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Trace challenge">
        <p className="font-pixel text-[9px]">TRACE #{seed} · SOLVED {solved}</p>
        <p className="text-[14px] leading-snug" data-testid="setup">
          {2 ** c.config.offsetBits} B pages ({l1}+{l2}+{c.config.offsetBits} bit split), {c.config.frames} frames, {c.config.tlbEntries}-entry TLB (FIFO), {c.config.policy.toUpperCase()} replacement. Memory starts empty.
        </p>
        <p className="font-pixel text-[8px] leading-4 text-[#5a5078]">THESE ACCESSES ALREADY RAN</p>
        <p className="font-mono text-[14px]" data-testid="history-list">
          {c.history.map((v) => hex(v)).join("  ")}
        </p>
        <p className="font-pixel text-[8px] leading-4 text-[#5a5078]">STATE JUST BEFORE THE TARGET</p>
        <State m={before} />
        <p className="font-pixel text-[9px]" data-testid="target">
          NEXT ACCESS: {hex(c.target)}
        </p>
        <label className="flex flex-col gap-1 font-pixel text-[8px]">
          WHAT HAPPENS?
          <select data-testid="ans-outcome" aria-label="outcome" className={sel} value={outcome} onChange={(e) => { setOutcome(e.target.value as Outcome); setVerdict(null); }}>
            <option value="">choose…</option>
            <option value="tlb-hit">TLB hit</option>
            <option value="walk">TLB miss, page present (walk)</option>
            <option value="fault">Page fault</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-pixel text-[8px]">
          PHYSICAL ADDRESS (HEX)
          <input data-testid="ans-phys" aria-label="physical address in hex" value={phys} maxLength={8} autoCorrect="off" spellCheck={false} onChange={(e) => { setPhys(e.target.value); setVerdict(null); }} className="min-h-11 border-2 border-[#1a1430] bg-white px-2 font-mono text-base uppercase" placeholder={"0".repeat(digits)} />
        </label>
        <label className="flex flex-col gap-1 font-pixel text-[8px]">
          PAGE EVICTED
          <select data-testid="ans-victim" aria-label="evicted page" className={sel} value={victim} onChange={(e) => { setVictim(e.target.value); setVerdict(null); }}>
            <option value="none">none</option>
            {[...new Set(before.frames.filter((f) => f).map((f) => f!.vpn))].sort((x, y) => x - y).map((p) => (
              <option key={p} value={p}>
                page {p}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button data-testid="check" disabled={!ready} onClick={check} className="gb-box min-h-11 flex-1 font-pixel text-[9px] disabled:opacity-40">
            CHECK
          </button>
          <button data-testid="next-trace" onClick={next} className="gb-box min-h-11 flex-1 font-pixel text-[9px]">
            NEW TRACE ▶
          </button>
        </div>
        {verdict ? (
          <div className={`flex flex-col gap-1 text-[14px] ${verdict.ok ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="verdict">
            <p className="font-pixel text-[9px]">{verdict.ok ? "ALL CORRECT" : "NOT QUITE"}</p>
            <p>
              Outcome {verdict.outcome ? "✓" : "✗"} · Physical {verdict.physical ? "✓" : "✗"} · Eviction {verdict.victim ? "✓" : "✗"}
            </p>
          </div>
        ) : null}
        {verdict?.ok ? (
          <ol className="flex flex-col gap-1 text-[14px] leading-snug">
            {result.steps.map((s, i) => (
              <li key={i} className="border-l-4 border-[#8fb4ff] pl-2">
                {s.text}
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </>
  );
}

/** The address-translation lab: sandbox stepper and generated "trace this access" challenges. */
export function VmLab() {
  const [mode, setMode] = useState<"sandbox" | "challenge">("sandbox");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">ADDRESS LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(["sandbox", "challenge"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} data-testid={`tab-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 font-pixel text-[9px] ${mode === m ? "bg-[#ffe27a]" : ""}`}>
            {m === "sandbox" ? "STEP THROUGH" : "TRACE IT"}
          </button>
        ))}
      </div>
      {mode === "sandbox" ? <Sandbox /> : <Challenge />}
    </main>
  );
}
