"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Battle, END_BUTTON } from "@/components/battle/Battle";
import { cardLabel, liveDeck, reviewQuestions } from "@/content/questionBank";
import { isEvolved, starterById, starterFighter, starterMaxHp } from "@/content/starters";
import { sfx } from "@/game/audio/synth";
import { BOXES, DAY, INTERVAL_DAYS, boxCounts, dueKeys, nextDue } from "@/game/engine/leitner";
import { GLITCHIT_ART } from "@/game/sprites/glitchit";
import { partnerArt } from "@/game/sprites/index";
import { saveXp, useSave, xpOf } from "@/lib/save";

const noSub = () => () => {};
const FOE = { name: "Glitchit", level: 5, hp: 100, maxHp: 100, type: "process" } as const;
/** box 1 (shaky) to box 5 (mastered) */
const TINT = ["#e8566b", "#f08a3c", "#ffd34e", "#5eead4", "#7ad66b"];
const MAX_CARDS_SHOWN = 6;

/** "in 3 hours" / "in 2 days" */
export function untilText(ms: number): string {
  const h = Math.ceil(ms / (60 * 60 * 1000));
  if (h < 24) return `in ${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.ceil(ms / DAY);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

/** One box of the Leitner shelf: a stack of index cards in the box's colour. */
function BoxTray({ n, count, due }: { n: number; count: number; due: number }) {
  const shown = Math.min(count, MAX_CARDS_SHOWN);
  const days = INTERVAL_DAYS[n - 1];
  return (
    <li className="gb-box flex flex-col items-center gap-1 px-1 pb-1.5 pt-1" data-testid={`box-${n}`} data-count={count}>
      <span className="font-pixel text-[8px]">BOX {n}</span>
      <span className="relative h-14 w-full max-w-14" aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className="absolute left-1/2 h-4 w-10 -translate-x-1/2 rounded-[2px] border-2 border-[#1a1430]" style={{ bottom: 6 + i * 6, background: TINT[n - 1], boxShadow: "inset 0 -3px 0 #0003, inset 0 2px 0 #fff6" }} />
        ))}
        {/* the tray */}
        <span className="absolute inset-x-0 bottom-0 h-3 rounded-[2px] border-2 border-[#1a1430] bg-[#8a6a3a] shadow-[inset_0_2px_0_#c49a5a]" />
      </span>
      <span className="font-pixel text-[11px]" data-testid={`box-${n}-count`}>
        {count}
      </span>
      <span className="text-center font-pixel text-[7px] leading-3 text-[#5a5078]">{days === 0 ? "AT ONCE" : `${days} DAY${days === 1 ? "" : "S"}`}</span>
      {due > 0 ? <span className="rounded-[2px] bg-[#e8566b] px-1 font-pixel text-[7px] leading-3 text-white">{due} DUE</span> : null}
    </li>
  );
}

/** The review screen: the Leitner box shelf, what's due, and a review battle with the due questions. */
export function ReviewBox() {
  const save = useSave();
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  const [now] = useState(() => Date.now());
  const [battle, setBattle] = useState<{ seed: number; keys: string[] } | null>(null);
  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;

  const deck = liveDeck(save.leitner);
  const due = dueKeys(deck, now);
  const counts = boxCounts(deck);
  const dueByBox = Array.from({ length: BOXES }, (_, i) => due.filter((k) => deck[k].box === i + 1).length);
  const next = nextDue(deck, now);
  const total = Object.keys(deck).length;
  const starter = starterById(save.starter);

  if (battle) {
    const partnerXp = xpOf(save, starter.id);
    const evolved = isEvolved(starter, save.evolved);
    return (
      <Battle
        player={{
          art: partnerArt(starter, evolved),
          fighter: starterFighter(starter, partnerXp, evolved),
          xp: partnerXp,
          maxHpAt: (l) => starterMaxHp(starter, l, evolved),
          onXp: (total) => saveXp(starter.id, total),
        }}
        foe={{ art: GLITCHIT_ART, fighter: FOE, attack: "sync" }}
        questions={reviewQuestions(battle.keys, battle.seed)}
        lines={{ appear: "Review time! A wild GLITCHIT appeared!", counter: "Not quite! GLITCHIT bit back!", fainted: "The wild GLITCHIT fainted!", fled: "GLITCHIT scuttled away…" }}
        endActions={() => (
          <>
            <button type="button" onClick={() => setBattle(null)} className={END_BUTTON} data-testid="review-back">
              ◀ LEITNER BOX
            </button>
            <Link href="/map" className={END_BUTTON}>
              MAP
            </Link>
          </>
        )}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
          ◀ MAP
        </Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">LEITNER BOX</h1>
        <span className="w-12" />
      </header>

      <p className="msg-box p-3 text-[15px] leading-snug">
        Every question you answer files a card here. A right answer moves it up a box and brings it back later; a wrong one sends it to box 1, due at once.
      </p>

      <ol className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="Boxes">
        {counts.map((c, i) => (
          <BoxTray key={i} n={i + 1} count={c} due={dueByBox[i]} />
        ))}
      </ol>

      <div className="gb-box flex flex-col gap-2 p-3" data-testid="review-due" data-due={due.length}>
        <p className="font-pixel text-[10px] leading-5">
          {total === 0 ? "NO CARDS YET" : due.length > 0 ? `${due.length} CARD${due.length === 1 ? "" : "S"} DUE` : "ALL CAUGHT UP"}
        </p>
        {total === 0 ? (
          <p className="text-[15px]">Battle a wild Glitchit or a gym boss and your answers will start filling the box.</p>
        ) : due.length === 0 ? (
          <p className="text-[15px]">Nothing to review right now.{next !== null ? ` The next card is due ${untilText(next - now)}.` : ""}</p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Due cards">
            {due.slice(0, 8).map((k) => {
              const l = cardLabel(k)!;
              return (
                <li key={k} className="flex items-start gap-2 text-[14px] leading-snug">
                  <span className="mt-0.5 shrink-0 rounded-[2px] border-2 border-[#1a1430] px-1 font-pixel text-[7px] leading-3" style={{ background: TINT[deck[k].box - 1] }}>
                    {deck[k].box}
                  </span>
                  <span className="min-w-0">
                    <span className="font-pixel text-[7px] text-[#5a5078]">{l.from.toUpperCase()}</span>
                    <br />
                    {l.text}
                  </span>
                </li>
              );
            })}
            {due.length > 8 ? <li className="font-pixel text-[8px] text-[#5a5078]">+ {due.length - 8} MORE (the battle asks the first 8)</li> : null}
          </ul>
        )}
      </div>

      {due.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            sfx.click();
            setBattle({ seed: xpOf(save, starter.id) + total, keys: due });
          }}
          className={`${END_BUTTON} flex-none bg-[#ffe27a]! py-3`}
          data-testid="review-start"
        >
          ▶ REVIEW BATTLE
        </button>
      ) : (
        <Link href="/battle" className={`${END_BUTTON} flex-none py-3`}>
          ▶ PRACTICE BATTLE
        </Link>
      )}
    </main>
  );
}
