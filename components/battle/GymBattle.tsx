"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { STARTER_LEVEL, starterById, starterFighter } from "@/content/starters";
import { sfx } from "@/game/audio/synth";
import { xpForLevel } from "@/game/engine/xp";
import { bossFighter } from "@/game/world/gymBattle";
import { earnBadge, gymState, nextGym } from "@/game/world/progress";
import { BOSSES, STARTER_ART } from "@/game/sprites/index";
import { BADGES } from "@/game/sprites/overworld";
import { updateSave, useSave } from "@/lib/save";
import { Battle, END_BUTTON, type Script } from "./Battle";

const START_XP = xpForLevel(STARTER_LEVEL) + 70;
const noSub = () => () => {};

/** A gym's boss battle. Winning earns the gym's badge and opens the next gym. */
export function GymBattle({ gymId }: { gymId: string }) {
  const gym = GYMS.find((g) => g.id === gymId)!;
  const save = useSave();
  // the save lives in localStorage, so wait for the client before deciding
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  const [badgeShown, setBadgeShown] = useState(false);
  const [unlocked, setUnlocked] = useState<string | null>(null);
  // winning only ever turns open → cleared, so this never swaps the battle out
  const entry = hydrated ? gymState(gym, save.badges) : null;
  const B = gym.boss.name.toUpperCase();

  if (!entry) return <main className="h-dvh bg-[#100e24]" />;

  if (!save.starter) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#100e24] p-4">
        <div className="msg-box flex max-w-sm flex-col gap-3 p-4 text-center" data-testid="gym-no-starter">
          <p className="font-pixel text-[11px] leading-5">NO PARTNER YET</p>
          <p className="text-[15px]">You can&apos;t take on a gym alone. Choose your first creature!</p>
          <Link href="/starter" className={END_BUTTON}>
            ▶ CHOOSE A STARTER
          </Link>
        </div>
      </main>
    );
  }
  const starter = starterById(save.starter);

  if (entry === "locked") {
    const prev = GYMS[gym.n - 2];
    return (
      <main className="flex h-dvh items-center justify-center bg-[#100e24] p-4">
        <div className="msg-box flex max-w-sm flex-col gap-3 p-4 text-center" data-testid="gym-locked">
          <p className="font-pixel text-[11px] leading-5">{gym.name.toUpperCase()} IS LOCKED</p>
          <p className="text-[15px]">
            The doors won&apos;t open until you earn the <b>{prev.badge}</b> at the {prev.name}.
          </p>
          <Link href="/map" className={END_BUTTON}>
            ◀ BACK TO MAP
          </Link>
        </div>
      </main>
    );
  }

  async function onVictory({ say, pause, wait }: Script) {
    const had = save.badges.includes(gym.id);
    const badges = earnBadge(save.badges, gym.id);
    const next = nextGym(badges);
    // the map reopens on the gym that just unlocked
    updateSave((s) => ({ ...s, badges: earnBadge(s.badges, gym.id), lastGym: next?.id ?? gym.id }));
    if (had) {
      await say(`You beat ${B} again! The ${gym.badge.toUpperCase()} shines brighter.`);
      return;
    }
    setBadgeShown(true);
    sfx.levelUp();
    await say(`You earned the ${gym.badge.toUpperCase()}!`);
    await pause();
    if (next) {
      setUnlocked(next.id);
      await say(`The ${next.name.toUpperCase()} is now open on the map!`);
    } else {
      await say("Every badge is yours. You are the KERNEL CHAMPION!");
    }
    await wait(300);
  }

  return (
    <Battle
      player={{ art: STARTER_ART[starter.id], fighter: starterFighter(starter), xp: START_XP }}
      foe={{ art: BOSSES[gym.id], fighter: bossFighter(gym), attack: gym.type }}
      questions={GYM_QUESTIONS[gym.id]}
      lines={{
        appear: `GYM BOSS ${B} blocks the way!`,
        counter: `Wrong! ${B} strikes back!`,
        fainted: `${B} was defeated!`,
        fled: `${B} is still standing… You ran out of questions.`,
      }}
      onVictory={onVictory}
      overlay={
        badgeShown ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" data-testid="badge-award">
            <div className="relative flex flex-col items-center gap-2">
              <div className="badge-rays absolute left-1/2 top-[48px] -ml-[90px] -mt-[90px] h-[180px] w-[180px] rounded-full" />
              <PixelSprite sprite={BADGES[gym.n - 1]} scale={7} className="badge-pop relative drop-shadow-[0_4px_0_#0008]" />
              <p className="msg-box relative px-3 py-1.5 font-pixel text-[10px]">{gym.badge.toUpperCase()}</p>
            </div>
          </div>
        ) : null
      }
      endActions={(won) =>
        won ? (
          <Link href="/map" className={`${END_BUTTON} bg-[#ffe27a]`} data-testid="to-map">
            {unlocked ? "▶ ONWARD (MAP)" : "▶ BACK TO MAP"}
          </Link>
        ) : (
          <>
            <button type="button" onClick={() => location.reload()} className={END_BUTTON}>
              ▶ TRY AGAIN
            </button>
            <Link href="/map" className={END_BUTTON}>
              MAP
            </Link>
          </>
        )
      }
    />
  );
}
