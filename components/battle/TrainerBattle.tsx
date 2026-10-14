"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { GYMS } from "@/content/gyms";
import { gymBattleQuestions } from "@/content/pools";
import { isEvolved, starterById, starterFighter, starterMaxHp } from "@/content/starters";
import { sfx } from "@/game/audio/synth";
import { TRAINER_BATTLES, TRAINER_TURNS, trainerFighter } from "@/game/world/gymBattle";
import { gymState } from "@/game/world/progress";
import { TRAINERS, partnerArt } from "@/game/sprites/index";
import { saveTrainerWin, saveXp, trainerWins, useSave, xpOf } from "@/lib/save";
import { Battle, END_BUTTON, type Script } from "./Battle";
import { GymLocked, NoStarter } from "./GymGates";

const noSub = () => () => {};

/**
 * A battle against a gym's trainer creature: four questions from the gym's
 * pool. The gym's boss waits for TRAINER_BATTLES wins; after that the trainer
 * is still there for rematches.
 */
export function TrainerBattle({ gymId }: { gymId: string }) {
  const gym = GYMS.find((g) => g.id === gymId)!;
  const trainer = gym.trainer!;
  const save = useSave();
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  // seeds the draw from the gym's pool; Battle keeps the questions it mounted with
  const [startedAt] = useState(() => Date.now());
  // which battle this is, fixed when the battle mounts (a win bumps the saved count)
  const [round, setRound] = useState<number | null>(null);
  const wins = trainerWins(save, gym.id);
  const T = trainer.name.toUpperCase();
  const B = gym.boss.name.toUpperCase();

  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;
  if (!save.starter) return <NoStarter />;
  if (gymState(gym, save.badges) === "locked") return <GymLocked gym={gym} />;
  if (round === null) {
    setRound(Math.min(wins + 1, TRAINER_BATTLES));
    return <main className="h-dvh bg-[#100e24]" />;
  }

  const starter = starterById(save.starter);
  const partnerXp = xpOf(save, starter.id);
  const evolved = isEvolved(starter, save.evolved);
  const rematch = wins >= TRAINER_BATTLES && round === TRAINER_BATTLES;

  async function onVictory({ say, pause }: Script) {
    const before = trainerWins(save, gym.id);
    const now = saveTrainerWin(gym.id);
    if (before >= TRAINER_BATTLES) {
      await say(`${T} is ready for a rematch any time.`);
      return;
    }
    sfx.levelUp();
    await say(`Trainer battles won: ${now}/${TRAINER_BATTLES}.`);
    await pause();
    await say(now < TRAINER_BATTLES ? `${T} flaps back to its perch. One more battle before ${B}!` : `${B} will now accept your challenge!`);
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
      foe={{ art: TRAINERS[gym.id], fighter: trainerFighter(gym, round), attack: gym.type }}
      questions={gymBattleQuestions(gym.id, Math.floor(startedAt / 1000), save.leitner, startedAt, TRAINER_TURNS)}
      lines={{
        appear: rematch ? `GYM TRAINER ${T} wants a rematch!` : `GYM TRAINER ${T} wants to battle! (${round}/${TRAINER_BATTLES})`,
        counter: `Wrong! ${T} strikes back!`,
        fainted: `${T} was defeated!`,
        fled: `${T} is still flying… You ran out of questions.`,
      }}
      onVictory={onVictory}
      endActions={(won) =>
        won ? (
          wins < TRAINER_BATTLES ? (
            <>
              <button type="button" onClick={() => location.reload()} className={`${END_BUTTON} flex-[2]! bg-[#ffe27a]! px-2`} data-testid="next-trainer">
                ▶ NEXT BATTLE ({wins + 1}/{TRAINER_BATTLES})
              </button>
              <Link href="/map" className={END_BUTTON}>
                MAP
              </Link>
            </>
          ) : (
            <>
              <Link href={`/gym/${gym.id}`} className={`${END_BUTTON} flex-[2]! bg-[#ffe27a]! px-2`} data-testid="to-boss">
                ▶ CHALLENGE {B}
              </Link>
              <Link href="/map" className={END_BUTTON}>
                MAP
              </Link>
            </>
          )
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
