import { describe, expect, it } from "vitest";
import { DEMO_QUESTIONS } from "@/content/demo";
import { initialState, reducer } from "@/game/engine/battle";
import { moveDamage } from "@/game/engine/damage";
import { MOVE_TYPES, SUPER_EFFECTIVE, effectMessage, effectiveness, superReason } from "@/game/engine/types";

describe("type chart", () => {
  it("has the expected matchups", () => {
    expect(effectiveness("io", "scheduler")).toBe(2); // interrupts preempt
    expect(effectiveness("scheduler", "process")).toBe(2); // preemption
    expect(effectiveness("scheduler", "sync")).toBe(2); // lock-holder preemption
    expect(effectiveness("process", "memory")).toBe(2); // thrashing
    expect(effectiveness("memory", "storage")).toBe(2); // page cache
    expect(effectiveness("storage", "process")).toBe(2); // swapping
    expect(effectiveness("sync", "process")).toBe(2); // locks serialise racers
    expect(effectiveness("sync", "io")).toBe(2); // a semaphore guards the device
    expect(effectiveness("process", "scheduler")).toBe(0.5);
    expect(effectiveness("storage", "memory")).toBe(0.5);
    expect(effectiveness("memory", "memory")).toBe(1);
    expect(effectiveness("io", "memory")).toBe(1);
    expect(effectiveness("io", undefined)).toBe(1);
  });

  it("is consistent: no duplicate or two-way matchups, and every resisted hit is the reverse of a super one", () => {
    const keys = SUPER_EFFECTIVE.map((m) => `${m.attack}>${m.defend}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of SUPER_EFFECTIVE) {
      expect(m.attack).not.toBe(m.defend);
      expect(keys).not.toContain(`${m.defend}>${m.attack}`);
      expect(m.why.length).toBeGreaterThan(20);
    }
    for (const a of MOVE_TYPES)
      for (const d of MOVE_TYPES) {
        const e = effectiveness(a, d);
        expect([0.5, 1, 2]).toContain(e);
        if (e === 2) expect(effectiveness(d, a)).toBe(0.5);
        if (e === 0.5) expect(effectiveness(d, a)).toBe(2);
      }
  });

  it("gives every type at least one strength and one weakness", () => {
    for (const t of MOVE_TYPES) {
      expect(MOVE_TYPES.some((d) => effectiveness(t, d) === 2), `${t} strong vs something`).toBe(true);
      expect(MOVE_TYPES.some((a) => effectiveness(a, t) === 2), `${t} weak to something`).toBe(true);
    }
  });

  it("has a message for super and not-very-effective hits, and a reason for each super one", () => {
    expect(effectMessage("scheduler", "process")).toBe("It's super effective!");
    expect(effectMessage("process", "scheduler")).toBe("It's not very effective…");
    expect(effectMessage("io", "memory")).toBeUndefined();
    expect(superReason("io", "scheduler")).toMatch(/interrupt/);
    expect(superReason("process", "scheduler")).toBeUndefined();
  });
});

describe("type effectiveness in battle", () => {
  it("scales move damage", () => {
    expect(moveDamage({ power: 30, level: 1, streak: 0, seconds: 10, effect: 2 }).damage).toBe(60);
    expect(moveDamage({ power: 30, level: 1, streak: 0, seconds: 10, effect: 0.5 }).damage).toBe(15);
  });

  it("applies the chart to the player's move and the foe's counter", () => {
    const P = { name: "Bytling", level: 1, hp: 60, maxHp: 60, type: "memory" as const };
    const F = { name: "Glitchit", level: 4, hp: 100, maxHp: 100, type: "process" as const };
    let s = reducer(initialState(P, F, 5), { type: "ready" });
    s = reducer(s, { type: "answer", correct: true, power: 30, seconds: 10, moveType: "scheduler" });
    expect(s.last).toEqual({ kind: "hit", damage: 60, crit: false, effect: 2 });
    s = reducer(reducer(s, { type: "next" }), { type: "answer", correct: false, power: 30, seconds: 10 });
    expect(s.last).toEqual({ kind: "counter", damage: 32, effect: 2 }); // process counter vs memory: (10 + 6) × 2
    s = reducer(reducer(s, { type: "next" }), { type: "answer", correct: true, power: 30, seconds: 10, moveType: "memory" });
    expect(s.last).toMatchObject({ kind: "hit", damage: 15, effect: 0.5 });
  });

  it("untyped creatures take neutral damage", () => {
    const s = reducer(reducer(initialState({ name: "A", level: 1, hp: 60, maxHp: 60 }, { name: "B", level: 1, hp: 60, maxHp: 60 }, 3), { type: "ready" }), { type: "answer", correct: true, power: 30, seconds: 10, moveType: "sync" });
    expect(s.last).toMatchObject({ damage: 30, effect: 1 });
  });

  it("the demo battle shows a super-effective move against Glitchit (process)", () => {
    expect(DEMO_QUESTIONS.some((q) => effectiveness(q.move.type, "process") === 2)).toBe(true);
  });
});
