import Link from "next/link";
import type { Gym } from "@/content/gyms";
import { GYMS } from "@/content/gyms";
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
