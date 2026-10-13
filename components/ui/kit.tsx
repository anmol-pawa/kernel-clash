"use client";
import type { ReactNode } from "react";
import { sfx } from "@/game/audio/synth";
import { TYPE_COLOR, type MoveType } from "@/game/engine/types";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** A pixel gauge: dark trough, chunky fill and a lighter top highlight row. */
export function Gauge({ label, pct, color, thin = false, labelColor, aria }: { label: string; pct: number; color: string; thin?: boolean; labelColor: string; aria: { name: string; now: number; max: number } }) {
  return (
    <div className="flex items-center gap-1">
      <span className="rounded-[2px] bg-[#3c3466] px-1 font-pixel text-[7px] leading-[10px]" style={{ color: labelColor }}>
        {label}
      </span>
      <div
        className={`relative flex-1 border-2 border-[#3c3466] bg-[#4b4466] ${thin ? "h-2" : "h-3"}`}
        role="meter"
        aria-label={aria.name}
        aria-valuemin={0}
        aria-valuemax={aria.max}
        aria-valuenow={aria.now}
      >
        <div className="h-full transition-[width,background-color] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: color }}>
          <div className="h-[2px] w-full bg-white/45" />
        </div>
      </div>
    </div>
  );
}

/**
 * Handheld-console status box. The foe's is compact (name, level, HP bar);
 * the player's adds HP numbers and a blue XP bar. `side` sets which corner
 * gets the pointed "tail" that hints at the creature it belongs to.
 */
export function HpBox({ name, level, hp, maxHp, xp, type, side = "foe", className = "" }: { name: string; level: number; hp: number; maxHp: number; xp?: number; type?: MoveType; side?: "foe" | "player"; className?: string }) {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const color = pct > 0.5 ? "#48d870" : pct > 0.2 ? "#f8c830" : "#f05050";
  const player = side === "player";
  return (
    <div className={`gb-box hp-tail px-3 pb-2 pt-1.5 font-pixel text-[10px] leading-4 ${player ? "hp-tail-left" : "hp-tail-right"} ${className.includes("absolute") ? "" : "relative"} ${className}`} data-testid={`hp-${side}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate">{name.toUpperCase()}</span>
        <span className="shrink-0">
          <span className="text-[8px]">Lv</span>
          {level}
        </span>
      </div>
      {type && (
        <span className="absolute -top-2.5 right-3" data-testid={`type-${side}`}>
          <TypeBadge type={type} small />
        </span>
      )}
      <div className="mt-1">
        <Gauge label="HP" pct={pct} color={color} labelColor="#f8a830" aria={{ name: `${name} HP`, now: hp, max: maxHp }} />
      </div>
      {player && (
        <div className="mt-1 text-right tabular-nums">
          {String(Math.max(0, hp)).padStart(3, " ")}/{maxHp}
        </div>
      )}
      {xp !== undefined && (
        <div className="mt-0.5">
          <Gauge label="XP" pct={xp} color="#40a8f8" thin labelColor="#9ad8ff" aria={{ name: `${name} XP`, now: Math.round(xp * 100), max: 100 }} />
        </div>
      )}
    </div>
  );
}

/**
 * The battle message box. Text types out (done by the caller); while
 * `waiting`, a blinking ▼ asks for a tap to continue. The whole box is the
 * tap target.
 */
export function MessageBox({ children, waiting, onTap, className = "" }: { children: ReactNode; waiting?: boolean; onTap?: () => void; className?: string }) {
  return (
    <div
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={(e) => {
        if (onTap && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTap();
        }
      }}
      className={`msg-box relative min-h-[5.25rem] cursor-default select-none px-4 py-3 pr-8 font-sans text-[16px] leading-[1.35] ${className}`}
      aria-live="polite"
      data-testid="message"
    >
      {children}
      {waiting && <span className="blink absolute bottom-2 right-3 font-pixel text-[10px] text-[#e04848]">▼</span>}
    </div>
  );
}

/** Coloured pixel badge for a move type. */
export function TypeBadge({ type, small = false }: { type: MoveType; small?: boolean }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-[2px] border-2 border-black/40 font-pixel text-[#1a1238] ${small ? "self-center px-1 text-[6px] leading-[8px]" : "px-1.5 py-[1px] text-[8px] leading-[10px]"}`}
      style={{ background: hex(TYPE_COLOR[type]) }}
    >
      {small ? TYPE_SHORT[type] : type.toUpperCase()}
    </span>
  );
}

/** Short type names for the compact badge in an HP box. */
const TYPE_SHORT: Record<MoveType, string> = { process: "PROC", scheduler: "SCHED", sync: "SYNC", memory: "MEM", storage: "STOR", io: "IO" };

/**
 * The move this question powers: name, type and power, like a move info
 * panel. `effect` (from the type chart vs the foe) adds a ×2 / ×0.5 tag.
 */
export function MoveInfo({ name, type, power, effect = 1 }: { name: string; type: MoveType; power: number; effect?: number }) {
  return (
    <div className="flex items-center gap-2 font-pixel text-[9px] leading-3 text-[#f8f4e6]" data-testid="move-info">
      <span className="truncate">{name.toUpperCase()}</span>
      <TypeBadge type={type} />
      {effect !== 1 && (
        <span className={`shrink-0 ${effect > 1 ? "text-[#7cf09a]" : "text-[#f89a9a]"}`} title={effect > 1 ? "Super effective" : "Not very effective"} data-testid="move-effect">
          {effect > 1 ? "×2" : "×0.5"}
        </span>
      )}
      <span className="ml-auto shrink-0 text-[#b9b0d8]">PWR {power}</span>
    </div>
  );
}

/** A big, tap-friendly menu choice in the handheld style, tagged A–D. `pressed` marks a selected toggle. */
export function MenuChoice({ children, onClick, disabled, state, tag, pressed }: { children: ReactNode; onClick: () => void; disabled?: boolean; state?: "right" | "wrong"; tag?: string; pressed?: boolean }) {
  const tone = state === "right" ? "bg-[#bbf7d0]" : state === "wrong" ? "bg-[#fecaca]" : pressed ? "bg-[#fff1c2]" : "bg-[var(--box)] hover:bg-[#fff6dc] active:bg-[#efe6c8]";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={() => {
        sfx.click();
        onClick();
      }}
      className={`group flex min-h-14 w-full items-center gap-2 rounded-[4px] border-4 border-[var(--box-edge)] px-2 py-1.5 text-left font-sans text-[15px] leading-[1.2] text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0001] sm:text-[16px] ${tone} disabled:cursor-default`}
    >
      {pressed !== undefined && !state ? (
        // a checkbox for select-all toggles
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border-[3px] border-[var(--box-edge)] font-pixel text-[9px] ${pressed ? "bg-[var(--box-edge)] text-[#f8c830]" : "bg-white"}`}>{pressed ? "✓" : ""}</span>
      ) : (
        tag !== undefined && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-[var(--box-edge)] font-pixel text-[8px] text-[var(--box)] group-hover:bg-[#e04848]">
            {state === "right" ? "✓" : state === "wrong" ? "✗" : tag}
          </span>
        )
      )}
      <span className="min-w-0 break-words">{children}</span>
    </button>
  );
}
