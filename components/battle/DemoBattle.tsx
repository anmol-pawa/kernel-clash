"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { pixel } from "@/app/fonts";
import { HpBox, MenuChoice } from "@/components/ui/kit";
import { DEMO_QUESTIONS } from "@/content/demo";
import { sfx } from "@/game/audio/synth";
import { initialState, reducer } from "@/game/engine/battle";
import type { CreatureStage } from "@/game/render/stage";
import { BYTLING } from "@/game/sprites/bytling";
import { GLITCHIT } from "@/game/sprites/glitchit";

/** Seconds clock for answer timing (event handlers only). */
const clock = () => performance.now();

const PLAYER = { name: "Bytling", level: 5, hp: 60, maxHp: 60 };
const FOE = { name: "Glitchit", level: 4, hp: 100, maxHp: 100 };

/** The demo battle: Bytling vs a wild Glitchit, one OS question per turn. */
export function DemoBattle() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<CreatureStage | null>(null);
  const [s, dispatch] = useReducer(reducer, undefined, () => initialState(PLAYER, FOE, DEMO_QUESTIONS.length));
  const [msg, setMsg] = useState("A wild GLITCHIT appeared!");
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  // HP shown in the boxes: lags the reducer so bars drop on impact, not on tap
  const [shown, setShown] = useState({ player: PLAYER.hp, foe: FOE.hp });
  const askedAt = useRef(0);
  const q = DEMO_QUESTIONS[s.turn % DEMO_QUESTIONS.length];

  // mount the Pixi stage and play the intro
  useEffect(() => {
    let dead = false;
    let st: CreatureStage | null = null;
    (async () => {
      const { CreatureStage } = await import("@/game/render/stage");
      if (dead || !host.current) return;
      st = await CreatureStage.create(host.current, {
        player: BYTLING,
        foe: GLITCHIT,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        font: pixel.style.fontFamily,
      });
      if (dead) return st.destroy();
      stage.current = st;
      await st.intro();
      if (dead) return;
      setMsg("Go! BYTLING!");
      dispatch({ type: "ready" });
      askedAt.current = clock();
      setBusy(false);
    })();
    return () => {
      dead = true;
      st?.destroy();
      stage.current = null;
    };
  }, []);

  async function answer(i: number) {
    if (busy || s.phase !== "ask") return;
    setBusy(true);
    setPicked(i);
    const correct = i === q.answer;
    const seconds = (clock() - askedAt.current) / 1000;
    const next = reducer(s, { type: "answer", correct, power: q.move.power, seconds });
    dispatch({ type: "answer", correct, power: q.move.power, seconds });
    const st = stage.current;
    const last = next.last!;
    if (last.kind === "hit") {
      setMsg(`BYTLING used ${q.move.name.toUpperCase()}!`);
      sfx.cast(q.move.type);
      await st?.attack("player", q.move.type, last.damage, last.crit);
      sfx.hit(last.crit);
    } else {
      setMsg(`Not quite! GLITCHIT bit back!`);
      sfx.miss();
      await st?.attack("foe", "sync", last.damage, false);
      sfx.hurt();
    }
    setShown({ player: next.player.hp, foe: next.foe.hp });
    setMsg(q.explain);
    await new Promise((r) => setTimeout(r, 2200));
    const after = reducer(next, { type: "next" });
    if (after.phase === "victory") {
      await st?.faint("foe");
      sfx.victory();
      setMsg("The wild GLITCHIT fainted! You win!");
    } else if (after.phase === "defeat") {
      if (after.player.hp <= 0) await st?.faint("player");
      sfx.defeat();
      setMsg(after.player.hp <= 0 ? "BYTLING fainted…" : "GLITCHIT scuttled away…");
    } else setMsg("What will BYTLING do?");
    dispatch({ type: "next" });
    setPicked(null);
    askedAt.current = clock();
    setBusy(false);
  }

  const over = s.phase === "victory" || s.phase === "defeat";

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#100e24]">
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" data-testid="stage" />
        <HpBox name={s.foe.name} level={s.foe.level} hp={shown.foe} maxHp={s.foe.maxHp} className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] w-44 sm:w-56" />
        <HpBox name={s.player.name} level={s.player.level} hp={shown.player} maxHp={s.player.maxHp} showNumbers className="absolute bottom-3 right-3 w-44 sm:w-56" />
      </div>

      <section className="shrink-0 border-t-4 border-[var(--box-edge)] bg-[#2a2440] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl">
          <div className="gb-box min-h-[4.5rem] p-3 font-sans text-[16px] leading-5" aria-live="polite">
            {s.phase === "ask" && !busy ? q.prompt : msg}
          </div>
          {over ? (
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={() => location.reload()} className="gb-box min-h-12 flex-1 font-pixel text-[11px]">
                ▶ BATTLE AGAIN
              </button>
              <Link href="/" className="gb-box flex min-h-12 flex-1 items-center justify-center font-pixel text-[11px]">
                TITLE
              </Link>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((o, i) => (
                <MenuChoice key={i} onClick={() => answer(i)} disabled={busy || s.phase !== "ask"} state={picked === null ? undefined : i === q.answer ? "right" : i === picked ? "wrong" : undefined}>
                  {o}
                </MenuChoice>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
