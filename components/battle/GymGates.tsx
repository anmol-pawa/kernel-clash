import Link from "next/link";
import type { Gym } from "@/content/gyms";
import { GYMS } from "@/content/gyms";
import { TRAINERS } from "@/game/sprites/index";
import type { GymFlow } from "@/game/world/progress";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { GymFlowStrip } from "@/components/world/GymFlow";
import { END_BUTTON } from "./Battle";

/** Shown in place of a gym battle when the save has no partner yet. */
export function NoStarter() {
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

/** Shown in place of a gym battle while an earlier gym's badge is missing. */
export function GymLocked({ gym }: { gym: Gym }) {
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

/** Shown in place of a boss battle until the gym's trainer battles are won. */
export function BossGated({ gym, flow }: { gym: Gym; flow: GymFlow }) {
  const left = flow.trainers.total - flow.trainers.won;
  const T = gym.trainer!.name.toUpperCase();
  return (
    <main className="flex h-dvh items-center justify-center bg-[#100e24] p-4">
      <div className="msg-box flex w-full max-w-sm flex-col items-center gap-3 p-4 text-center" data-testid="boss-gated">
        <PixelSprite sprite={TRAINERS[gym.id].front} scale={2} className="h-auto w-32" />
        <p className="font-pixel text-[11px] leading-5">{gym.boss.name.toUpperCase()} WON&apos;T FACE YOU YET</p>
        <p className="text-[15px]">
          GYM TRAINER <b>{gym.trainer!.name}</b> guards the way. Win {left} more trainer battle{left === 1 ? "" : "s"} first.
        </p>
        <GymFlowStrip flow={flow} className="justify-center" />
        <div className="flex w-full gap-2">
          <Link href={`/gym/${gym.id}/trainer`} className={`${END_BUTTON} flex-[2]! bg-[#ffe27a]! px-2 text-[9px]!`} data-testid="gated-trainer">
            ▶ BATTLE {T}
          </Link>
          <Link href="/map" className={END_BUTTON}>
            MAP
          </Link>
        </div>
      </div>
    </main>
  );
}
