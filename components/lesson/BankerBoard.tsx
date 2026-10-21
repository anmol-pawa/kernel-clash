"use client";
import { useState } from "react";
import { sfx } from "@/game/audio/synth";
import { need, safety, walkSequence, type BankerState } from "@/game/sim/deadlock";

interface BoardProps {
  resources: readonly string[];
  state: BankerState;
  /** the processes picked so far, in order */
  sequence: readonly number[];
  /** pick process p to finish next; omitted when the board is locked */
  onPick?: (p: number) => void;
  /** after answering: one safe sequence, shown as a second line */
  hint?: readonly number[];
  tone?: "right" | "wrong";
}

const vec = (v: readonly number[]) => v.join(" ");

/**
 * The Banker's tables as tappable rows: Allocation and Need for each process
 * and the running Work vector on top. Tapping a process finishes it (Work +=
 * its Allocation); a pick whose Need doesn't fit in Work is marked red and
 * adds nothing, so the player sees why an order fails.
 */
export function BankerBoard({ resources, state, sequence, onPick, hint, tone }: BoardProps) {
  const nd = need(state);
  const walk = walkSequence(state, sequence);
  const pos = (p: number) => sequence.indexOf(p);
  const stuck = walk.ok.includes(false);
  return (
    <div className="flex flex-col gap-1.5" data-testid="banker-board">
      <div className="flex flex-wrap items-baseline justify-center gap-x-2 rounded-[4px] border-[3px] border-[var(--box-edge)] px-3 py-1" style={{ background: tone === "right" ? "#bbf7d0" : tone === "wrong" ? "#fecaca" : "var(--box)" }} data-testid="banker-work" data-work={walk.work.join(",")}>
        <span className="font-pixel text-[8px] text-[var(--box-ink)] opacity-70">{sequence.length ? "WORK" : "AVAILABLE"}</span>
        <span className="font-mono text-[15px] font-bold text-[var(--box-ink)]">
          ({vec(walk.work)}) <span className="text-[11px] font-normal opacity-60">{resources.join(" ")}</span>
        </span>
      </div>
      <div className="grid grid-cols-[2.2rem_1fr_1fr_1.6rem] items-center gap-x-2 gap-y-1 px-1 font-pixel text-[8px] text-[#b9b0d8]">
        <span />
        <span className="text-center">ALLOC</span>
        <span className="text-center">NEED</span>
        <span />
        {state.allocation.map((a, p) => {
          const at = pos(p);
          const done = at >= 0;
          const bad = done && !walk.ok[at];
          return (
            <button
              key={p}
              type="button"
              disabled={!onPick || done}
              onClick={() => onPick?.(p)}
              data-testid={`banker-p${p}`}
              data-state={bad ? "bad" : done ? "done" : "free"}
              className={`col-span-4 grid min-h-10 grid-cols-subgrid items-center rounded-[3px] border-[3px] px-0 font-pixel text-[10px] text-[#1a1430] pointer-coarse:min-h-11 ${bad ? "border-[#991b1b] bg-[#fecaca]" : done ? "border-[#166534] bg-[#bbf7d0] opacity-70" : "border-[#1a1430] bg-[#ffe27a] active:bg-[#fff0b0]"} disabled:cursor-default`}
            >
              <span>P{p}</span>
              <span className="text-center font-mono text-[13px] font-bold">{vec(a)}</span>
              <span className="text-center font-mono text-[13px] font-bold">{vec(nd[p])}</span>
              <span className="text-center">{done ? (bad ? "✗" : at + 1) : ""}</span>
            </button>
          );
        })}
      </div>
      {stuck && onPick && <p className="text-center font-pixel text-[8px] leading-4 text-[#fca5a5]">✗ NEED DOESN&apos;T FIT IN WORK</p>}
      {hint && (
        <p className="text-center font-mono text-[13px] text-[#bbf7d0]" data-testid="banker-hint">
          One safe sequence: &lt;{hint.map((p) => `P${p}`).join(", ")}&gt;
        </p>
      )}
    </div>
  );
}

/** Free play for a lesson page: build a safe sequence for the textbook example; the board explains why picks fail. */
export function BankerPlay({ resources, state }: { resources: readonly string[]; state: BankerState }) {
  const [seq, setSeq] = useState<number[]>([]);
  const n = state.allocation.length;
  const walk = walkSequence(state, seq);
  const solved = seq.length === n && !walk.ok.includes(false);
  const hint = safety(state).sequence;
  return (
    <div className="flex flex-col gap-2 bg-[#100e24] p-2" data-testid="banker-play">
      <p className="text-center font-pixel text-[8px] leading-4 text-[#b9b0d8]">TAP THE PROCESSES IN A SAFE ORDER</p>
      <BankerBoard
        resources={resources}
        state={state}
        sequence={seq}
        tone={solved ? "right" : undefined}
        onPick={seq.length < n ? (p) => (setSeq((s) => [...s, p]), walkSequence(state, [...seq, p]).ok.at(-1) ? sfx.blip() : sfx.click()) : undefined}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={!seq.length} onClick={() => (sfx.blip(), setSeq((s) => s.slice(0, -1)))} className="gb-box min-h-11 font-pixel text-[10px] !text-[var(--box-ink)] disabled:opacity-50">
          ⌫ UNDO
        </button>
        <button type="button" disabled={!seq.length} onClick={() => (sfx.click(), setSeq([]))} className="gb-box min-h-11 font-pixel text-[10px] !text-[var(--box-ink)] disabled:opacity-50" data-testid="banker-reset">
          ↺ RESET
        </button>
      </div>
      {solved && (
        <p className="text-center font-pixel text-[9px] leading-4 text-[#4ade80]" data-testid="banker-solved">
          ✓ SAFE SEQUENCE! The book finds &lt;{hint.map((p) => `P${p}`).join(", ")}&gt;; any order that fits works.
        </p>
      )}
    </div>
  );
}
