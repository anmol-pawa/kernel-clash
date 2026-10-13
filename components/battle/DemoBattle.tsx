"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { DEMO_QUESTIONS } from "@/content/demo";
import { STARTER_LEVEL, starterById, starterFighter } from "@/content/starters";
import { xpForLevel } from "@/game/engine/xp";
import { GLITCHIT_ART } from "@/game/sprites/glitchit";
import { STARTER_ART } from "@/game/sprites/index";
import { useSave } from "@/lib/save";
import { Battle, END_BUTTON } from "./Battle";

/** The starter begins part-way through Lv5 so a win can level it up. */
const START_XP = xpForLevel(STARTER_LEVEL) + 70;
const FOE = { name: "Glitchit", level: 4, hp: 100, maxHp: 100, type: "process" } as const;
const noSub = () => () => {};

/** The practice battle: the player's starter (Bytling before one is chosen) vs a wild Glitchit. */
export function DemoBattle() {
  const save = useSave();
  // the starter lives in localStorage, so wait for the client before starting the battle
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;
  const starter = starterById(save.starter);
  return (
    <Battle
      player={{ art: STARTER_ART[starter.id], fighter: starterFighter(starter), xp: START_XP }}
      foe={{ art: GLITCHIT_ART, fighter: FOE, attack: "sync" }}
      questions={DEMO_QUESTIONS}
      lines={{ appear: "A wild GLITCHIT appeared!", counter: "Not quite! GLITCHIT bit back!", fainted: "The wild GLITCHIT fainted!", fled: "GLITCHIT scuttled away…" }}
      endActions={() => (
        <>
          <button type="button" onClick={() => location.reload()} className={END_BUTTON}>
            ▶ BATTLE AGAIN
          </button>
          <Link href="/map" className={END_BUTTON}>
            MAP
          </Link>
        </>
      )}
    />
  );
}
