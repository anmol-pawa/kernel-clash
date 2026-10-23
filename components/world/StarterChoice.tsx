"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { TypeBadge } from "@/components/ui/kit";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { EVOLVE_GYM, STARTERS, isEvolved, partnerForm, starterById, starterLevel, starterMaxHp, type Starter } from "@/content/starters";
import { GYMS } from "@/content/gyms";
import { sfx } from "@/game/audio/synth";
import { SUPER_EFFECTIVE } from "@/game/engine/types";
import { partnerArt } from "@/game/sprites/index";
import { PLATFORM } from "@/game/sprites/scenery";
import { updateSave, useSave, xpOf } from "@/lib/save";

const SKY = ["#1b1446", "#251a5c", "#33226e", "#4a2c7e", "#6b3a86", "#94508a", "#c46f86"];
const noSub = () => () => {};

/** A starter's place in the triangle: the types it beats and the types that beat it. */
function matchups(s: Starter) {
  return {
    strong: SUPER_EFFECTIVE.filter((m) => m.attack === s.type),
    weak: SUPER_EFFECTIVE.filter((m) => m.defend === s.type),
  };
}

/** One creature standing on its grass platform. */
function OnPlatform({ s, scale, evolved = false }: { s: Starter; scale: number; evolved?: boolean }) {
  return (
    <span className="relative flex flex-col items-center">
      <PixelSprite sprite={partnerArt(s, evolved).front} scale={scale} className="relative z-10 h-auto" style={{ marginBottom: -10 * scale }} />
      <PixelSprite sprite={PLATFORM} scale={scale * 1.1} className="h-auto" />
    </span>
  );
}

/** New-save starter choice: three creatures on platforms, a detail card, and a confirm button. */
export function StarterChoice() {
  const save = useSave();
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  const [pick, setPick] = useState(STARTERS[0].id);
  const [justChose, setJustChose] = useState(false);

  if (!hydrated) return <main className="h-dvh bg-[#100e24]" />;

  const chosen = save.starter ? starterById(save.starter) : null;
  const s = chosen ?? starterById(pick);
  const { strong, weak } = matchups(s);
  const evolved = !!chosen && isEvolved(chosen, save.evolved);
  const form = partnerForm(s, evolved);
  const S = form.name.toUpperCase();
  // the chosen partner shows its HP at its level; a starter on offer shows its Lv5 HP
  const hp = chosen ? starterMaxHp(s, starterLevel(xpOf(save, s.id)), evolved) : s.hp;
  const evolveBadge = GYMS.find((g) => g.id === EVOLVE_GYM)!.badge.toUpperCase();

  const choose = () => {
    sfx.levelUp();
    updateSave((v) => ({ ...v, starter: s.id }));
    setJustChose(true);
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(${SKY.map((c, i) => `${c} ${(i * 100) / SKY.length}% ${((i + 1) * 100) / SKY.length}%`).join(",")})` }} />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-[45%] bg-[#1d1640]" />

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] land:pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-2">
          <Link href="/" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
            ◀ TITLE
          </Link>
          <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">{chosen ? "YOUR PARTNER" : "CHOOSE A PARTNER"}</h1>
          <span className="w-12" />
        </header>

        {chosen ? (
          <div className="flex flex-col items-center gap-4 pt-4" data-testid="starter-chosen">
            <div className={justChose ? "badge-pop" : ""}>
              <OnPlatform s={chosen} scale={3} evolved={evolved} />
            </div>
            <p className="msg-box w-full p-4 font-pixel text-[11px] leading-6" aria-live="polite">
              {justChose ? `${S} is now your partner! Together you'll take on all nine gyms.` : `${S} is your partner. Keep going, the gyms are waiting!`}
            </p>
          </div>
        ) : (
          <>
            <p className="msg-box p-3 font-pixel text-[10px] leading-5 sm:text-[11px] sm:leading-6">Three creatures hatched in the boot sector. Each beats one of the others and loses to the third. Who will you train with?</p>
            <div className="flex items-end justify-center gap-1 sm:gap-4" role="radiogroup" aria-label="Starters">
              {STARTERS.map((st) => {
                const sel = st.id === s.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    aria-label={`${st.name}, ${st.type} type`}
                    data-testid={`starter-${st.id}`}
                    onClick={() => {
                      sfx.click();
                      setPick(st.id);
                    }}
                    className={`relative flex flex-col items-center rounded-[6px] px-1 pb-1 pt-2 transition-transform ${sel ? "-translate-y-2 outline-4 outline-[#ffe27a] [outline-style:dashed]" : "opacity-75"}`}
                  >
                    <span className="hidden sm:block">
                      <OnPlatform s={st} scale={2} />
                    </span>
                    <span className="hidden min-[360px]:block sm:hidden">
                      <OnPlatform s={st} scale={1.5} />
                    </span>
                    <span className="min-[360px]:hidden">
                      <OnPlatform s={st} scale={1.1} />
                    </span>
                    <span className="mt-1 font-pixel text-[9px] text-white pixel-shadow">{st.name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="gb-box flex flex-col gap-2 p-3" data-testid="starter-card" aria-live="polite">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 font-pixel text-[12px] leading-5">{S}</h2>
            <TypeBadge type={s.type} />
            <span className="font-pixel text-[9px]">HP {hp}</span>
          </div>
          <p className="text-[15px] leading-snug">{form.blurb}</p>
          {chosen ? (
            <p className="font-pixel text-[8px] leading-4 text-[#5a5078]" data-testid="evolve-note">
              {evolved ? `EVOLVED FROM ${s.name.toUpperCase()}` : `EVOLVES WITH THE ${evolveBadge}`}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1 text-[14px] leading-snug">
            {strong.map((m) => (
              <li key={`s-${m.defend}`}>
                <span className="font-pixel text-[8px] text-[#2f7a3a]">STRONG VS</span> <TypeBadge type={m.defend} small /> {m.why}
              </li>
            ))}
            {weak.map((m) => (
              <li key={`w-${m.attack}`}>
                <span className="font-pixel text-[8px] text-[#a83a3a]">WEAK TO</span> <TypeBadge type={m.attack} small /> {m.why}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* fixed bottom action bar (in the flow on short landscape screens, so it never covers the creatures) */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-xl land:static gap-2 bg-[#1d1640]/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {chosen ? (
          <Link href="/map" onClick={() => sfx.click()} className="gb-box flex min-h-12 flex-1 items-center justify-center font-pixel text-[11px]" style={{ background: "#ffe27a" }} data-testid="starter-to-map">
            ▶ TO THE REGION MAP
          </Link>
        ) : (
          <button type="button" onClick={choose} className="gb-box flex min-h-12 flex-1 items-center justify-center font-pixel text-[11px]" style={{ background: "#ffe27a" }} data-testid="starter-confirm">
            ▶ PARTNER UP WITH {S}
          </button>
        )}
      </div>
    </main>
  );
}
