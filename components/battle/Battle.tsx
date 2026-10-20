"use client";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { pixel } from "@/app/fonts";
import { HpBox, MessageBox, MoveInfo } from "@/components/ui/kit";
import { sfx } from "@/game/audio/synth";
import { initialState, reducer, type Fighter } from "@/game/engine/battle";
import { answerText, grade, kindOf, type Question, type Response } from "@/game/engine/question";
import { effectiveness, effectMessage, superReason, type MoveType } from "@/game/engine/types";
import { levelFor, xpForLevel, xpProgress, xpYield } from "@/game/engine/xp";
import type { CreatureStage } from "@/game/render/stage";
import type { CreatureArt } from "@/lib/creature";
import { cardKey, dueFirst } from "@/game/engine/leitner";
import { getSave, markCaught, markSeen, recordAnswer } from "@/lib/save";
import { useTypewriter } from "@/lib/typewriter";
import { GanttChart } from "@/components/lesson/Gantt";
import { AnswerPanel, type Reveal } from "./AnswerPanel";

const noSub = () => () => {};
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Seconds clock for answer timing (event handlers only). */
const clock = () => performance.now();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Message helpers handed to `onVictory` so callers can script extra lines. */
export interface Script {
  say: (text: string) => Promise<void>;
  pause: () => Promise<void>;
  wait: (ms: number) => Promise<unknown>;
  /** play the evolve morph into `art`; the player's box then shows the new name and max HP */
  evolve: (to: { art: CreatureArt; name: string; maxHp: number }) => Promise<void>;
}

export interface BattleProps {
  /** `maxHpAt` gives max HP at a level (for level-ups); `onXp` saves the new XP total after a win */
  player: { art: CreatureArt; fighter: Fighter; xp: number; maxHpAt?: (level: number) => number; onXp?: (total: number) => void };
  foe: { art: CreatureArt; fighter: Fighter; attack: MoveType };
  questions: Question[];
  /** ask questions whose Leitner cards are due first (gym battles) */
  dueFirst?: boolean;
  lines: { appear: string; counter: string; fainted: string; fled: string };
  /** runs after the XP lines of a win, e.g. to award a badge */
  onVictory?: (s: Script) => Promise<void>;
  /** buttons shown once the battle is over */
  endActions: (won: boolean) => ReactNode;
  /** drawn over the stage (e.g. a badge being awarded) */
  overlay?: ReactNode;
  /** gym id whose battle backdrop to paint (kernel city when absent) */
  scene?: string;
}

/** A question battle: the player's creature vs one foe, one OS question per turn. */
export function Battle({ player, foe, questions: given, dueFirst: due, lines, onVictory, endActions, overlay, scene }: BattleProps) {
  const host = useRef<HTMLDivElement>(null);
  // fixed at mount: generated questions must not change when a win saves XP
  const [questions] = useState(() => (due ? dueFirst(given, getSave().leitner, Date.now()) : given));
  const stage = useRef<CreatureStage | null>(null);
  const [s, dispatch] = useReducer(reducer, undefined, () => initialState(player.fighter, foe.fighter, questions.length));
  const reduced = useSyncExternalStore(noSub, prefersReducedMotion, () => false);
  const [msg, setMsg] = useState({ text: lines.appear, id: 0 });
  const [waiting, setWaiting] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(true);
  /** true while the explanation is up, so a scheduling chart can show over the stage */
  const [explaining, setExplaining] = useState(false);
  // HP shown in the boxes: lags the reducer so bars drop on impact, not on tap
  const [shown, setShown] = useState({ player: player.fighter.hp, foe: foe.fighter.hp });
  const [xp, setXp] = useState(player.xp);
  // max HP shown in the player's box: grows on a level-up after a win
  const [maxHp, setMaxHp] = useState(player.fighter.maxHp);
  // the player's name in its box: changes if it evolves after a win
  const [playerName, setPlayerName] = useState(player.fighter.name);
  const askedAt = useRef(0);
  const typed = useRef<(() => void) | null>(null);
  const tapped = useRef<(() => void) | null>(null);
  const q = questions[s.turn % questions.length];
  const tw = useTypewriter(msg.text, { instant: reduced, onTick: sfx.blip });
  const P = player.fighter.name.toUpperCase();

  // the Kerneldex records every creature met in battle
  useEffect(() => markSeen(foe.art.id), [foe.art.id]);

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
        player: player.art,
        foe: foe.art,
        reducedMotion: reduced,
        font: pixel.style.fontFamily,
        scene,
      });
      if (dead) return st.destroy();
      stage.current = st;
      await st.intro();
      if (dead) return;
      await say(`Go! ${P}!`);
      await wait(500);
      if (dead) return;
      dispatch({ type: "ready" });
      setMsg((m) => ({ text: questions[0].prompt, id: m.id + 1 }));
      askedAt.current = clock();
      setBusy(false);
    })();
    return () => {
      dead = true;
      st?.destroy();
      stage.current = null;
    };
    // the stage is built once per battle; art and names are fixed props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  async function answer(r: Response) {
    if (busy || s.phase !== "ask") return;
    setBusy(true);
    const correct = grade(q, r);
    recordAnswer(cardKey(q), correct);
    setReveal({ response: r, correct });
    const seconds = Math.max(0, (clock() - askedAt.current) / 1000);
    const act = { type: "answer", correct, power: q.move.power, seconds, moveType: q.move.type, counterType: foe.attack } as const;
    const next = reducer(s, act);
    dispatch(act);
    const st = stage.current;
    const last = next.last!;
    if (last.kind === "hit") {
      sfx.cast(q.move.type);
      await Promise.all([say(`${P} used ${q.move.name.toUpperCase()}!`), st?.attack("player", q.move.type, last.damage, last.crit).then(() => sfx.hit(last.crit))]);
      setShown((v) => ({ ...v, foe: next.foe.hp }));
      if (last.crit) await say("A critical hit!").then(() => wait(600));
      const eff = effectMessage(q.move.type, s.foe.type);
      if (eff) {
        const why = superReason(q.move.type, s.foe.type);
        await say(why ? `${eff} ${why}` : eff);
        await wait(why ? 1200 : 600);
      }
    } else {
      sfx.miss();
      await say(lines.counter);
      await st?.attack("foe", foe.attack, last.damage, false);
      sfx.hurt();
      setShown((v) => ({ ...v, player: next.player.hp }));
      const eff = effectMessage(foe.attack, s.player.type);
      if (eff) await say(eff).then(() => wait(600));
    }
    // the menu shows an MCQ's right answer; other kinds state it
    if (!correct && kindOf(q) !== "mcq") {
      await say(kindOf(q) === "order" ? "Here is the right order." : `The answer: ${answerText(q)}.`);
      await pause();
    }
    setExplaining(true);
    await say(q.explain);
    await pause();
    setExplaining(false);
    const after = reducer(next, { type: "next" });
    if (after.phase === "victory") {
      await st?.faint("foe");
      sfx.victory();
      await say(lines.fainted);
      await pause();
      const gain = xpYield(foe.fighter.level, foe.art.boss);
      const total = xp + gain;
      // save first, so leaving during the lines below keeps the XP
      player.onXp?.(total);
      await say(`${P} gained ${gain} XP!`);
      await wait(900);
      let max = maxHp;
      for (let l = levelFor(xp) + 1; l <= levelFor(total); l++) {
        // fill the bar to the threshold, then tick the level over
        setXp(xpForLevel(l));
        await wait(450);
        sfx.levelUp();
        const grown = player.maxHpAt?.(l) ?? max;
        const gainHp = grown - max;
        max = grown;
        setMaxHp(grown);
        // a level-up heals by the HP it adds
        setShown((v) => ({ ...v, player: v.player + gainHp }));
        await say(gainHp > 0 ? `${P} grew to Lv${l}! MAX HP +${gainHp}.` : `${P} grew to Lv${l}!`);
        await pause();
      }
      setXp(total);
      if (markCaught(foe.art.id)) {
        sfx.levelUp();
        await say(`${foe.fighter.name.toUpperCase()}'s data was added to the KERNELDEX!`);
        await pause();
      }
      if (onVictory) {
        await wait(400);
        const evolve = async (to: { art: CreatureArt; name: string; maxHp: number }) => {
          sfx.charge();
          await st?.evolve(to.art, { onSwap: sfx.blip });
          sfx.levelUp();
          const gainHp = to.maxHp - max;
          max = to.maxHp;
          setPlayerName(to.name);
          setMaxHp(to.maxHp);
          setShown((v) => ({ ...v, player: v.player + gainHp }));
        };
        await onVictory({ say, pause, wait, evolve });
      }
    } else if (after.phase === "defeat") {
      if (after.player.hp <= 0) await st?.faint("player");
      sfx.defeat();
      await say(after.player.hp <= 0 ? `${P} fainted…` : lines.fled);
    } else {
      setMsg((m) => ({ text: questions[after.turn % questions.length].prompt, id: m.id + 1 }));
      askedAt.current = clock();
    }
    dispatch({ type: "next" });
    setReveal(null);
    setBusy(false);
  }

  const over = s.phase === "victory" || s.phase === "defeat";
  const level = levelFor(xp);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#100e24]">
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" data-testid="stage" />
        <HpBox name={s.foe.name} level={s.foe.level} type={s.foe.type} hp={shown.foe} maxHp={s.foe.maxHp} className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] w-44 sm:left-6 sm:w-60" />
        <HpBox name={playerName} level={level} hp={shown.player} maxHp={maxHp} xp={xpProgress(xp)} side="player" className="absolute bottom-3 right-3 w-48 sm:right-6 sm:w-64" />
        {explaining && q.gantt && (
          <div className="pointer-events-none absolute inset-x-3 top-1/2 mx-auto max-w-md -translate-y-1/2 border-4 border-[#1a1430] bg-[#2a2440] p-1" data-testid="explain-gantt">
            <GanttChart gantt={q.gantt} />
          </div>
        )}
        {overlay}
      </div>

      <section className="shrink-0 border-t-4 border-[#1f1a3a] bg-[#2a2440] p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-3">
        <div className="mx-auto grid max-w-5xl gap-2.5 lg:grid-cols-2 lg:items-start">
          <MessageBox waiting={waiting} onTap={tap}>
            {tw.shown}
          </MessageBox>
          {over && !busy ? (
            <div className="flex gap-2.5 lg:h-full lg:flex-col" data-testid="end-actions">
              {endActions(s.phase === "victory")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <MoveInfo {...q.move} effect={effectiveness(q.move.type, s.foe.type)} />
              <AnswerPanel key={s.turn} q={q} disabled={busy || s.phase !== "ask"} reveal={reveal} onSubmit={answer} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** The big tap-friendly button style used under a finished battle. */
export const END_BUTTON = "gb-box flex min-h-12 flex-1 items-center justify-center font-pixel text-[11px]";
