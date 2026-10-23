"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { Gauge, TypeBadge } from "@/components/ui/kit";
import { dayKey, liveStreak, playedToday } from "@/game/engine/daily";
import { GYMS, MOCK_INTERVIEW_GYM } from "@/content/gyms";
import { dexCounts } from "@/content/kerneldex";
import { liveDeck } from "@/content/questionBank";
import { isEvolved, partnerForm, starterById, starterLevel, starterMaxHp } from "@/content/starters";
import { sfx } from "@/game/audio/synth";
import { xpForLevel, xpProgress } from "@/game/engine/xp";
import { partnerArt } from "@/game/sprites/index";
import { BADGES, GYM_H, GYM_SPOTS, GYM_W, MAP_H, MAP_MARKER, MAP_W, OVERWORLD } from "@/game/sprites/overworld";
import { dueKeys } from "@/game/engine/leitner";
import { gymFlow, gymState, nextGym } from "@/game/world/progress";
import { gridToRGBA, type SpriteSheet } from "@/lib/pixel";
import { GymFlowStrip, LockIcon } from "./GymFlow";
import { getSave, updateSave, useSave, xpOf, type SaveData } from "@/lib/save";

/** Draws a one-frame sheet into a canvas at 1:1; CSS scales it with nearest-neighbour. */
function PixelImage({ sheet, className }: { sheet: SpriteSheet; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const grid = sheet.idle[0];
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = new ImageData(gridToRGBA(sheet, grid) as Uint8ClampedArray<ArrayBuffer>, grid[0].length, grid.length);
    ctx.putImageData(img, 0, 0);
  }, [sheet, grid]);
  return <canvas ref={ref} width={grid[0].length} height={grid.length} className={className} role="img" aria-label={sheet.name} />;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** Opens the Kerneldex, with the seen / caught totals. */
function DexLink({ save }: { save: SaveData }) {
  const { seen, caught, total } = dexCounts(save);
  return (
    <Link href="/dex" onClick={() => sfx.click()} className="gb-box flex min-h-11 items-center justify-between gap-2 px-3 font-pixel text-[9px]" data-testid="dex-link">
      <span>▶ KERNELDEX</span>
      <span className="text-[#5a5078]">
        SEEN {seen} · CAUGHT {caught}/{total}
      </span>
    </Link>
  );
}

/** Opens the Leitner box, with how many cards are due. */
function ReviewLink({ save }: { save: SaveData }) {
  const [now] = useState(() => Date.now());
  const due = dueKeys(liveDeck(save.leitner), now).length;
  return (
    <Link href="/review" onClick={() => sfx.click()} className="gb-box flex min-h-11 items-center justify-between gap-2 px-3 font-pixel text-[9px]" data-testid="review-link">
      <span>▶ REVIEW</span>
      {due > 0 ? <span className="rounded-[2px] bg-[#e8566b] px-1.5 py-0.5 text-white">{due} DUE</span> : <span className="text-[#5a5078]">BOX</span>}
    </Link>
  );
}

/** Opens the timed mock interview, with the best score so far. */
function InterviewLink({ save }: { save: SaveData }) {
  const best = save.interviewBest;
  return (
    <Link href="/interview" onClick={() => sfx.click()} className="gb-box flex min-h-11 items-center justify-between gap-2 px-3 font-pixel text-[9px]" data-testid="interview-link">
      <span>▶ MOCK INTERVIEW</span>
      <span className="text-[#5a5078]">{best ? `BEST ${best.points}/${best.max}` : "10 Q"}</span>
    </Link>
  );
}

/** Opens the daily challenge, with the current streak. */
function DailyLink({ save }: { save: SaveData }) {
  const today = dayKey(new Date());
  const streak = liveStreak(save.daily, today);
  const played = playedToday(save.daily, today);
  return (
    <Link href="/daily" onClick={() => sfx.click()} className="gb-box flex min-h-11 items-center justify-between gap-2 px-3 font-pixel text-[9px]" data-testid="daily-link">
      <span>▶ DAILY</span>
      {played ? <span className="text-[#2f7a2a]">DONE · {streak}🔥</span> : <span className="rounded-[2px] bg-[#e8566b] px-1.5 py-0.5 text-white">NEW{streak > 0 ? ` · ${streak}🔥` : ""}</span>}
    </Link>
  );
}

/** The partner's level, HP and XP to the next level; taps through to the partner screen. */
function PartnerCard({ save }: { save: SaveData }) {
  const st = starterById(save.starter);
  const xp = xpOf(save, st.id);
  const level = starterLevel(xp);
  const evolved = isEvolved(st, save.evolved);
  const name = partnerForm(st, evolved).name;
  return (
    <Link href="/starter" className="gb-box flex items-center gap-3 px-2 py-1.5" data-testid="partner-card" aria-label={`Partner ${name}, level ${level}`}>
      <PixelSprite sprite={partnerArt(st, evolved).front} scale={1} className="-my-1 h-auto w-12 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 font-pixel text-[10px] leading-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate">{name.toUpperCase()}</span>
          <span className="shrink-0" data-testid="partner-level">
            <span className="text-[8px]">Lv</span>
            {level}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[8px]">
          <TypeBadge type={st.type} small />
          <span className="tabular-nums">HP {starterMaxHp(st, level, evolved)}</span>
        </div>
        <Gauge label="XP" pct={xpProgress(xp)} color="#40a8f8" thin labelColor="#9ad8ff" aria={{ name: `${name} XP`, now: xp, max: xpForLevel(level + 1) }} />
        <span className="text-right text-[8px] tabular-nums text-[#5a5078]">{xpForLevel(level + 1) - xp} XP TO Lv{level + 1}</span>
      </div>
    </Link>
  );
}

/** The region overworld: nine gyms on a pixel map, the badge case, and the selected gym's card. */
export function RegionMap() {
  const save = useSave();
  const next = nextGym(save.badges);
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? save.lastGym ?? next?.id ?? GYMS[GYMS.length - 1].id;
  const gym = GYMS.find((g) => g.id === selectedId) ?? GYMS[0];
  const flow = gymFlow(gym, save);
  const state = flow.state;
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const router = useRouter();

  // a new save starts by choosing a starter (the server snapshot never has one, so read the live save)
  useEffect(() => {
    if (!getSave().starter) router.replace("/starter");
  }, [router]);

  // open the map scrolled to the selected gym (gym 1 sits at the bottom of a tall map on phones)
  useEffect(() => {
    btnRefs.current[selectedId]?.scrollIntoView({ block: "center" });
    // only on first paint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: string) => {
    sfx.click();
    setPicked(id);
    updateSave((s) => ({ ...s, lastGym: id }));
  };

  const markerSpot = next ? GYM_SPOTS[next.n - 1] : GYM_SPOTS[8];
  const gymIndex = gym.n - 1;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 px-4 pb-[calc(13rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] lg:flex-row lg:items-start lg:gap-6 lg:pb-10">
      <div className="flex w-full max-w-[512px] flex-col gap-3 self-center lg:self-start">
        <header className="flex items-center justify-between gap-2">
          <Link href="/" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
            ◀ TITLE
          </Link>
          <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">REGION MAP</h1>
          <span className="font-pixel text-[10px] text-[#5eead4] pixel-shadow" data-testid="badge-count">
            {save.badges.length}/9
          </span>
        </header>

        {/* badge case */}
        <div className="gb-box flex items-center justify-between gap-1 px-2 py-2" aria-label="Badge case">
          {GYMS.map((g, i) => {
            const earned = save.badges.includes(g.id);
            return (
              <span key={g.id} title={earned ? g.badge : `${g.badge} (not earned)`} data-testid={`badge-${g.id}`} data-earned={earned} className={earned ? "" : "opacity-30 brightness-0"}>
                <PixelSprite sprite={BADGES[i]} scale={2} className="h-auto w-6 sm:w-7" />
              </span>
            );
          })}
        </div>

        {save.starter && <PartnerCard save={save} />}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <DexLink save={save} />
          <ReviewLink save={save} />
          <InterviewLink save={save} />
          <DailyLink save={save} />
        </div>

        {/* the map */}
        <div className="relative w-full overflow-hidden rounded-[6px] border-4 border-[#1a1430] shadow-[0_4px_0_#0006]" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
          <PixelImage sheet={OVERWORLD} className="pixelated absolute inset-0 h-full w-full" />
          {GYMS.map((g, i) => {
            const [dx, dy] = GYM_SPOTS[i];
            const st = gymState(g, save.badges);
            const sel = g.id === gym.id;
            return (
              <button
                key={g.id}
                ref={(el) => {
                  btnRefs.current[g.id] = el;
                }}
                type="button"
                onClick={() => pick(g.id)}
                aria-label={`Gym ${g.n}: ${g.name} (${st})`}
                aria-pressed={sel}
                data-testid={`gym-${g.id}`}
                data-state={st}
                className="absolute flex items-start justify-center"
                style={{ left: pct(dx - GYM_W / 2 - 2, MAP_W), top: pct(dy - GYM_H - 3, MAP_H), width: pct(GYM_W + 4, MAP_W), height: pct(GYM_H + 5, MAP_H) }}
              >
                <span className={`absolute inset-0 rounded-[4px] ${sel ? "outline-4 outline-[#ffe27a] [outline-style:dashed]" : ""}`} />
                <span className="absolute -top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[3px] border-2 border-[#1a1430] bg-[var(--box)] px-1 font-pixel text-[8px] leading-3 text-[var(--box-ink)]">
                  {g.n}
                  {st === "locked" && <LockIcon />}
                  {st === "cleared" && <PixelSprite sprite={BADGES[i]} scale={1} className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
          {/* the player's marker, standing on the road at the next gym's door */}
          <PixelSprite
            sprite={MAP_MARKER}
            scale={1}
            className="pointer-events-none absolute h-auto"
            data-testid="map-marker"
            // the marker is 14×15 map pixels; place it just south-east of the door
            style={{ left: pct(markerSpot[0] + 3, MAP_W), top: pct(markerSpot[1] - 9, MAP_H), width: pct(14, MAP_W) }}
          />
        </div>
      </div>

      {/* selected gym card: a fixed bottom sheet on phones, a side panel on desktop */}
      <section
        className="msg-box fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-20 flex max-h-[13rem] flex-col gap-2 overflow-y-auto p-3 lg:sticky lg:top-4 lg:inset-x-auto lg:max-h-none lg:flex-1 lg:p-5"
        aria-live="polite"
        data-testid="gym-card"
      >
        <div className="flex items-center gap-2">
          <PixelSprite sprite={BADGES[gymIndex]} scale={2} className={`h-auto w-7 shrink-0 ${state === "cleared" ? "" : "opacity-40 grayscale"}`} />
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-[8px] leading-4 text-[#8a3a3a]">
              GYM {gym.n} · {gym.chapter.toUpperCase()}
            </p>
            <h2 className="truncate font-pixel text-[12px] leading-5">{gym.name.toUpperCase()}</h2>
          </div>
          <TypeBadge type={gym.type} />
        </div>
        <p className="text-[14px] leading-snug">
          <span className="font-pixel text-[9px]">BOSS {gym.boss.name.toUpperCase()}</span> — {gym.boss.blurb}
        </p>
        <ul className="hidden flex-wrap gap-1 lg:flex" aria-label="Topics">
          {gym.topics.map((t) => (
            <li key={t} className="rounded-[3px] border-2 border-[var(--box-edge)] px-1.5 py-0.5 text-[13px]">
              {t}
            </li>
          ))}
        </ul>
        <p className="hidden text-[13px] lg:block">
          Reward: <b>{gym.badge}</b>
        </p>
        {state !== "locked" && (flow.lessons.total > 0 || flow.trainers.total > 0) && <GymFlowStrip flow={flow} />}
        {state === "locked" ? (
          <p className="flex min-h-12 items-center justify-center gap-2 rounded-[4px] border-4 border-dashed border-[#b9b0d8] px-2 text-center font-pixel text-[9px] leading-4 text-[#6e6a8e]" data-testid="gym-action">
            <LockIcon /> EARN THE {GYMS[gymIndex - 1].badge.toUpperCase()} FIRST
          </p>
        ) : (
          <div className="flex gap-2">
            <Link
              href={flow.bossReady ? `/gym/${gym.id}` : `/gym/${gym.id}/trainer`}
              onClick={() => sfx.click()}
              className="flex min-h-12 flex-[2] items-center justify-center rounded-[4px] border-4 border-[var(--box-edge)] bg-[#ffe27a] px-2 text-center font-pixel text-[10px] leading-4 text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0002] hover:bg-[#fff0a0]"
              data-testid="gym-action"
            >
              {flow.bossReady
                ? `${state === "cleared" ? "▶ REMATCH" : "▶ CHALLENGE"} ${gym.boss.name.toUpperCase()}`
                : `▶ TRAINER ${gym.trainer!.name.toUpperCase()} ${flow.trainers.won + 1}/${flow.trainers.total}`}
            </Link>
            {flow.lessons.total > 0 && (
              <Link
                href={`/learn/${gym.id}`}
                onClick={() => sfx.click()}
                className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-[4px] border-4 border-[var(--box-edge)] bg-white px-1 font-pixel text-[9px] leading-3 text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0002] hover:bg-[#f0ecff]"
                data-testid="gym-learn"
              >
                LEARN
                <span className="text-[7px] text-[#5a5078]">
                  {flow.lessons.done}/{flow.lessons.total}
                </span>
              </Link>
            )}
            {gym.id === MOCK_INTERVIEW_GYM && (
              <Link
                href="/interview"
                onClick={() => sfx.click()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-[4px] border-4 border-[var(--box-edge)] bg-white px-1 text-center font-pixel text-[9px] leading-3 text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0002] hover:bg-[#f0ecff]"
                data-testid="gym-interview"
              >
                MOCK
              </Link>
            )}
            <Link
              href="/battle"
              onClick={() => sfx.click()}
              className="flex min-h-12 flex-1 items-center justify-center rounded-[4px] border-4 border-[var(--box-edge)] bg-white px-2 font-pixel text-[9px] text-[var(--box-ink)] shadow-[inset_0_-3px_0_#0002] hover:bg-[#f0ecff]"
              data-testid="gym-train"
            >
              TRAIN
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
