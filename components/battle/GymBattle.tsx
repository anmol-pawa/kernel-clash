"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { GYMS } from "@/content/gyms";
import { gymBattleQuestions } from "@/content/pools";
import { isEvolved, shouldEvolve, starterById, starterFighter, starterLevel, starterMaxHp } from "@/content/starters";
import { sfx } from "@/game/audio/synth";
import { bossFighter } from "@/game/world/gymBattle";
import { earnBadge, gymFlow, nextGym } from "@/game/world/progress";
import { BOSSES, EVOLVED_ART, partnerArt } from "@/game/sprites/index";
import { BADGES } from "@/game/sprites/overworld";
import { getSave, saveEvolved, saveXp, updateSave, useSave, xpOf } from "@/lib/save";
import { Battle, END_BUTTON, type Script } from "./Battle";
import { BossGated, GymLocked, NoStarter } from "./GymGates";

const noSub = () => () => {};

/** A gym's boss battle. Winning earns the gym's badge and opens the next gym. */
export function GymBattle({ gymId }: { gymId: string }) {
  const gym = GYMS.find((g) => g.id === gymId)!;
  const save = useSave();
  // the save lives in localStorage, so wait for the client before deciding
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  const [badgeShown, setBadgeShown] = useState(false);
  const [unlocked, setUnlocked] = useState<string | null>(null);
  // seeds the draw from the gym's pool; Battle keeps the questions it mounted with
  const [startedAt] = useState(() => Date.now());
  // winning only ever turns open → cleared (and trainer wins don't change mid-battle), so this never swaps the battle out
  const flow = hydrated ? gymFlow(gym, save) : null;
  const entry = flow?.state ?? null;
  const B = gym.boss.name.toUpperCase();

  if (!entry) return <main className="h-dvh bg-[#100e24]" />;

  if (!save.starter) return <NoStarter />;
  const starter = starterById(save.starter);
  // Battle reads these once at mount, so saving XP after a win leaves the running battle alone
  const partnerXp = xpOf(save, starter.id);
  const evolved = isEvolved(starter, save.evolved);

  if (entry === "locked") return <GymLocked gym={gym} />;
  if (!flow!.bossReady) return <BossGated gym={gym} flow={flow!} />;

  async function onVictory(script: Script) {
    const { say } = script;
    const had = save.badges.includes(gym.id);
    const badges = earnBadge(save.badges, gym.id);
    const next = nextGym(badges);
    // the map reopens on the gym that just unlocked
    updateSave((s) => ({ ...s, badges: earnBadge(s.badges, gym.id), lastGym: next?.id ?? gym.id }));
    if (had) {
      await say(`You beat ${B} again! The ${gym.badge.toUpperCase()} shines brighter.`);
    } else {
      await newBadge(script, next);
    }
    if (shouldEvolve(starter, badges, save.evolved)) await evolve(script);
  }

  /** The partner evolves (saved first, so leaving mid-sequence keeps it). */
  async function evolve({ say, pause, evolve: morph }: Script) {
    const from = starter.name.toUpperCase();
    const to = starter.evolution.name.toUpperCase();
    saveEvolved(starter.id);
    await pause();
    setBadgeShown(false);
    await say(`What? ${from} is evolving!`);
    await pause();
    const level = starterLevel(xpOf(getSave(), starter.id));
    await morph({ art: EVOLVED_ART[starter.evolution.id], name: starter.evolution.name, maxHp: starterMaxHp(starter, level, true) });
    await say(`Congratulations! ${from} evolved into ${to}!`);
    await pause();
    await say(`${to}'s MAX HP rose by ${starterMaxHp(starter, level, true) - starterMaxHp(starter, level)}.`);
    await pause();
  }

  async function newBadge({ say, pause, wait }: Script, next: ReturnType<typeof nextGym>) {
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
      player={{
        art: partnerArt(starter, evolved),
        fighter: starterFighter(starter, partnerXp, evolved),
        xp: partnerXp,
        maxHpAt: (l) => starterMaxHp(starter, l, evolved),
        onXp: (total) => saveXp(starter.id, total),
      }}
      foe={{ art: BOSSES[gym.id], fighter: bossFighter(gym), attack: gym.type }}
      questions={gymBattleQuestions(gym.id, Math.floor(startedAt / 1000), save.leitner, startedAt)}
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
          <Link href="/map" className={`${END_BUTTON} bg-[#ffe27a]!`} data-testid="to-map">
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
