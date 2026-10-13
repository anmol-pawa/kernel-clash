"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { DEMO_QUESTIONS } from "@/content/demo";
import { isEvolved, starterById, starterFighter, starterMaxHp } from "@/content/starters";
import { GLITCHIT_ART } from "@/game/sprites/glitchit";
import { partnerArt } from "@/game/sprites/index";
import { saveXp, useSave, xpOf } from "@/lib/save";
import { Battle, END_BUTTON } from "./Battle";

const FOE = { name: "Glitchit", level: 4, hp: 100, maxHp: 100, type: "process" } as const;
const noSub = () => () => {};

/** The practice battle: the player's starter (Bytling before one is chosen) vs a wild Glitchit. */
export function DemoBattle() {
  const save = useSave();
  // the starter lives in localStorage, so wait for the client before starting the battle
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;
  const starter = starterById(save.starter);
  // Battle reads these once at mount, so saving XP after a win leaves the running battle alone
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
