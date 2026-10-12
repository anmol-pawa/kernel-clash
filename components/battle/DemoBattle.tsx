"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { pixel } from "@/app/fonts";
import { HpBox, MenuChoice, MessageBox, MoveInfo } from "@/components/ui/kit";
import { DEMO_QUESTIONS } from "@/content/demo";
import { sfx } from "@/game/audio/synth";
import { initialState, reducer } from "@/game/engine/battle";
import { levelFor, xpForLevel, xpProgress, xpYield } from "@/game/engine/xp";
import type { CreatureStage } from "@/game/render/stage";
import { BYTLING_ART } from "@/game/sprites/bytling";
import { GLITCHIT_ART } from "@/game/sprites/glitchit";
import { useTypewriter } from "@/lib/typewriter";

const noSub = () => () => {};
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Seconds clock for answer timing (event handlers only). */
const clock = () => performance.now();

const PLAYER = { name: "Bytling", level: 5, hp: 60, maxHp: 60 };
/** Bytling starts part-way through Lv5 so a win can level it up. */
const START_XP = xpForLevel(5) + 70;
const FOE = { name: "Glitchit", level: 4, hp: 100, maxHp: 100 };

/** The demo battle: Bytling vs a wild Glitchit, one OS question per turn. */
export function DemoBattle() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<CreatureStage | null>(null);
  const [s, dispatch] = useReducer(reducer, undefined, () => initialState(PLAYER, FOE, DEMO_QUESTIONS.length));
  const reduced = useSyncExternalStore(noSub, prefersReducedMotion, () => false);
  const [msg, setMsg] = useState({ text: "A wild GLITCHIT appeared!", id: 0 });
  const [waiting, setWaiting] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  // HP shown in the boxes: lags the reducer so bars drop on impact, not on tap
  const [shown, setShown] = useState({ player: PLAYER.hp, foe: FOE.hp });
  const [xp, setXp] = useState(START_XP);
  const askedAt = useRef(0);
  const typed = useRef<(() => void) | null>(null);
  const tapped = useRef<(() => void) | null>(null);
  const q = DEMO_QUESTIONS[s.turn % DEMO_QUESTIONS.length];
  const tw = useTypewriter(msg.text, { instant: reduced, onTick: sfx.blip });

  // resolve say() once its text has finished typing
  useEffect(() => {
    if (tw.done && typed.current) {
      const r = typed.current;
      typed.current = null;
      r();
    }
  }, [tw.done, msg.id]);

  /** Type a message out; resolves when it's fully shown. */
  const say = (text: string) =>
    new Promise<void>((r) => {
      typed.current = r;
      setMsg((m) => ({ text, id: m.id + 1 }));
    });
  /** Wait for a tap on the message box (the blinking ▼). */
  const pause = () =>
    new Promise<void>((r) => {
      setWaiting(true);
      tapped.current = () => {
        setWaiting(false);
        r();
      };
    });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function tap() {
    if (!tw.done) return tw.skip();
    const r = tapped.current;
    tapped.current = null;
    if (r) {
      sfx.click();
      r();
    }
  }

  // mount the Pixi stage and play the intro
  useEffect(() => {
    let dead = false;
    let st: CreatureStage | null = null;
    (async () => {
      const { CreatureStage } = await import("@/game/render/stage");
      if (dead || !host.current) return;
      st = await CreatureStage.create(host.current, {
        player: BYTLING_ART,
        foe: GLITCHIT_ART,
        reducedMotion: reduced,
        font: pixel.style.fontFamily,
      });
      if (dead) return st.destroy();
      stage.current = st;
      await st.intro();
      if (dead) return;
      await say("Go! BYTLING!");
      await wait(500);
      if (dead) return;
      dispatch({ type: "ready" });
      setMsg((m) => ({ text: DEMO_QUESTIONS[0].prompt, id: m.id + 1 }));
      askedAt.current = clock();
      setBusy(false);
    })();
    return () => {
      dead = true;
      st?.destroy();
      stage.current = null;
    };
  }, [reduced]);

  async function answer(i: number) {
    if (busy || s.phase !== "ask") return;
    setBusy(true);
    setPicked(i);
    const correct = i === q.answer;
    const seconds = Math.max(0, (clock() - askedAt.current) / 1000);
    const next = reducer(s, { type: "answer", correct, power: q.move.power, seconds });
    dispatch({ type: "answer", correct, power: q.move.power, seconds });
    const st = stage.current;
    const last = next.last!;
    if (last.kind === "hit") {
      sfx.cast(q.move.type);
      await Promise.all([say(`BYTLING used ${q.move.name.toUpperCase()}!`), st?.attack("player", q.move.type, last.damage, last.crit).then(() => sfx.hit(last.crit))]);
      setShown((v) => ({ ...v, foe: next.foe.hp }));
      if (last.crit) await say("A critical hit!").then(() => wait(600));
    } else {
      sfx.miss();
      await say("Not quite! GLITCHIT bit back!");
      await st?.attack("foe", "sync", last.damage, false);
      sfx.hurt();
      setShown((v) => ({ ...v, player: next.player.hp }));
    }
    await say(q.explain);
    await pause();
    const after = reducer(next, { type: "next" });
    if (after.phase === "victory") {
      await st?.faint("foe");
      sfx.victory();
      await say("The wild GLITCHIT fainted!");
      await pause();
      const gain = xpYield(FOE.level);
      const from = levelFor(xp);
      setXp(xp + gain);
      await say(`BYTLING gained ${gain} XP!`);
      await wait(900);
      if (levelFor(xp + gain) > from) {
        sfx.levelUp();
        await say(`BYTLING grew to Lv${levelFor(xp + gain)}!`);
      }
    } else if (after.phase === "defeat") {
      if (after.player.hp <= 0) await st?.faint("player");
      sfx.defeat();
      await say(after.player.hp <= 0 ? "BYTLING fainted…" : "GLITCHIT scuttled away…");
    } else {
      setMsg((m) => ({ text: DEMO_QUESTIONS[after.turn % DEMO_QUESTIONS.length].prompt, id: m.id + 1 }));
      askedAt.current = clock();
    }
    dispatch({ type: "next" });
    setPicked(null);
    setBusy(false);
  }

  const over = s.phase === "victory" || s.phase === "defeat";
  const level = levelFor(xp);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#100e24]">
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" data-testid="stage" />
        <HpBox name={s.foe.name} level={s.foe.level} hp={shown.foe} maxHp={s.foe.maxHp} className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] w-44 sm:left-6 sm:w-60" />
        <HpBox name={s.player.name} level={level} hp={shown.player} maxHp={s.player.maxHp} xp={xpProgress(xp)} side="player" className="absolute bottom-3 right-3 w-48 sm:right-6 sm:w-64" />
      </div>

      <section className="shrink-0 border-t-4 border-[#1f1a3a] bg-[#2a2440] p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-3">
        <div className="mx-auto grid max-w-5xl gap-2.5 lg:grid-cols-2 lg:items-start">
          <MessageBox waiting={waiting} onTap={tap}>
            {tw.shown}
          </MessageBox>
          {over && !busy ? (
            <div className="flex gap-2.5 lg:h-full lg:flex-col">
              <button type="button" onClick={() => location.reload()} className="gb-box min-h-12 flex-1 font-pixel text-[11px]">
                ▶ BATTLE AGAIN
              </button>
              <Link href="/" className="gb-box flex min-h-12 flex-1 items-center justify-center font-pixel text-[11px]">
                TITLE
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <MoveInfo {...q.move} />
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2" data-testid="menu">
                {q.options.map((o, i) => (
                  <MenuChoice
                    key={i}
                    tag={"ABCD"[i]}
                    onClick={() => answer(i)}
                    disabled={busy || s.phase !== "ask"}
                    state={picked === null ? undefined : i === q.answer ? "right" : i === picked ? "wrong" : undefined}
                  >
                    {o}
                  </MenuChoice>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
