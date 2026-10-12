"use client";
import Link from "next/link";
import { DEMO_QUESTIONS } from "@/content/demo";
import { xpForLevel } from "@/game/engine/xp";
import { BYTLING_ART } from "@/game/sprites/bytling";
import { GLITCHIT_ART } from "@/game/sprites/glitchit";
import { Battle, END_BUTTON } from "./Battle";

const PLAYER = { name: "Bytling", level: 5, hp: 60, maxHp: 60 };
/** Bytling starts part-way through Lv5 so a win can level it up. */
const START_XP = xpForLevel(5) + 70;
const FOE = { name: "Glitchit", level: 4, hp: 100, maxHp: 100 };

/** The practice battle: Bytling vs a wild Glitchit. */
export function DemoBattle() {
  return (
    <Battle
      player={{ art: BYTLING_ART, fighter: PLAYER, xp: START_XP }}
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
