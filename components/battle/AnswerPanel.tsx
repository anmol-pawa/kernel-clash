"use client";
import { useEffect, useState } from "react";
import { MenuChoice } from "@/components/ui/kit";
import { sfx } from "@/game/audio/synth";
import { kindOf, scrambled, type MultiQ, type NumericQ, type OrderQ, type Question, type Response } from "@/game/engine/question";

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
 * a 2×2 menu (MCQ), toggles plus CONFIRM (select all), a keypad (numeric) or
 * tap-to-number steps (order). Remount it per question (`key`) to reset it.
 */
export function AnswerPanel(p: Props) {
  switch (kindOf(p.q)) {
    case "multi":
      return <MultiPanel {...p} q={p.q as MultiQ} />;
    case "numeric":
      return <NumericPanel {...p} q={p.q as NumericQ} />;
    case "order":
      return <OrderPanel {...p} q={p.q as OrderQ} />;
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
