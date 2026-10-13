import { describe, expect, it } from "vitest";
import { DEMO_QUESTIONS } from "@/content/demo";
import { initialState, reducer, type BattleState } from "@/game/engine/battle";
import { counterDamage, moveDamage } from "@/game/engine/damage";
import { MOVE_TYPES } from "@/game/engine/types";
import { Tweener, ease } from "@/game/render/tween";

const P = { name: "Bytling", level: 5, hp: 60, maxHp: 60 };
const F = { name: "Glitchit", level: 4, hp: 100, maxHp: 100 };
const start = (questions = 5) => reducer(initialState(P, F, questions), { type: "ready" });

describe("damage", () => {
  it("scales with level and streak and crits on a fast streak", () => {
    expect(moveDamage({ power: 30, level: 1, streak: 0, seconds: 3 })).toEqual({ damage: 30, crit: false });
    expect(moveDamage({ power: 30, level: 5, streak: 0, seconds: 3 }).damage).toBe(36); // 30 × 1.2
    expect(moveDamage({ power: 30, level: 1, streak: 2, seconds: 10 })).toEqual({ damage: 36, crit: false }); // 30 × 1.2
    expect(moveDamage({ power: 30, level: 1, streak: 2, seconds: 3 })).toEqual({ damage: 54, crit: true }); // 30 × 1.2 × 1.5
    expect(counterDamage(4)).toBe(16);
  });
});

describe("battle reducer", () => {
  it("starts in intro and moves to ask on ready", () => {
    expect(initialState(P, F, 3).phase).toBe("intro");
    expect(start().phase).toBe("ask");
  });

  it("a right answer damages the foe and builds a streak; a wrong one counters and resets it", () => {
    let s = reducer(start(), { type: "answer", correct: true, power: 30, seconds: 10 });
    expect(s.phase).toBe("resolve");
    expect(s.foe.hp).toBe(100 - 36);
    expect(s.streak).toBe(1);
    expect(s.last).toEqual({ kind: "hit", damage: 36, crit: false, effect: 1 });
    s = reducer(s, { type: "next" });
    expect(s.phase).toBe("ask");
    s = reducer(s, { type: "answer", correct: false, power: 30, seconds: 1 });
    expect(s.player.hp).toBe(60 - 16);
    expect(s.streak).toBe(0);
    expect(s.stats).toMatchObject({ answered: 2, correct: 1, damageDealt: 36, damageTaken: 16 });
  });

  it("ignores answers outside the ask phase", () => {
    const s = initialState(P, F, 3);
    expect(reducer(s, { type: "answer", correct: true, power: 30, seconds: 1 })).toBe(s);
  });

  it("wins when the foe hits 0 HP and never overkills", () => {
    let s: BattleState = start();
    for (let i = 0; i < 5 && s.phase !== "victory"; i++) {
      s = reducer(s, { type: "answer", correct: true, power: 40, seconds: 2 });
      s = reducer(s, { type: "next" });
    }
    expect(s.phase).toBe("victory");
    expect(s.foe.hp).toBe(0);
    expect(s.stats.damageDealt).toBe(100);
  });

  it("loses when the player faints or questions run out", () => {
    let s: BattleState = start(10);
    while (s.phase === "ask") s = reducer(reducer(s, { type: "answer", correct: false, power: 30, seconds: 1 }), { type: "next" });
    expect(s.phase).toBe("defeat");
    expect(s.player.hp).toBe(0);
    s = start(1);
    s = reducer(reducer(s, { type: "answer", correct: true, power: 10, seconds: 9 }), { type: "next" });
    expect(s.phase).toBe("defeat");
  });
});

describe("demo questions", () => {
  const expected: Record<string, string> = {
    "demo-mode": "Kernel mode",
    "demo-fork": "0",
    "demo-state": "Waiting (blocked)",
    "demo-pcb": "In its PCB",
    "demo-syscall": "A system call (trap)",
  };
  for (const q of DEMO_QUESTIONS)
    it(`${q.id}: the keyed answer is correct and options are distinct`, () => {
      expect(q.options[q.answer]).toBe(expected[q.id]);
      expect(new Set(q.options).size).toBe(4);
      expect(MOVE_TYPES).toContain(q.move.type);
      expect(q.explain.length).toBeGreaterThan(20);
    });
});

describe("tween engine", () => {
  it("drives values with easing and resolves", async () => {
    const tw = new Tweener();
    const o = { x: 0 };
    const p = tw.to(o, { x: 10 }, 1, ease.linear);
    tw.update(0.5);
    expect(o.x).toBeCloseTo(5);
    tw.update(0.5);
    await p;
    expect(o.x).toBe(10);
  });
});
