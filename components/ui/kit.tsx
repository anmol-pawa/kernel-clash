"use client";
import type { ReactNode } from "react";
import { sfx } from "@/game/audio/synth";

/** Handheld-console HP box: name, level, a segmented HP bar coloured by health. */
export function HpBox({ name, level, hp, maxHp, showNumbers = false, className = "" }: { name: string; level: number; hp: number; maxHp: number; showNumbers?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const color = pct > 0.5 ? "#4ade80" : pct > 0.2 ? "#facc15" : "#f87171";
  return (
    <div className={`gb-box px-3 py-2 font-pixel text-[10px] leading-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate">{name.toUpperCase()}</span>
        <span>Lv{level}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[8px] text-[#e8a52a]">HP</span>
        <div className="h-2.5 flex-1 border-2 border-[var(--box-edge)] bg-[#3b3355]" role="meter" aria-label={`${name} HP`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
          <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${pct * 100}%`, background: color }} />
        </div>
      </div>
      {showNumbers && (
        <div className="mt-1 text-right">
          {hp}/{maxHp}
        </div>
      )}
    </div>
  );
}

/** A big, tap-friendly menu choice in the handheld style. */
export function MenuChoice({ children, onClick, disabled, state }: { children: ReactNode; onClick: () => void; disabled?: boolean; state?: "right" | "wrong" }) {
  const tone = state === "right" ? "bg-[#bbf7d0]" : state === "wrong" ? "bg-[#fecaca]" : "bg-[var(--box)] hover:bg-[#fff6dc]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        sfx.click();
        onClick();
      }}
      className={`group min-h-12 w-full border-4 border-[var(--box-edge)] px-3 py-2 text-left font-sans text-[16px] leading-5 text-[var(--box-ink)] ${tone} disabled:cursor-default`}
    >
      <span className="mr-1 font-pixel text-[10px] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">▶</span>
      {children}
    </button>
  );
}
