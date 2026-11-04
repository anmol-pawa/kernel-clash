"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sfx } from "@/game/audio/synth";
import { ALGOS, CHALLENGES, MAX_JOBS, gradeChallenge, metrics, runAlgo, sanitize, type AlgoConfig, type AlgoId, type LabJob } from "@/game/sim/schedLab";
import type { Schedule } from "@/game/sim/scheduling";

const TINTS = ["#e8566b", "#f08a3c", "#ffd34e", "#7ad66b", "#5eead4", "#8fb4ff"];
const STORE = "kernel-clash:sched-lab";
const DEFAULT_JOBS: LabJob[] = [
  { name: "P1", arrival: 0, burst: 8, priority: 3 },
  { name: "P2", arrival: 1, burst: 4, priority: 1 },
  { name: "P3", arrival: 2, burst: 9, priority: 4 },
  { name: "P4", arrival: 3, burst: 5, priority: 2 },
];

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** The Gantt chart: one block per slice, scaled to the makespan, coloured per job. */
function Gantt({ s, jobs, label }: { s: Schedule; jobs: LabJob[]; label: string }) {
  const total = s.gantt.length ? s.gantt[s.gantt.length - 1].end : 1;
  return (
    <div className="flex flex-col gap-1" data-testid="gantt" aria-label={`${label} Gantt chart`}>
      <div className="flex h-9 w-full overflow-hidden border-2 border-[#1a1430]">
        {s.gantt.map((g, i) => {
          const idx = jobs.findIndex((j) => j.name === g.name);
          const w = ((g.end - g.start) / total) * 100;
          return (
            <span
              key={i}
              className="flex min-w-0 items-center justify-center border-r border-[#1a1430] font-pixel text-[8px] text-[#1a1430] last:border-r-0"
              style={{ width: `${w}%`, background: g.name === null ? "repeating-linear-gradient(45deg,#b9b2d4,#b9b2d4 3px,#d8d3ec 3px,#d8d3ec 6px)" : TINTS[idx % TINTS.length] }}
              title={`${g.name ?? "idle"} ${g.start}–${g.end}`}
            >
              {w > 7 ? (g.name ?? "") : ""}
            </span>
          );
        })}
      </div>
      <div className="relative h-4 w-full font-pixel text-[7px] text-[#5a5078]" aria-hidden>
        {s.gantt.map((g, i) => (
          <span key={i} className="absolute" style={{ left: `${(g.start / total) * 100}%` }}>
            {((g.end - g.start) / total) * 100 > 5 || i === 0 ? g.start : ""}
          </span>
        ))}
        <span className="absolute right-0">{total}</span>
      </div>
    </div>
  );
}

function MetricsTable({ s, jobs, testid }: { s: Schedule; jobs: LabJob[]; testid: string }) {
  const m = metrics(jobs, s);
  return (
    <div className="flex flex-col gap-1 text-[13px]" data-testid={testid}>
      <div className="grid grid-cols-2 gap-x-3 font-pixel text-[8px] leading-5">
        <span>AVG WAIT</span>
        <span data-testid={`${testid}-wait`}>{fmt(m.avgWaiting)}</span>
        <span>AVG TURNAROUND</span>
        <span>{fmt(m.avgTurnaround)}</span>
        <span>AVG RESPONSE</span>
        <span>{fmt(m.avgResponse)}</span>
        <span>WORST WAIT</span>
        <span>{m.maxWaiting}</span>
        <span>SWITCHES</span>
        <span data-testid={`${testid}-switches`}>{m.switches}</span>
      </div>
      <div className="grid grid-cols-4 gap-x-2 text-center font-pixel text-[7px] text-[#5a5078]">
        <span className="text-left">JOB</span>
        <span>WAIT</span>
        <span>TURN</span>
        <span>RESP</span>
        {jobs.map((j, i) => (
          <div key={i} className="contents text-[#1a1430]">
            <span className="text-left" style={{ color: "#1a1430" }}>
              <span className="mr-1 inline-block size-2 border border-[#1a1430]" style={{ background: TINTS[i % TINTS.length] }} />
              {j.name}
            </span>
            <span>{s.waiting[i]}</span>
            <span>{s.turnaround[i]}</span>
            <span>{s.response[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlgoPicker({ cfg, onChange, id, allowed }: { cfg: AlgoConfig; onChange: (c: AlgoConfig) => void; id: string; allowed?: AlgoId[] }) {
  const uses = cfg.id === "rr" || cfg.id === "mlfq";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`${id} algorithm`}
        data-testid={`${id}-algo`}
        value={cfg.id}
        onChange={(e) => onChange({ ...cfg, id: e.target.value as AlgoId })}
        className="min-h-11 flex-1 border-2 border-[#1a1430] bg-white px-2 text-base"
      >
        {ALGOS.map((a) => (
          <option key={a.id} value={a.id} disabled={!!allowed && !allowed.includes(a.id)}>
            {a.label}
          </option>
        ))}
      </select>
      {uses ? (
        <label className="flex items-center gap-1 font-pixel text-[8px]">
          Q
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            data-testid={`${id}-quantum`}
            aria-label={`${id} quantum`}
            value={cfg.quantum}
            onChange={(e) => onChange({ ...cfg, quantum: Math.min(30, Math.max(1, Math.trunc(Number(e.target.value)) || 1)) })}
            className="min-h-11 w-16 border-2 border-[#1a1430] bg-white px-2 text-base"
          />
        </label>
      ) : null}
    </div>
  );
}

function Num({ value, onChange, label, min, max }: { value: number; onChange: (n: number) => void; label: string; min: number; max: number }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Math.min(max, Math.max(min, Math.trunc(Number(e.target.value)) || min)))}
      className="min-h-11 w-full min-w-0 border-2 border-[#1a1430] bg-white px-1 text-center text-base"
    />
  );
}

/** The scheduler lab: edit a workload, compare two algorithms, and clear eight challenges. */
export function SchedLab() {
  const [mode, setMode] = useState<"sandbox" | "challenge">("sandbox");
  const [jobs, setJobs] = useState<LabJob[]>(DEFAULT_JOBS);
  const [a, setA] = useState<AlgoConfig>({ id: "fcfs", quantum: 3 });
  const [b, setB] = useState<AlgoConfig>({ id: "srtf", quantum: 3 });
  const [compare, setCompare] = useState(true);
  const [ci, setCi] = useState(0);
  const [cc, setCc] = useState<AlgoConfig>({ id: "fcfs", quantum: 3 });
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    // read after hydration so server and client markup agree
    queueMicrotask(() => {
      try {
        const v = JSON.parse(localStorage.getItem(STORE) ?? "[]");
        if (Array.isArray(v)) setDone(v.filter((x): x is string => typeof x === "string"));
      } catch {
        /* storage can be unavailable; the lab still works */
      }
    });
  }, []);

  const clean = sanitize(jobs);
  const ch = CHALLENGES[ci];
  const grade = gradeChallenge(ch, cc);
  const solved = done.includes(ch.id);

  const submit = () => {
    if (grade.ok) {
      sfx.click();
      if (!solved) {
        const next = [...done, ch.id];
        setDone(next);
        try {
          localStorage.setItem(STORE, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    }
  };
  const pick = (i: number) => {
    setCi(i);
    const allowed = CHALLENGES[i].allowed;
    setCc((c) => (allowed && !allowed.includes(c.id) ? { ...c, id: allowed[0] } : c));
  };
  const edit = (i: number, patch: Partial<LabJob>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)));

  const sa = runAlgo(clean, a);
  const sb = runAlgo(clean, b);
  const sc = runAlgo(ch.jobs, cc);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">SCHEDULER LAB</h1>
        <span className="w-12" />
      </header>

      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(["sandbox", "challenge"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} data-testid={`tab-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 font-pixel text-[9px] ${mode === m ? "bg-[#ffe27a]" : ""}`}>
            {m === "sandbox" ? "SANDBOX" : `CHALLENGES ${done.length}/${CHALLENGES.length}`}
          </button>
        ))}
      </div>

      {mode === "sandbox" ? (
        <>
          <section className="gb-box flex flex-col gap-2 p-3" aria-label="Workload">
            <p className="font-pixel text-[9px]">WORKLOAD</p>
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2.75rem] items-end gap-1.5 font-pixel text-[7px] text-[#5a5078]">
              <span>JOB</span>
              <span>ARRIVE</span>
              <span>BURST</span>
              <span>PRIO</span>
              <span />
              {jobs.map((j, i) => (
                <div key={i} className="contents">
                  <input
                    aria-label={`job ${i + 1} name`}
                    value={j.name}
                    maxLength={4}
                    onChange={(e) => edit(i, { name: e.target.value })}
                    className="min-h-11 w-full min-w-0 border-2 border-[#1a1430] bg-white px-1 text-center text-base"
                  />
                  <Num label={`job ${i + 1} arrival`} value={j.arrival} min={0} max={30} onChange={(n) => edit(i, { arrival: n })} />
                  <Num label={`job ${i + 1} burst`} value={j.burst} min={1} max={30} onChange={(n) => edit(i, { burst: n })} />
                  <Num label={`job ${i + 1} priority`} value={j.priority} min={0} max={9} onChange={(n) => edit(i, { priority: n })} />
                  <button aria-label={`remove job ${i + 1}`} disabled={jobs.length <= 1} onClick={() => setJobs((js) => js.filter((_, k) => k !== i))} className="min-h-11 border-2 border-[#1a1430] bg-[#f6c4cc] text-base disabled:opacity-40">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                data-testid="add-job"
                disabled={jobs.length >= MAX_JOBS}
                onClick={() => setJobs((js) => [...js, { name: `P${js.length + 1}`, arrival: 0, burst: 4, priority: 5 }])}
                className="gb-box min-h-11 flex-1 font-pixel text-[9px] disabled:opacity-40"
              >
                + ADD JOB
              </button>
              <button onClick={() => setJobs(DEFAULT_JOBS)} className="gb-box min-h-11 flex-1 font-pixel text-[9px]">
                RESET
              </button>
            </div>
            <p className="text-[13px] leading-snug text-[#5a5078]">Lower priority number = higher priority. Aging drops a waiting job&apos;s number by 1 every 2 ticks.</p>
          </section>

          <section className="gb-box flex flex-col gap-2 p-3" aria-label="Algorithm A">
            <p className="font-pixel text-[9px]">{compare ? "A" : "RESULT"}</p>
            <AlgoPicker id="a" cfg={a} onChange={setA} />
            <Gantt s={sa} jobs={clean} label="A" />
            <MetricsTable s={sa} jobs={clean} testid="metrics-a" />
          </section>

          {compare ? (
            <section className="gb-box flex flex-col gap-2 p-3" aria-label="Algorithm B">
              <p className="font-pixel text-[9px]">B</p>
              <AlgoPicker id="b" cfg={b} onChange={setB} />
              <Gantt s={sb} jobs={clean} label="B" />
              <MetricsTable s={sb} jobs={clean} testid="metrics-b" />
              <p className="font-pixel text-[8px] leading-4" data-testid="verdict">
                {Math.abs(sa.avgWaiting - sb.avgWaiting) < 1e-9 ? "SAME AVERAGE WAIT" : sa.avgWaiting < sb.avgWaiting ? "A WAITS LESS ON AVERAGE" : "B WAITS LESS ON AVERAGE"}
              </p>
            </section>
          ) : null}
          <button onClick={() => setCompare((c) => !c)} className="gb-box min-h-11 font-pixel text-[9px]">
            {compare ? "HIDE COMPARISON" : "COMPARE TWO ALGORITHMS"}
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5" aria-label="Challenges">
            {CHALLENGES.map((c, i) => (
              <button key={c.id} data-testid={`ch-${i}`} onClick={() => pick(i)} aria-pressed={ci === i} className={`gb-box min-h-11 font-pixel text-[9px] ${ci === i ? "bg-[#ffe27a]" : ""}`}>
                {done.includes(c.id) ? "★" : i + 1}
              </button>
            ))}
          </div>
          <section className="gb-box flex flex-col gap-2 p-3" aria-label="Challenge">
            <p className="font-pixel text-[9px] leading-4">
              {ci + 1}. {ch.title.toUpperCase()}
              {solved ? " ★" : ""}
            </p>
            <p className="text-[15px] leading-snug" data-testid="goal">
              {ch.goal}
            </p>
            <p className="text-[13px] leading-snug text-[#5a5078]">Hint: {ch.hint}</p>
            <p className="font-pixel text-[7px] leading-4 text-[#5a5078]">{ch.jobs.map((j) => `${j.name}(at ${j.arrival}, ${j.burst}${ch.allowed?.some((x) => x.startsWith("prio")) ? `, p${j.priority}` : ""})`).join("  ")}</p>
            <AlgoPicker id="c" cfg={cc} onChange={setCc} allowed={ch.allowed} />
            <Gantt s={sc} jobs={ch.jobs} label="Challenge" />
            <MetricsTable s={sc} jobs={ch.jobs} testid="metrics-c" />
            <p className={`font-pixel text-[9px] leading-4 ${grade.ok ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="grade">
              {grade.ok ? "GOAL MET" : "GOAL NOT MET YET"}
            </p>
            <button data-testid="submit" onClick={submit} disabled={!grade.ok} className="gb-box min-h-11 font-pixel text-[9px] disabled:opacity-40">
              {solved ? "CLEARED ★" : "CLAIM STAR"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
