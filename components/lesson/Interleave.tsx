"use client";
import { useState } from "react";
import { sfx } from "@/game/audio/synth";
import { rampFor } from "@/components/lesson/Gantt";
import { instrText, lostUpdates, runSchedule, type SyncThread } from "@/game/sim/sync";

interface BoardProps {
  threads: readonly SyncThread[];
  init: Readonly<Record<string, number>>;
  /** the thread that took each step so far */
  schedule: readonly number[];
  /** run thread t's next step; omitted when the board is locked */
  onStep?: (t: number) => void;
  /** after answering: one schedule that works, drawn as a second timeline */
  hint?: readonly number[];
  /** tint for the shared variable once the run is over (right / wrong) */
  tone?: "right" | "wrong";
}

const names = (threads: readonly SyncThread[]) => threads.map((t) => t.name);

/** Every register a thread uses, in the order it first appears. */
const regsOf = (t: SyncThread) => [...new Set(t.code.map((i) => i.reg))];

const STEP_BTN =
  "flex min-h-10 w-full items-center justify-center gap-1 rounded-[3px] border-[3px] font-pixel text-[10px] text-[#1a1430] disabled:opacity-40 pointer-coarse:min-h-11";

/**
 * Be the scheduler: each thread is a column of machine steps (load, add,
 * store) with its private registers, and tapping a column's STEP button runs
 * its next step. The shared variables sit on top; the steps taken so far line
 * up in a timeline underneath, each showing the value it wrote. When every
 * thread has finished, a lost update (a store overwritten by a thread that
 * loaded before it) is called out.
 */
export function InterleaveBoard({ threads, init, schedule, onStep, hint, tone }: BoardProps) {
  const run = runSchedule(init, threads, schedule);
  const pcs = threads.map((_, t) => schedule.filter((s) => s === t).length);
  const last = run.steps.at(-1);
  // a thread's registers as they stand now (from the steps it has run)
  const regs = threads.map(() => ({}) as Record<string, number>);
  for (const s of run.steps) if (s.instr.op !== "store") regs[s.thread][s.wrote] = s.value;
  const lost = run.done ? lostUpdates(init, threads, schedule) : [];
  const vars = Object.keys(init);

  return (
    <div className="flex flex-col gap-1.5" data-testid="interleave">
      <div className="flex flex-wrap justify-center gap-1.5">
        {vars.map((v) => {
          const hot = last?.instr.op === "store" && last.wrote === v;
          const bg = tone === "right" ? "#bbf7d0" : tone === "wrong" ? "#fecaca" : hot ? "#ffe27a" : "var(--box)";
          return (
            <div key={`${v}-${hot ? schedule.length : 0}`} className={`flex items-baseline gap-2 rounded-[4px] border-[3px] border-[var(--box-edge)] px-3 py-1 ${hot && !tone ? "pop" : ""}`} style={{ background: bg }} data-testid={`shared-${v}`} data-value={run.shared[v]}>
              <span className="font-pixel text-[8px] text-[var(--box-ink)] opacity-70">SHARED</span>
              <span className="font-mono text-[15px] font-bold text-[var(--box-ink)]">
                {v} = {run.shared[v]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${threads.length}, minmax(0, 1fr))` }}>
        {threads.map((th, t) => {
          const [dark, mid, light] = rampFor(th.name, names(threads));
          const finished = pcs[t] >= th.code.length;
          return (
            <div key={th.name} className="flex min-w-0 flex-col overflow-hidden rounded-[4px] border-[3px] bg-[#2a2440]" style={{ borderColor: dark }} data-testid={`thread-${t}`}>
              <div className="truncate px-1.5 py-0.5 font-pixel text-[9px] text-[#1a1430]" style={{ background: mid, boxShadow: `inset 0 2px 0 ${light}` }}>
                {th.name}
              </div>
              <div className="flex flex-wrap gap-x-2 px-1.5 pt-1 font-mono text-[12px] text-[#b9f0ff]">
                {regsOf(th).map((r) => (
                  <span key={r}>
                    {r} = {regs[t][r] ?? "–"}
                  </span>
                ))}
              </div>
              <ol className="flex flex-col px-1 py-1 font-mono text-[12px] leading-[1.5] sm:text-[13px]">
                {th.code.map((ins, i) => {
                  const done = i < pcs[t];
                  const next = i === pcs[t];
                  return (
                    <li key={i} className={`flex min-w-0 items-center gap-1 rounded-[2px] px-0.5 ${next ? "bg-[#ffe27a] text-[#1a1430]" : done ? "text-[#8f88b0]" : "text-[#f4f1ff]"}`}>
                      <span className="w-3 shrink-0 font-pixel text-[7px]">{done ? "✓" : next ? "▶" : ""}</span>
                      <span className="truncate">{instrText(ins)}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-auto p-1">
                <button
                  type="button"
                  disabled={!onStep || finished}
                  onClick={() => onStep?.(t)}
                  className={STEP_BTN}
                  style={{ background: mid, borderColor: dark, boxShadow: `inset 0 3px 0 ${light}, inset 0 -3px 0 ${dark}` }}
                  aria-label={finished ? `${th.name} finished` : `Run ${th.name}'s next step: ${instrText(th.code[pcs[t]])}`}
                  data-testid={`step-${t}`}
                >
                  {finished ? "DONE" : "▶ STEP"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Timeline threads={threads} init={init} schedule={schedule} label="RUN" />
      {hint && <Timeline threads={threads} init={init} schedule={hint} label="ONE WAY" testid="interleave-hint" />}
      {lost.length > 0 && (
        <p className="rounded-[4px] border-[3px] border-[#7a2030] bg-[#fecaca] px-2 py-1 font-pixel text-[9px] leading-4 text-[#5a1020]" data-testid="lost-update">
          LOST UPDATE: {lost.map((t) => threads[t].name).join(" AND ")}&apos;S STORE WAS OVERWRITTEN
        </p>
      )}
    </div>
  );
}

/** The steps taken, in order: thread colour, the step, and the value it wrote. */
function Timeline({ threads, init, schedule, label, testid = "interleave-run" }: { threads: readonly SyncThread[]; init: Readonly<Record<string, number>>; schedule: readonly number[]; label: string; testid?: string }) {
  const { steps } = runSchedule(init, threads, schedule);
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-[4px] border-[3px] border-[var(--box-edge)] bg-[#1a1430] px-1.5 py-1" data-testid={testid} aria-label={`${label}: ${steps.map((s) => `${threads[s.thread].name} ${instrText(s.instr)}`).join(", ") || "nothing yet"}`}>
      <span className="font-pixel text-[7px] text-[#b9b0d8]">{label}</span>
      {steps.length === 0 && <span className="blink font-pixel text-[8px] text-[#ffe27a]">TAP ▶ STEP</span>}
      {steps.map((s, i) => {
        const [dark, mid] = rampFor(threads[s.thread].name, names(threads));
        return (
          <span key={i} className="flex items-center gap-0.5 rounded-[2px] border-2 px-1 font-mono text-[11px] leading-4 text-[#1a1430]" style={{ background: mid, borderColor: dark }}>
            <span className="font-pixel text-[6px] opacity-70">{i + 1}</span>
            {s.wrote}={s.value}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Free play for a lesson page: step two racing threads in any order and try
 * to reach each possible final value. Values found light up.
 */
export function InterleavePlay({ threads, init, watch, targets }: { threads: readonly SyncThread[]; init: Readonly<Record<string, number>>; watch: string; targets: readonly number[] }) {
  const [schedule, setSchedule] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const total = threads.reduce((n, t) => n + t.code.length, 0);
  const step = (t: number) => {
    const next = [...schedule, t];
    setSchedule(next);
    if (next.length < total) return sfx.blip();
    const v = runSchedule(init, threads, next).shared[watch];
    if (targets.includes(v) && !found.includes(v)) {
      sfx.levelUp();
      setFound((f) => [...f, v]);
    } else sfx.click();
  };
  return (
    <div className="flex flex-col gap-2 bg-[#100e24] p-2" data-testid="interleave-play">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-pixel text-[8px] text-[#b9b0d8]">FIND {watch.toUpperCase()} =</span>
        {targets.map((v) => (
          <span key={v} className={`rounded-[3px] border-2 px-2 font-pixel text-[10px] leading-5 ${found.includes(v) ? "border-[#166534] bg-[#4ade80] text-[#0b2a14]" : "border-[#3c3466] bg-[#2a2440] text-[#8f88b0]"}`} data-found={found.includes(v)} data-testid={`target-${v}`}>
            {found.includes(v) ? "✓ " : ""}
            {v}
          </span>
        ))}
      </div>
      <InterleaveBoard threads={threads} init={init} schedule={schedule} onStep={schedule.length < total ? step : undefined} />
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={!schedule.length} onClick={() => (sfx.blip(), setSchedule((s) => s.slice(0, -1)))} className="gb-box min-h-11 font-pixel text-[10px] !text-[var(--box-ink)] disabled:opacity-50">
          ⌫ UNDO
        </button>
        <button type="button" disabled={!schedule.length} onClick={() => (sfx.click(), setSchedule([]))} className="gb-box min-h-11 font-pixel text-[10px] !text-[var(--box-ink)] disabled:opacity-50" data-testid="interleave-reset">
          ↺ RESET
        </button>
      </div>
    </div>
  );
}
