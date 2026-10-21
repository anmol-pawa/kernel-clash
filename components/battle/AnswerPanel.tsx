"use client";
import { useEffect, useState } from "react";
import { MenuChoice } from "@/components/ui/kit";
import { sfx } from "@/game/audio/synth";
import { rampFor } from "@/components/lesson/Gantt";
import { BankerBoard } from "@/components/lesson/BankerBoard";
import { InterleaveBoard } from "@/components/lesson/Interleave";
import { chartOf, interleaveResult, kindOf, scrambled, unitsOf, type BankerQ, type GanttQ, type InterleaveQ, type MultiQ, type NumericQ, type OrderQ, type Question, type Response } from "@/game/engine/question";

/** What the panel shows once an answer is in: the player's response and whether it was right. */
export interface Reveal {
  response: Response;
  correct: boolean;
}

interface Props {
  q: Question;
  disabled: boolean;
  reveal: Reveal | null;
  onSubmit: (r: Response) => void;
}

/** A stable seed per question, so its steps start in the same scrambled order. */
const seedOf = (id: string) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const CONFIRM = "gb-box flex min-h-12 w-full items-center justify-center font-pixel text-[11px] !text-[var(--box-ink)] disabled:opacity-50";

/**
 * The answer controls under the message box, one layout per question kind:
 * a 2×2 menu (MCQ), toggles plus CONFIRM (select all), a keypad (numeric),
 * tap-to-number steps (order), a tap-to-build Gantt chart (gantt) or
 * tap-to-schedule threads (interleave) or tap-to-order processes (banker). Remount it per question (`key`) to reset it.
 */
export function AnswerPanel(p: Props) {
  switch (kindOf(p.q)) {
    case "multi":
      return <MultiPanel {...p} q={p.q as MultiQ} />;
    case "numeric":
      return <NumericPanel {...p} q={p.q as NumericQ} />;
    case "order":
      return <OrderPanel {...p} q={p.q as OrderQ} />;
    case "gantt":
      return <GanttPanel {...p} q={p.q as GanttQ} />;
    case "interleave":
      return <InterleavePanel {...p} q={p.q as InterleaveQ} />;
    case "banker":
      return <BankerPanel {...p} q={p.q as BankerQ} />;
    default:
      return <McqPanel {...p} />;
  }
}

function McqPanel({ q, disabled, reveal, onSubmit }: Props) {
  if (q.kind !== undefined && q.kind !== "mcq") return null;
  const picked = reveal?.response.kind === "mcq" ? reveal.response.choice : null;
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2" data-testid="menu">
      {q.options.map((o, i) => (
        <MenuChoice key={i} tag={"ABCD"[i]} onClick={() => onSubmit({ kind: "mcq", choice: i })} disabled={disabled} state={picked === null ? undefined : i === q.answer ? "right" : i === picked ? "wrong" : undefined}>
          {o}
        </MenuChoice>
      ))}
    </div>
  );
}

function MultiPanel({ q, disabled, reveal, onSubmit }: Omit<Props, "q"> & { q: MultiQ }) {
  const [sel, setSel] = useState<number[]>([]);
  const right = new Set(q.answers);
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  return (
    <div className="flex flex-col gap-1.5" data-testid="menu" data-kind="multi">
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {q.options.map((o, i) => {
          const on = sel.includes(i);
          // after answering: every right option is green; a wrong pick is red
          const state = reveal ? (right.has(i) ? "right" : on ? "wrong" : undefined) : undefined;
          return (
            <MenuChoice key={i} tag="" onClick={() => toggle(i)} disabled={disabled || !!reveal} state={state} pressed={on}>
              {o}
            </MenuChoice>
          );
        })}
      </div>
      {!reveal && (
        <button
          type="button"
          className={CONFIRM}
          disabled={disabled || sel.length === 0}
          onClick={() => {
            sfx.click();
            onSubmit({ kind: "multi", choices: sel });
          }}
        >
          ▶ CONFIRM {sel.length > 0 && `(${sel.length})`}
        </button>
      )}
    </div>
  );
}

const KEYS = ["7", "8", "9", "⌫", "4", "5", "6", "/", "1", "2", "3", ".", "-", "0"];

function NumericPanel({ q, disabled, reveal, onSubmit }: Omit<Props, "q"> & { q: NumericQ }) {
  const [v, setV] = useState("");
  const locked = disabled || !!reveal;
  const press = (k: string) => {
    if (locked) return;
    if (k === "⌫") return setV((s) => s.slice(0, -1));
    if (k === "-") return setV((s) => (s.startsWith("-") ? s.slice(1) : `-${s}`));
    setV((s) => (s.length >= 10 ? s : s + k));
  };
  const submit = () => {
    if (locked || !v) return;
    sfx.click();
    onSubmit({ kind: "numeric", value: v });
  };

  // a physical keyboard works too (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9./-]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Enter") submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tone = reveal ? (reveal.correct ? "bg-[#bbf7d0]" : "bg-[#fecaca]") : "bg-[var(--box)]";
  return (
    <div className="flex gap-2" data-testid="menu" data-kind="numeric">
      {q.code && (
        <pre className="gb-box min-w-0 shrink overflow-x-auto px-2 py-1.5 font-mono text-[12px] leading-[1.35] sm:text-[13px]" data-testid="code">
          {q.code}
        </pre>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className={`flex min-h-10 items-center justify-end gap-1 rounded-[4px] border-4 border-[var(--box-edge)] px-2 font-pixel text-[14px] text-[var(--box-ink)] ${tone}`} data-testid="numeric-value" aria-live="polite">
          <span className="truncate">{v || <span className="blink opacity-40">_</span>}</span>
          {q.unit && <span className="shrink-0 text-[9px] opacity-70">{q.unit}</span>}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={locked}
              aria-label={k === "⌫" ? "Delete" : k === "-" ? "Minus" : k}
              onClick={() => {
                sfx.blip();
                press(k);
              }}
              className="min-h-10 rounded-[4px] border-[3px] border-[var(--box-edge)] bg-[var(--box)] font-pixel text-[12px] text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0001] active:bg-[#efe6c8] disabled:opacity-60 pointer-coarse:min-h-11"
            >
              {k === "-" ? "±" : k}
            </button>
          ))}
          <button type="button" disabled={locked || !v} onClick={submit} className="col-span-2 min-h-10 rounded-[4px] border-[3px] border-[var(--box-edge)] bg-[#f8c830] font-pixel text-[11px] text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0002] disabled:opacity-50 pointer-coarse:min-h-11">
            ▶ OK
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderPanel({ q, disabled, reveal, onSubmit }: Omit<Props, "q"> & { q: OrderQ }) {
  const [start] = useState(() => scrambled(q, seedOf(q.id)));
  // step indexes in the order the player tapped them
  const [placed, setPlaced] = useState<number[]>([]);
  const locked = disabled || !!reveal;
  const tap = (i: number) => {
    if (locked) return;
    sfx.blip();
    setPlaced((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  // after answering, list the steps in the right order; green if the player had it there
  const rows = reveal ? q.steps.map((_, i) => i) : start;
  const given = reveal?.response.kind === "order" ? reveal.response.order : [];
  return (
    <div className="flex flex-col gap-1" data-testid="menu" data-kind="order">
      <ol className="flex flex-col gap-1">
        {rows.map((i) => {
          const n = placed.indexOf(i);
          const state = reveal ? (given[i] === i ? "bg-[#bbf7d0]" : "bg-[#fecaca]") : n >= 0 ? "bg-[#fff1c2]" : "bg-[var(--box)]";
          return (
            <li key={i}>
              <button
                type="button"
                disabled={locked}
                onClick={() => tap(i)}
                aria-pressed={n >= 0}
                className={`flex min-h-10 w-full items-center gap-2 rounded-[4px] border-[3px] border-[var(--box-edge)] px-2 py-1 text-left font-sans text-[14px] leading-[1.2] text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0001] sm:text-[15px] ${state} pointer-coarse:min-h-11`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] font-pixel text-[9px] ${reveal || n >= 0 ? "bg-[var(--box-edge)] text-[var(--box)]" : "border-2 border-dashed border-[var(--box-edge)]/50"}`}>
                  {reveal ? i + 1 : n >= 0 ? n + 1 : ""}
                </span>
                <span className="min-w-0 break-words">{q.steps[i]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {!reveal && (
        <button type="button" className={CONFIRM} disabled={locked || placed.length !== q.steps.length} onClick={() => onSubmit({ kind: "order", order: placed })}>
          {placed.length === q.steps.length ? "▶ CONFIRM ORDER" : `TAP STEPS IN ORDER (${placed.length}/${q.steps.length})`}
        </button>
      )}
    </div>
  );
}

const KEY_BTN =
  "flex min-h-10 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-[4px] border-[3px] border-[var(--box-edge)] bg-[var(--box)] px-1 font-pixel text-[10px] text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0001] active:bg-[#efe6c8] disabled:opacity-45 pointer-coarse:min-h-11";

/** Hatched fill for idle time, like the explanation charts. */
const IDLE_FILL = "repeating-linear-gradient(135deg, #3a3850 0 3px, #5e5a78 3px 5px)";

/**
 * Tap-to-build Gantt chart: each tap on a process (or IDLE) gives it the next
 * time unit. The bar fills left to right, merged into blocks with their start
 * times; UNDO takes back the last unit. After answering, each unit is marked
 * right or wrong against the simulator's chart.
 */
function GanttPanel({ q, disabled, reveal, onSubmit }: Omit<Props, "q"> & { q: GanttQ }) {
  const [units, setUnits] = useState<(string | null)[]>([]);
  const want = unitsOf(q.answer);
  const total = want.length;
  const locked = disabled || !!reveal;
  const shown = reveal?.response.kind === "gantt" ? reveal.response.units : units;
  const left = (name: string) => want.filter((u) => u === name).length - shown.filter((u) => u === name).length;
  const add = (name: string | null) => {
    if (locked || units.length >= total) return;
    sfx.blip();
    setUnits((u) => [...u, name]);
  };
  // block start times (and the end), skipping a label that would crowd the one before
  const gap = Math.max(2, total / 8);
  const labels: number[] = [];
  for (const t of [...chartOf(shown).map((b) => b.start), total]) {
    // the end always shows, displacing a crowding label before it (but never 0)
    if (t === total && labels.length > 1 && t - labels[labels.length - 1] < gap) labels.pop();
    if (!labels.length || t - labels[labels.length - 1] >= gap || t === total) labels.push(t);
  }
  return (
    <div className="flex flex-col gap-1.5" data-testid="menu" data-kind="gantt">
      <div className="flex gap-2">
        {q.code && (
          <pre className="gb-box min-w-0 shrink self-start overflow-x-auto px-2 py-1.5 font-mono text-[11px] leading-[1.35] sm:text-[13px]" data-testid="code">
            {q.code}
          </pre>
        )}
        <div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-1">
          {q.jobs.map((name) => {
            const n = left(name);
            const [dark, mid, light] = rampFor(name, q.jobs);
            return (
              <button
                key={name}
                type="button"
                disabled={locked || n <= 0 || units.length >= total}
                onClick={() => add(name)}
                className={KEY_BTN}
                style={{ background: mid, borderColor: dark, boxShadow: `inset 0 3px 0 ${light}, inset 0 -3px 0 ${dark}` }}
                aria-label={`${name}, ${n} left`}
              >
                <span>{name}</span>
                <span className="text-[8px] opacity-70">×{n}</span>
              </button>
            );
          })}
          <button type="button" disabled={locked || units.length >= total} onClick={() => add(null)} className={`${KEY_BTN} !text-[#f8f4e6]`} style={{ background: IDLE_FILL, borderColor: "#2a2838" }}>
            IDLE
          </button>
          <button
            type="button"
            disabled={locked || units.length === 0}
            onClick={() => {
              sfx.blip();
              setUnits((u) => u.slice(0, -1));
            }}
            className={KEY_BTN}
            aria-label="Undo"
          >
            ⌫ UNDO
          </button>
        </div>
      </div>
      <div className="rounded-[4px] border-[3px] border-[var(--box-edge)] bg-[#2a2440] px-1.5 pb-1 pt-1.5" data-testid="gantt-build" aria-label={`Chart so far: ${chartOf(shown).map((b) => `${b.name ?? "idle"} ${b.start} to ${b.end}`).join(", ") || "empty"}`}>
        <div className="flex h-7">
          {Array.from({ length: total }, (_, t) => {
            const has = t < shown.length;
            const name = shown[t];
            const [dark, mid, light] = rampFor(name ?? null, q.jobs);
            const joinsPrev = has && t > 0 && shown[t - 1] === name;
            const mark = reveal ? (has && name === want[t] ? "#4ade80" : "#f87171") : undefined;
            return (
              <div
                key={t}
                className={`relative flex min-w-0 flex-1 items-center justify-center ${has ? "" : "border-y-2 border-dashed border-[#5e5a78]"} ${!has && t === shown.length && !locked ? "blink bg-[#ffe27a]/30" : ""}`}
                style={has ? { background: name === null ? IDLE_FILL : mid, boxShadow: `inset 0 3px 0 ${name === null ? "#5e5a78" : light}, inset 0 -3px 0 ${dark}`, borderLeft: joinsPrev ? undefined : "2px solid #1a1430" } : undefined}
                data-unit={has ? (name ?? "idle") : ""}
              >
                {has && !joinsPrev && name && <span className="pointer-events-none absolute left-0.5 font-pixel text-[7px] text-[#1a1430] sm:text-[8px]">{name}</span>}
                {mark && <span className="absolute inset-x-0 -bottom-1 h-1" style={{ background: mark }} />}
              </div>
            );
          })}
        </div>
        <div className="relative mt-1 h-3 font-pixel text-[7px] text-[#f8f4e6] sm:text-[8px]">
          {labels.map((t) => (
            <span key={t} className="absolute top-0" style={{ left: `${(t / total) * 100}%`, transform: t === 0 ? "none" : t === total ? "translateX(-100%)" : "translateX(-50%)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      {!reveal && (
        <button
          type="button"
          className={CONFIRM}
          disabled={locked || units.length !== total}
          onClick={() => {
            sfx.click();
            onSubmit({ kind: "gantt", units });
          }}
        >
          {units.length === total ? "▶ CONFIRM CHART" : `TAP TO FILL t = ${units.length}/${total}`}
        </button>
      )}
    </div>
  );
}

/**
 * Be the scheduler: tap which thread runs its next step until every thread
 * has finished, then confirm. Any interleaving that leaves the goal variable
 * at the goal value is right; after a wrong one, one that works is shown.
 */
function InterleavePanel({ q, disabled, reveal, onSubmit }: Omit<Props, "q"> & { q: InterleaveQ }) {
  const [schedule, setSchedule] = useState<number[]>([]);
  const total = q.threads.reduce((n, t) => n + t.code.length, 0);
  const locked = disabled || !!reveal;
  const shown = reveal?.response.kind === "interleave" ? reveal.response.schedule : schedule;
  const now = schedule.length === total ? interleaveResult(q, schedule) : null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="menu" data-kind="interleave">
      <InterleaveBoard
        threads={q.threads}
        init={q.init}
        schedule={shown}
        onStep={locked || schedule.length >= total ? undefined : (t) => (sfx.blip(), setSchedule((s) => [...s, t]))}
        hint={reveal && !reveal.correct ? q.answer : undefined}
        tone={reveal ? (reveal.correct ? "right" : "wrong") : undefined}
      />
      {!reveal && (
        <div className="grid grid-cols-[auto_1fr] gap-1.5">
          <button type="button" disabled={locked || schedule.length === 0} onClick={() => (sfx.blip(), setSchedule((s) => s.slice(0, -1)))} className={`${KEY_BTN} px-3`} aria-label="Undo">
            ⌫ UNDO
          </button>
          <button
            type="button"
            className={CONFIRM}
            disabled={locked || schedule.length !== total}
            onClick={() => {
              sfx.click();
              onSubmit({ kind: "interleave", schedule });
            }}
          >
            {schedule.length === total ? `▶ CONFIRM (${q.goal.v} = ${now})` : `GOAL ${q.goal.v}=${q.goal.value} · ${schedule.length}/${total}`}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Banker's algorithm: tap the processes in an order that lets each finish
 * (its Need fits in Work, which grows by its Allocation). Any safe sequence is
 * right; after a wrong one, a safe sequence is shown.
 */
function BankerPanel({ q, disabled, reveal, onSubmit }: Omit<Props, "q"> & { q: BankerQ }) {
  const [seq, setSeq] = useState<number[]>([]);
  const total = q.state.allocation.length;
  const locked = disabled || !!reveal;
  const shown = reveal?.response.kind === "banker" ? reveal.response.sequence : seq;
  return (
    <div className="flex flex-col gap-1.5" data-testid="menu" data-kind="banker">
      <BankerBoard
        resources={q.resources}
        state={q.state}
        sequence={shown}
        onPick={locked || seq.length >= total ? undefined : (p) => (sfx.blip(), setSeq((s) => [...s, p]))}
        hint={reveal && !reveal.correct ? q.answer : undefined}
        tone={reveal ? (reveal.correct ? "right" : "wrong") : undefined}
      />
      {!reveal && (
        <div className="grid grid-cols-[auto_1fr] gap-1.5">
          <button type="button" disabled={locked || seq.length === 0} onClick={() => (sfx.blip(), setSeq((s) => s.slice(0, -1)))} className={`${KEY_BTN} px-3`} aria-label="Undo">
            ⌫ UNDO
          </button>
          <button
            type="button"
            className={CONFIRM}
            disabled={locked || seq.length !== total}
            onClick={() => {
              sfx.click();
              onSubmit({ kind: "banker", sequence: seq });
            }}
          >
            {seq.length === total ? "▶ CONFIRM ORDER" : `FINISH ORDER · ${seq.length}/${total}`}
          </button>
        </div>
      )}
    </div>
  );
}
