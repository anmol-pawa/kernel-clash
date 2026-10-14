import { describe, expect, it } from "vitest";
import { bootOrder, interruptLoadQ, interruptOrTrap, privilegedPick } from "@/content/basicsGenerators";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { BASICS_EXTRA, BATTLE_TURNS, POOLS, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { STARTERS, starterFighter } from "@/content/starters";
import { initialState, reducer, type Fighter } from "@/game/engine/battle";
import { cardKey } from "@/game/engine/leitner";
import { answerText, grade, kindOf, questionProblems, type McqQ, type MultiQ, type Question } from "@/game/engine/question";
import { MOVE_TYPES } from "@/game/engine/types";
import { xpForLevel } from "@/game/engine/xp";
import { BOOT_CHAINS, interruptLoad } from "@/game/sim/basics";
import { bossFighter } from "@/game/world/gymBattle";

const T = 1_700_000_000_000;
const basics = POOLS.basics;

/** The answer key for the extra authored questions, written independently of the data. */
const KEY: Record<string, string | string[] | number> = {
  "basics-modebit": "Whether the CPU is running in kernel mode or user mode",
  "basics-timer": "So it gets control back even if the program loops forever",
  "basics-vector": "The addresses of the interrupt handlers, indexed by interrupt number",
  "basics-api": "The API is portable and hides system-call numbers and register conventions",
  "basics-params": "Store them in a block in memory and pass the block's address in a register",
  "basics-uefi": "As a file on the EFI System Partition",
  "basics-pid1": "init (often systemd), as PID 1",
  "multi-basics-micro": ["A crashed driver doesn't bring down the kernel", "New services can be added as user-space servers", "Less code runs in kernel mode"],
  "multi-basics-syscalls": ["fork()", "open()", "read()", "mmap()"],
  "multi-basics-irq": ["The CPU saves the program counter and state", "The CPU jumps to the handler through the interrupt vector", "The handler runs in kernel mode"],
  "num-basics-rings": 4,
  "num-basics-mbr": 512,
};

/** Order questions: the first and last step, written independently. */
const ENDS: Record<string, [string, string]> = {
  "order-basics-irq": ["A device raises a signal on its interrupt-request line", "Return-from-interrupt restores the state and the program resumes"],
  "order-basics-fault": ["The program executes the privileged instruction in user mode", "The OS handles it, usually by terminating the process"],
};

describe("the OS-basics pool", () => {
  it("has ~20 authored questions of every kind plus generators, all well-formed with unique ids", () => {
    expect(basics.authored.length).toBeGreaterThanOrEqual(20);
    expect(new Set(basics.authored.map(kindOf))).toEqual(new Set(["mcq", "multi", "numeric", "order"]));
    expect(basics.generators.length).toBeGreaterThanOrEqual(3);
    const ids = basics.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const all = Object.values(GYM_QUESTIONS).flat().map((q) => q.id);
    for (const q of BASICS_EXTRA) expect(all, q.id).not.toContain(q.id);
    for (const q of basics.authored) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(q.move.type, q.id).toBe("io");
      expect(MOVE_TYPES).toContain(q.move.type);
      expect(q.explain.length, q.id).toBeGreaterThan(40);
    }
    for (const id of GYM_QUESTIONS.basics.map((q) => q.id)) expect(ids).toContain(id);
  });

  it("matches the answer key for every extra question", () => {
    const keyed = [...Object.keys(KEY), ...Object.keys(ENDS)].sort();
    expect(keyed).toEqual(BASICS_EXTRA.map((q) => q.id).sort());
    for (const q of BASICS_EXTRA) {
      const k = KEY[q.id];
      switch (q.kind) {
        case "multi":
          expect(q.answers.map((i) => q.options[i]).sort(), q.id).toEqual([...(k as string[])].sort());
          expect(grade(q, { kind: "multi", choices: q.answers })).toBe(true);
          expect(grade(q, { kind: "multi", choices: q.answers.slice(1) })).toBe(false);
          break;
        case "numeric":
          expect(q.answer, q.id).toBe(k);
          expect(grade(q, { kind: "numeric", value: String(k) })).toBe(true);
          break;
        case "order":
          expect([q.steps[0], q.steps[q.steps.length - 1]], q.id).toEqual(ENDS[q.id]);
          break;
        default:
          expect((q as McqQ).options[(q as McqQ).answer], q.id).toBe(k);
      }
    }
  });

  it("doesn't park every MCQ answer in the same slot", () => {
    const mcqs = basics.authored.filter((q) => kindOf(q) === "mcq") as McqQ[];
    expect(new Set(mcqs.map((q) => q.answer)).size).toBe(4);
  });

  it("is in the question bank, labelled with the gym", () => {
    for (const q of basics.authored) expect(cardLabel(cardKey(q))).toEqual({ from: "Bootstrap Gym", text: q.prompt });
    for (const g of basics.generators) expect(inBank(g.id)).toBe(true);
  });
});

describe("OS-basics generators", () => {
  /** Silberschatz exercise 1.x: which instructions should be privileged. */
  const PRIVILEGED = ["Set the value of the timer", "Clear all of physical memory", "Turn off interrupts", "Modify the device-status table", "Send a command to the disk controller"];
  const UNPRIVILEGED = ["Read the clock", "Execute the trap (syscall) instruction"];

  it("privileged instructions follow the textbook", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = privilegedPick.make(seed) as MultiQ;
      expect(q.options).toHaveLength(6);
      const picked = q.answers.map((i) => q.options[i]);
      expect(picked.length).toBeGreaterThanOrEqual(2);
      expect(picked.length).toBeLessThanOrEqual(4);
      for (const o of q.options) {
        if (PRIVILEGED.includes(o)) expect(picked, o).toContain(o);
        if (UNPRIVILEGED.includes(o)) expect(picked, o).not.toContain(o);
      }
    }
  });

  it("sorts interrupts from traps by whether a device or the instruction caused them", () => {
    const irq = /keyboard|disk read finishes|timer goes off|packet arrives|mouse|USB/;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = interruptOrTrap.make(seed) as MultiQ;
      const wantIrq = q.prompt.includes("hardware interrupts");
      seen.add(String(wantIrq));
      for (const [i, o] of q.options.entries()) expect(q.answers.includes(i), `${seed}: ${o}`).toBe(irq.test(o) === wantIrq);
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
      expect(q.answers.length).toBeLessThan(q.options.length);
    }
    expect(seen).toEqual(new Set(["true", "false"]));
  });

  it("keeps the boot chain in order, from power-on to init", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = bootOrder.make(seed);
      if (q.kind !== "order") throw new Error("not an order question");
      const chain: readonly string[] = q.prompt.includes("UEFI") ? BOOT_CHAINS.UEFI : BOOT_CHAINS.BIOS;
      const at = q.steps.map((s) => chain.indexOf(s));
      expect(at.every((x) => x >= 0)).toBe(true);
      expect(at).toEqual([...at].sort((a, b) => a - b));
      expect(q.steps[0]).toMatch(/^Power on/);
      expect(q.steps.at(-1)).toMatch(/init \(PID 1\)/);
      expect(q.steps.length).toBeGreaterThanOrEqual(4);
    }
    // the MBR is BIOS-only, the EFI System Partition UEFI-only
    expect(BOOT_CHAINS.BIOS.join()).toMatch(/MBR/);
    expect(BOOT_CHAINS.UEFI.join()).not.toMatch(/MBR/);
    expect(BOOT_CHAINS.UEFI.join()).toMatch(/EFI System Partition/);
  });

  it("interrupt load: 1,000 interrupts/s at 50 µs each is 5% of the CPU", () => {
    expect(interruptLoad(1000, 50)).toBe(5);
    expect(interruptLoad(10000, 100)).toBe(100);
    expect(interruptLoad(200, 2)).toBeCloseTo(0.04);
    for (let seed = 1; seed <= 300; seed++) {
      const q = interruptLoadQ.make(seed);
      if (q.kind !== "numeric") throw new Error("not numeric");
      const [rate, us] = [...q.prompt.matchAll(/([\d,]+) (?:interrupts|µs)/g)].map((m) => Number(m[1].replace(/,/g, "")));
      // µs busy per second over the 1,000,000 µs in a second
      expect(q.answer).toBeCloseTo(((rate * us) / 1_000_000) * 100, 9);
      expect(q.answer).toBeLessThanOrEqual(50);
      expect(grade(q, { kind: "numeric", value: answerText(q).replace(" %", "") })).toBe(true);
    }
  });
});

describe("gym battle draw", () => {
  it("draws six distinct pool questions, the same for one seed and different for another", () => {
    const qs = gymBattleQuestions("basics", 5, {}, T);
    expect(qs).toHaveLength(BATTLE_TURNS);
    expect(new Set(qs.map((q) => cardKey(q))).size).toBe(BATTLE_TURNS);
    const pool = new Set([...basics.authored.map(cardKey), ...basics.generators.map((g) => g.id)]);
    for (const q of qs) expect(pool, q.id).toContain(cardKey(q));
    expect(gymBattleQuestions("basics", 5, {}, T)).toEqual(qs);
    const draws = new Set([...Array(20).keys()].map((s) => gymBattleQuestions("basics", s, {}, T).map((q) => q.id).join()));
    expect(draws.size).toBeGreaterThan(15);
  });

  it("over many battles asks every question in the pool, of every kind", () => {
    const asked = new Set<string>();
    for (let s = 0; s < 200; s++) for (const q of gymBattleQuestions("basics", s, {}, T)) asked.add(cardKey(q));
    expect(asked.size).toBe(basics.authored.length + basics.generators.length);
  });

  it("asks due Leitner cards first and holds back cards that aren't due", () => {
    const deck = {
      "num-basics-mbr": { box: 1, due: T - 1 },
      "gen-boot-order": { box: 2, due: T - 1 },
      "basics-priv": { box: 5, due: T + 1e9 },
    };
    for (let s = 0; s < 30; s++) {
      const qs = gymBattleQuestions("basics", s, deck, T);
      expect(qs.slice(0, 2).map(cardKey)).toEqual(["num-basics-mbr", "gen-boot-order"]);
      expect(qs.map(cardKey)).not.toContain("basics-priv");
    }
  });

  it("other gyms still ask their six boss questions", () => {
    for (const g of GYMS.filter((g) => !POOLS[g.id])) expect(gymBattleQuestions(g.id, 1, {}, T).map((q) => q.id).sort()).toEqual(GYM_QUESTIONS[g.id].map((q) => q.id).sort());
  });

  /** Play a boss battle on these questions with a right/wrong pattern. */
  function play(qs: Question[], pattern: boolean[], player: Fighter) {
    const gym = GYMS.find((g) => g.id === "basics")!;
    let s = reducer(initialState(player, bossFighter(gym), qs.length), { type: "ready" });
    for (let i = 0; s.phase === "ask"; i++) {
      s = reducer(s, { type: "answer", correct: pattern[i] ?? false, power: qs[i].move.power, seconds: 30, moveType: qs[i].move.type, counterType: gym.type });
      s = reducer(s, { type: "next" });
    }
    return s.phase;
  }

  it("keeps the boss balanced for any draw: the weakest six still win with one slip, the strongest lose with three misses", () => {
    const all = [...basics.authored, ...basics.generators.map((g) => g.make(1))].sort((a, b) => a.move.power - b.move.power);
    const weakest = all.slice(0, BATTLE_TURNS);
    const strongest = all.slice(-BATTLE_TURNS);
    const players = STARTERS.flatMap((s) => [starterFighter(s), starterFighter(s, xpForLevel(7))]);
    for (const p of players) {
      expect(play(weakest, [true, true, true, true, true, true], p), p.name).toBe("victory");
      for (let slip = 0; slip < BATTLE_TURNS; slip++) {
        const pattern = weakest.map((_, i) => i !== slip);
        expect(play(weakest, pattern, p), `${p.name} slip ${slip}`).toBe("victory");
      }
      expect(play(strongest, [true, true, true, false, false, false], p), p.name).toBe("defeat");
    }
  });
});
