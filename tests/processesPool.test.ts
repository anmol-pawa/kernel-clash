import { describe, expect, it } from "vitest";
import { forkTree, ipcPick, stateArrows, stateTrace } from "@/content/processGenerators";
import { GENERATORS } from "@/content/generators";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { BATTLE_TURNS, POOLS, PROCESSES_EXTRA, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { STARTERS, starterFighter } from "@/content/starters";
import { initialState, reducer, type Fighter } from "@/game/engine/battle";
import { cardKey } from "@/game/engine/leitner";
import { grade, kindOf, questionProblems, type McqQ, type MultiQ, type NumericQ, type Question } from "@/game/engine/question";
import { xpForLevel } from "@/game/engine/xp";
import { runForkTree, type Node } from "@/game/sim/fork";
import { IPC_CASES, PSTATES, TRANSITIONS, step, trace } from "@/game/sim/processes";
import { bossFighter } from "@/game/world/gymBattle";

const T = 1_700_000_000_000;
const pool = POOLS.processes;
const F: Node = { op: "fork" };

/** The answer key for the extra authored questions, written independently of the data. */
const KEY: Record<string, string | string[] | number> = {
  "proc-pcb": "The program's source code",
  "proc-ctx-save": "In that process's PCB",
  "proc-fork-ret": "0",
  "proc-orphan": "It is adopted by init (PID 1) or a subreaper, which reaps it when it exits",
  "proc-cow": "Copy-on-write: pages are shared until one of them writes to a page",
  "proc-m2o": "The whole process blocks",
  "proc-pipe-eof": "Returns 0, meaning end of file",
  "proc-mode-switch": "A mode switch: the same process keeps running, with no PCB swap or cache/TLB disruption",
  "multi-proc-off-cpu": ["A timer interrupt ends its time slice", "It requests disk I/O and must wait", "It calls exit()"],
  "multi-proc-inherit": ["A copy of the parent's address space (data, heap, stack)", "Copies of the parent's open file descriptors", "Execution continuing just after the fork() call"],
  "multi-proc-pipe": ["Data flows in one direction only", "It is normally shared between a parent and its child", "Reading from it when empty blocks while a write end is still open"],
  // computed by the simulator below as well
  "num-proc-loop": 16,
  "num-proc-child": 5,
};

const ENDS: Record<string, [string, string]> = {
  "order-proc-shell": ["The shell reads and parses the command line", "The shell's wait() returns and it prints the next prompt"],
  "order-proc-life": ["NEW: fork() creates it", "TERMINATED: dispatched again, it calls exit()"],
};

describe("the Fork Grove pool", () => {
  it("has ~20 authored questions of every kind plus generators, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(20);
    expect(new Set(pool.authored.map(kindOf))).toEqual(new Set(["mcq", "multi", "numeric", "order"]));
    expect(pool.generators.length).toBeGreaterThanOrEqual(3);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.values(GYM_QUESTIONS).flat(), ...POOLS.basics.authored].map((q) => q.id);
    for (const q of PROCESSES_EXTRA) expect(elsewhere, q.id).not.toContain(q.id);
    for (const q of pool.authored) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(q.move.type, q.id).toBe("process");
      expect(q.explain.length, q.id).toBeGreaterThan(40);
    }
    for (const id of GYM_QUESTIONS.processes.map((q) => q.id)) expect(ids).toContain(id);
  });

  it("matches the answer key for every extra question", () => {
    expect([...Object.keys(KEY), ...Object.keys(ENDS)].sort()).toEqual(PROCESSES_EXTRA.map((q) => q.id).sort());
    for (const q of PROCESSES_EXTRA) {
      const k = KEY[q.id];
      switch (q.kind) {
        case "multi":
          expect(q.answers.map((i) => q.options[i]).sort(), q.id).toEqual([...(k as string[])].sort());
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

  it("the fork numerics agree with the simulator", () => {
    expect(runForkTree([{ op: "loop", n: 4, body: [F] }]).processes).toBe(KEY["num-proc-loop"]);
    expect(runForkTree([{ op: "ifChild", body: [F, F] }]).processes).toBe(KEY["num-proc-child"]);
  });

  it("the life-cycle order follows the five-state diagram", () => {
    const q = PROCESSES_EXTRA.find((q) => q.id === "order-proc-life");
    if (q?.kind !== "order") throw new Error("missing");
    const states = q.steps.map((s) => s.split(":")[0]);
    for (let i = 1; i < states.length; i++) {
      const ok = Object.values(TRANSITIONS).some((t) => t.from === states[i - 1] && t.to === states[i]);
      // the last step is two arrows (dispatched again, then exit)
      expect(ok || (states[i - 1] === "READY" && states[i] === "TERMINATED"), `${states[i - 1]} → ${states[i]}`).toBe(true);
    }
  });

  it("doesn't park every MCQ answer in the same slot, and is in the question bank", () => {
    const mcqs = pool.authored.filter((q) => kindOf(q) === "mcq") as McqQ[];
    expect(new Set(mcqs.map((q) => q.answer)).size).toBe(4);
    for (const q of pool.authored) expect(cardLabel(cardKey(q))).toEqual({ from: "Fork Grove Gym", text: q.prompt });
    for (const g of pool.generators) expect(inBank(g.id)).toBe(true);
    expect(new Set(GENERATORS.map((g) => g.id)).size).toBe(GENERATORS.length);
  });
});

describe("the fork() simulator with branches", () => {
  it("handles the textbook programs", () => {
    // Silberschatz 3.2 and 3.12
    expect(runForkTree([F, F, F]).processes).toBe(8);
    expect(runForkTree([{ op: "loop", n: 4, body: [F] }]).processes).toBe(16);
    // only the child forks again: parent, child, grandchild
    expect(runForkTree([{ op: "ifChild", body: [F] }]).processes).toBe(3);
    expect(runForkTree([{ op: "ifParent", body: [F] }]).processes).toBe(3);
    // fork(); if (fork() == 0) fork();  →  2 × 3
    expect(runForkTree([F, { op: "ifChild", body: [F] }]).processes).toBe(6);
    // the child of the outer fork forks; its parent-side branch forks once more
    expect(runForkTree([{ op: "ifChild", body: [{ op: "ifParent", body: [F] }] }]).processes).toBe(4);
    // a printf inside a branch runs only there
    expect(runForkTree([{ op: "ifChild", body: [{ op: "print" }] }, { op: "print" }])).toEqual({ processes: 2, prints: 3 });
  });

  it("n plain forks give 2^n, and a loop equals its unrolled body", () => {
    for (let n = 0; n <= 5; n++) {
      expect(runForkTree(Array(n).fill(F)).processes).toBe(2 ** n);
      expect(runForkTree([{ op: "loop", n, body: [F, { op: "print" }] }])).toEqual(runForkTree(Array(n).fill([F, { op: "print" }]).flat()));
    }
  });
});

describe("Fork Grove generators", () => {
  it("fork trees: the answer is the simulator's, with branches, a small count and the trace in the explanation", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = forkTree.make(seed) as NumericQ;
      expect(questionProblems(q)).toEqual([]);
      expect(q.code).toMatch(/if \(fork\(\)|for \(int i/);
      expect(q.answer).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeLessThanOrEqual(24 * 3);
      // re-count independently: the explanation's chain ends at the process count
      const chain = /Processes after each statement: ([\d → ]+)\./.exec(q.explain)![1].split(" → ").map(Number);
      expect(chain[0]).toBe(1);
      if (q.prompt.startsWith("Including")) expect(q.answer).toBe(chain.at(-1));
      else expect(q.answer).toBe(Number(/(\d+)\.$/.exec(q.explain)![1]));
      seen.add(q.prompt.slice(0, 9));
      expect(grade(q, { kind: "numeric", value: String(q.answer) })).toBe(true);
    }
    expect(seen.size).toBe(2);
  });

  it("state traces end where the five-state model says", () => {
    const ends = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = stateTrace.make(seed) as McqQ;
      expect(questionProblems(q)).toEqual([]);
      const path = q.explain.split(".")[0].split(" → ");
      expect(path[0]).toBe("NEW");
      expect(path.length).toBeGreaterThanOrEqual(4);
      // every hop is an arrow in the diagram
      for (let i = 1; i < path.length; i++) expect(Object.values(TRANSITIONS).some((t) => t.from === path[i - 1] && t.to === path[i]), path.join()).toBe(true);
      const end = path.at(-1)!;
      expect(q.options[q.answer].toUpperCase()).toBe(end);
      ends.add(end);
    }
    expect(ends).toEqual(new Set(["READY", "RUNNING", "WAITING", "TERMINATED"]));
  });

  it("the state machine rejects arrows that aren't in the diagram", () => {
    expect(trace("NEW", ["admit", "dispatch", "block", "wake", "dispatch", "exit"])).toBe("TERMINATED");
    expect(step("WAITING", "dispatch")).toBeNull();
    expect(step("READY", "block")).toBeNull();
    expect(() => trace("NEW", ["dispatch"])).toThrow();
    expect(PSTATES).toHaveLength(5);
  });

  it("state arrows: the textbook's six arrows are right, the made-up ones wrong", () => {
    const valid = ["New → Ready", "Ready → Running", "Running → Ready", "Running → Waiting", "Waiting → Ready", "Running → Terminated"];
    for (let seed = 1; seed <= 200; seed++) {
      const q = stateArrows.make(seed) as MultiQ;
      expect(questionProblems(q)).toEqual([]);
      expect(q.options).toHaveLength(6);
      for (const [i, o] of q.options.entries()) expect(q.answers.includes(i), o).toBe(valid.includes(o));
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
      if (q.options.includes("Waiting → Running")) expect(q.answers).not.toContain(q.options.indexOf("Waiting → Running"));
    }
  });

  it("IPC choices: the right mechanism is offered once, with distractors that don't fit", () => {
    const answers = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = ipcPick.make(seed) as McqQ;
      expect(questionProblems(q)).toEqual([]);
      const c = IPC_CASES.find((c) => q.prompt.startsWith(c.text))!;
      expect(q.options[q.answer]).toBe(c.answer);
      for (const o of q.options) if (o !== c.answer) expect(c.wrong).toContain(o);
      answers.add(c.answer);
    }
    expect(answers.size).toBe(6);
    // textbook cases: across machines needs a socket; unrelated processes need a FIFO, not an anonymous pipe
    expect(IPC_CASES.find((c) => /another computer/.test(c.text))?.answer).toBe("A socket");
    for (const c of IPC_CASES.filter((c) => /unrelated/.test(c.text))) expect(c.wrong).toContain("An ordinary (anonymous) pipe");
  });
});

describe("Fork Grove battles draw from the pool", () => {
  it("six distinct pool questions, deterministic per seed, every question asked over many battles", () => {
    const keys = new Set([...pool.authored.map(cardKey), ...pool.generators.map((g) => g.id)]);
    const qs = gymBattleQuestions("processes", 3, {}, T);
    expect(qs).toHaveLength(BATTLE_TURNS);
    expect(gymBattleQuestions("processes", 3, {}, T)).toEqual(qs);
    const asked = new Set<string>();
    for (let s = 0; s < 200; s++)
      for (const q of gymBattleQuestions("processes", s, {}, T)) {
        expect(keys).toContain(cardKey(q));
        asked.add(cardKey(q));
      }
    expect(asked).toEqual(keys);
  });

  function play(qs: Question[], pattern: boolean[], player: Fighter) {
    const gym = GYMS.find((g) => g.id === "processes")!;
    let s = reducer(initialState(player, bossFighter(gym), qs.length), { type: "ready" });
    for (let i = 0; s.phase === "ask"; i++) {
      s = reducer(s, { type: "answer", correct: pattern[i] ?? false, power: qs[i].move.power, seconds: 30, moveType: qs[i].move.type, counterType: gym.type });
      s = reducer(s, { type: "next" });
    }
    return s.phase;
  }

  it("keeps Hydrafork balanced for any draw: the weakest six win with a slip, the strongest lose with three misses", () => {
    const all = [...pool.authored, ...pool.generators.map((g) => g.make(1))].sort((a, b) => a.move.power - b.move.power);
    const weakest = all.slice(0, BATTLE_TURNS);
    const strongest = all.slice(-BATTLE_TURNS);
    for (const p of STARTERS.flatMap((s) => [starterFighter(s), starterFighter(s, xpForLevel(7))])) {
      expect(play(weakest, weakest.map(() => true), p), p.name).toBe("victory");
      for (let slip = 0; slip < BATTLE_TURNS; slip++) expect(play(weakest, weakest.map((_, i) => i !== slip), p), `${p.name} slip ${slip}`).toBe("victory");
      expect(play(strongest, [true, true, true, false, false, false], p), p.name).toBe("defeat");
    }
  });
});

describe("state-trace wording", () => {
  it("a wait always ends with its own wake-up", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = stateTrace.make(seed).prompt;
      if (p.includes("disk read completes")) expect(p).toMatch(/read\(\) on a disk file/);
      if (p.includes("presses a key")) expect(p).toMatch(/key press/);
      if (p.includes("the child exits")) expect(p).toMatch(/wait\(\) for its running child/);
    }
  });
});
