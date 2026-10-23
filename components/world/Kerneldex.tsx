"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { TypeBadge } from "@/components/ui/kit";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { KERNELDEX, dexCounts, dexStatus, type DexEntry, type DexStatus } from "@/content/kerneldex";
import { sfx } from "@/game/audio/synth";
import { CREATURES } from "@/game/sprites/index";
import { PLATFORM } from "@/game/sprites/scenery";
import { useSave } from "@/lib/save";

const SKY = ["#1b1446", "#251a5c", "#33226e", "#4a2c7e", "#6b3a86", "#94508a", "#c46f86"];
const ART = Object.fromEntries(CREATURES.map((c) => [c.id, c]));
const noSub = () => () => {};
const num = (n: number) => `No.${String(n).padStart(3, "0")}`;
/** an unknown creature is a dark silhouette */
const SILHOUETTE = { filter: "brightness(0)", opacity: 0.55 };

/** A tiny pixel microchip: the mark of a caught creature. */
function ChipIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 9 9" width={18} height={18} shapeRendering="crispEdges" className={className} aria-hidden>
      <path d="M2 0h1v2H2zM4 0h1v2H4zM6 0h1v2H6zM2 7h1v2H2zM4 7h1v2H4zM6 7h1v2H6zM0 2h2v1H0zM0 4h2v1H0zM0 6h2v1H0zM7 2h2v1H7zM7 4h2v1H7zM7 6h2v1H7z" fill="#b8892a" />
      <path d="M1 1h7v7H1z" fill="#1a1430" />
      <path d="M2 2h5v5H2z" fill="#3cc9b5" />
      <path d="M3 3h3v3H3z" fill="#9af2e2" />
    </svg>
  );
}

function StatusChip({ status }: { status: DexStatus }) {
  if (status === "caught")
    return (
      <span className="flex items-center gap-1 font-pixel text-[8px] text-[#2f7a3a]">
        <ChipIcon /> CAUGHT
      </span>
    );
  return <span className="font-pixel text-[8px] text-[#6e6a8e]">{status === "seen" ? "SEEN" : "UNKNOWN"}</span>;
}

/** The selected creature: big on its platform, with its number, type, blurb and where it lives. */
function Detail({ e, status }: { e: DexEntry; status: DexStatus }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const art = ART[e.id];
  const known = status !== "unknown";
  const big = art.boss ? 2 : 3;
  return (
    <div className="gb-box flex flex-col overflow-hidden" data-testid="dex-detail" data-status={status} aria-live="polite">
      <div className="relative flex h-[244px] land:h-[232px] items-end justify-center overflow-hidden rounded-t-[2px]" style={{ background: `linear-gradient(${SKY.map((c, i) => `${c} ${(i * 100) / SKY.length}% ${((i + 1) * 100) / SKY.length}%`).join(",")})` }}>
        <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[#1d1640]" />
        <span className="relative mb-2 flex flex-col items-center">
          <PixelSprite key={`${e.id}-${side}`} sprite={known ? art[side] : art.front} scale={big} still={!known} className="relative z-10 h-auto" style={{ marginBottom: -10 * big, ...(known ? {} : SILHOUETTE) }} />
          <PixelSprite sprite={PLATFORM} scale={big * 1.1 * (art.boss ? 1.4 : 1)} className="h-auto" />
        </span>
        <span className="absolute left-2 top-2 font-pixel text-[10px] text-white pixel-shadow">{num(e.no)}</span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-pixel text-[12px] leading-5" data-testid="dex-name">
            {known ? e.name.toUpperCase() : "???"}
          </h2>
          {known ? <TypeBadge type={e.type} /> : null}
          <StatusChip status={status} />
          {known ? (
            <div className="flex gap-1" role="group" aria-label="View">
              {(["front", "back"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={side === v}
                  onClick={() => {
                    sfx.click();
                    setSide(v);
                  }}
                  className={`min-h-9 rounded-[3px] border-2 border-[#1a1430] px-2 font-pixel text-[8px] ${side === v ? "bg-[#ffe27a] text-[#1a1430]" : "bg-white text-[#1a1430]"}`}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="text-[15px] leading-snug" data-testid="dex-blurb">
          {status === "caught" ? e.blurb : status === "seen" ? "Win a battle against it to record its data." : "Not seen yet."}
        </p>
        <p className="font-pixel text-[8px] leading-4 text-[#5a5078]">
          {e.kind === "boss" ? "GYM BOSS · " : e.kind === "trainer" ? "GYM TRAINER · " : ""}
          {(status === "unknown" && e.kind === "evolved" ? "Evolves from a partner" : e.where).toUpperCase()}
        </p>
      </div>
    </div>
  );
}

/** The Kerneldex: every creature in the region, seen and caught, with its art, type and blurb. */
export function Kerneldex() {
  const save = useSave();
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  const [pick, setPick] = useState(KERNELDEX[0].id);
  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;

  const counts = dexCounts(save);
  const sel = KERNELDEX.find((e) => e.id === pick)!;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">KERNELDEX</h1>
        <span className="w-12" />
      </header>
      <p className="flex justify-center gap-4 font-pixel text-[9px] text-white pixel-shadow" data-testid="dex-counts">
        <span>
          SEEN <span className="text-[#5eead4]">{counts.seen}</span>/{counts.total}
        </span>
        <span>
          CAUGHT <span className="text-[#ffe27a]">{counts.caught}</span>/{counts.total}
        </span>
      </p>

      <div className="flex flex-col gap-3 land:flex-row land:items-start land:gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="w-full land:sticky land:top-2 land:max-h-[calc(100dvh-1rem)] land:w-[46%] land:shrink-0 land:overflow-y-auto lg:sticky lg:top-4 lg:w-[400px] lg:shrink-0">
          <Detail key={sel.id} e={sel} status={dexStatus(sel, save)} />
        </div>

        <ul className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-6 land:grid-cols-4 lg:grid-cols-4" aria-label="Creatures">
          {KERNELDEX.map((e) => {
            const status = dexStatus(e, save);
            const known = status !== "unknown";
            const on = e.id === sel.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    sfx.click();
                    setPick(e.id);
                  }}
                  aria-pressed={on}
                  aria-label={`${num(e.no)} ${known ? e.name : "unknown"}${status === "caught" ? ", caught" : ""}`}
                  data-testid={`dex-${e.id}`}
                  data-status={status}
                  className={`gb-box relative flex w-full flex-col items-center gap-0.5 px-0.5 pb-1 pt-1 ${on ? "outline-4 outline-offset-2 outline-[#ffe27a] [outline-style:dashed]" : ""}`}
                >
                  <span className="self-start pl-1 font-pixel text-[7px] text-[#6e6a8e]">{String(e.no).padStart(3, "0")}</span>
                  <PixelSprite sprite={ART[e.id].front} scale={1} still className="h-12 w-12" style={known ? undefined : SILHOUETTE} />
                  <span className="w-full truncate text-center font-pixel text-[7px] leading-3">{known ? e.name.toUpperCase() : "???"}</span>
                  {status === "caught" ? <ChipIcon className="absolute right-1 top-1 h-3 w-3" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
