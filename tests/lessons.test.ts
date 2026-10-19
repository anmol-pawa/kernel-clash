import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { LESSONS, LESSON_IDS, lessonById, lessonsOf } from "@/content/lessons";
import { grade, questionProblems, type OrderQ } from "@/game/engine/question";
import { runForks } from "@/game/sim/fork";
import { DIAGRAM_IDS } from "@/components/lesson/Diagrams";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

const BASICS_DIAGRAMS = ["modes", "syscall", "interrupt", "kernels", "boot"];
const PROCESS_DIAGRAMS = ["pstates", "context", "fork", "threads", "ipc"];
const DIAGRAMS = [...BASICS_DIAGRAMS, ...PROCESS_DIAGRAMS];

describe("lessons", () => {
  it("have unique ids, a known gym, pages with text and well-formed checks", () => {
    expect(LESSON_IDS.size).toBe(LESSONS.length);
    const checkIds = new Set(LESSONS.map((l) => l.check.id));
    expect(checkIds.size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(GYMS.some((g) => g.id === l.gym)).toBe(true);
      expect(l.pages.length).toBeGreaterThanOrEqual(1);
      for (const p of l.pages) {
        expect(p.heading.trim()).not.toBe("");
        expect(p.body.length).toBeGreaterThan(0);
        // `code` spans must be closed
        for (const t of p.body) expect(t.split("`").length % 2).toBe(1);
        if (p.diagram) expect(DIAGRAMS).toContain(p.diagram);
      }
      expect(questionProblems(l.check)).toEqual([]);
    }
  });

  it("cover every OS-basics topic, with each diagram used once", () => {
    const basics = lessonsOf("basics");
    expect(basics).toHaveLength(GYMS[0].topics.length);
    expect(basics.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...BASICS_DIAGRAMS].sort());
  });

  it("cover every processes-and-threads topic in order, with each diagram used once", () => {
    const procs = lessonsOf("processes");
    const gym = GYMS.find((g) => g.id === "processes")!;
    expect(procs).toHaveLength(gym.topics.length);
    expect(procs.map((l) => l.id)).toEqual(["processes-states", "processes-context", "processes-fork", "processes-threads", "processes-ipc"]);
    expect(procs.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...PROCESS_DIAGRAMS].sort());
    for (const l of procs) expect(l.check.move.type).toBe("process");
  });

  it("every diagram id is drawn", () => {
    expect([...DIAGRAM_IDS].sort()).toEqual([...DIAGRAMS].sort());
  });

  it("modes check: only the trap instruction is allowed in user mode (Silberschatz §1.4.2: the others are privileged)", () => {
    const q = lessonById("basics-modes")!.check;
    expect(q.kind ?? "mcq").toBe("mcq");
    if (q.kind === undefined || q.kind === "mcq") {
      expect(q.options[q.answer]).toMatch(/trap/i);
      expect(grade(q, { kind: "mcq", choice: q.answer })).toBe(true);
      for (let i = 0; i < 4; i++) if (i !== q.answer) expect(grade(q, { kind: "mcq", choice: i })).toBe(false);
    }
  });

  it("syscall check: wrapper → registers → trap → table → return", () => {
    const q = lessonById("basics-syscalls")!.check as OrderQ;
    expect(q.kind).toBe("order");
    expect(q.steps[0]).toMatch(/C library/);
    expect(q.steps[2]).toMatch(/trap/i);
    expect(q.steps[3]).toMatch(/system-call table/);
    expect(q.steps.at(-1)).toMatch(/user mode/);
    expect(grade(q, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(q, { kind: "order", order: [0, 2, 1, 3, 4] })).toBe(false);
  });

  it("interrupts check: divide by zero, page fault and syscall are traps; disk and timer are interrupts", () => {
    const q = lessonById("basics-interrupts")!.check;
    if (q.kind !== "multi") throw new Error("expected select-all");
    const traps = q.answers.map((i) => q.options[i]);
    expect(traps.sort()).toEqual(["A page fault", "A system-call instruction", "Divide by zero"]);
    expect(grade(q, { kind: "multi", choices: [4, 2, 0] })).toBe(true);
    expect(grade(q, { kind: "multi", choices: [0, 2] })).toBe(false);
    expect(grade(q, { kind: "multi", choices: [0, 1, 2, 4] })).toBe(false);
  });

  it("kernels check: a driver crash is contained in a microkernel", () => {
    const q = lessonById("basics-kernels")!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toBe("Microkernel");
  });

  it("boot check: firmware → POST → boot loader → kernel → init", () => {
    const q = lessonById("basics-boot")!.check as OrderQ;
    expect(q.steps.map((s) => s.match(/firmware|self-test|boot loader is|kernel into|init/i)?.[0].toLowerCase())).toEqual(["firmware", "self-test", "boot loader is", "kernel into", "init"]);
    expect(grade(q, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(q, { kind: "order", order: [1, 0, 2, 3, 4] })).toBe(false);
  });
});

describe("processes-and-threads quick checks", () => {
  const mcq = (id: string) => {
    const q = lessonById(id)!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    return q;
  };

  it("states check: Waiting → Running is not a transition (Silberschatz Fig. 3.2: waiting goes to ready)", () => {
    const q = mcq("processes-states");
    expect(q.options[q.answer]).toBe("Waiting → Running");
    // the other three are edges of the five-state diagram
    const edges = new Set(["New → Ready", "Ready → Running", "Running → Ready", "Running → Waiting", "Waiting → Ready", "Running → Terminated"]);
    q.options.forEach((o, i) => expect(edges.has(o)).toBe(i !== q.answer));
  });

  it("context-switch check: interrupt → save PCB0 → reload PCB1 → resume P1 (Silberschatz Fig. 3.6)", () => {
    const q = lessonById("processes-context")!.check as OrderQ;
    expect(q.kind).toBe("order");
    expect(q.steps[1]).toMatch(/interrupt/i);
    expect(q.steps[2]).toMatch(/saves P0.*PCB0/);
    expect(q.steps[3]).toMatch(/reloads P1.*PCB1/);
    expect(grade(q, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(q, { kind: "order", order: [0, 1, 3, 2, 4] })).toBe(false);
  });

  it("fork check: two fork()s then a print prints 4 times, matching the fork simulator", () => {
    const q = lessonById("processes-fork")!.check;
    if (q.kind !== "numeric") throw new Error("expected numeric");
    expect(q.code).toMatch(/fork\(\);\n {2}fork\(\);\n {2}printf/);
    expect(runForks(["fork", "fork", "print"]).prints).toBe(4);
    expect(q.answer).toBe(runForks(["fork", "fork", "print"]).prints);
    expect(grade(q, { kind: "numeric", value: "4" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "3" })).toBe(false);
  });

  it("threads check: registers, stack and PC are per thread; heap, globals and files are shared (Silberschatz Fig. 4.2)", () => {
    const q = lessonById("processes-threads")!.check;
    if (q.kind !== "multi") throw new Error("expected select-all");
    expect(q.answers.map((i) => q.options[i]).sort()).toEqual(["Program counter", "Registers", "Stack"]);
    expect(grade(q, { kind: "multi", choices: [4, 1, 0] })).toBe(true);
    expect(grade(q, { kind: "multi", choices: [0, 1, 2, 4] })).toBe(false);
  });

  it("IPC check: shared memory avoids a system call per exchange", () => {
    const q = mcq("processes-ipc");
    expect(q.options[q.answer]).toBe("Shared memory");
  });
});

describe("lesson progress in the save", () => {
  it("defaults to none", () => {
    expect(DEFAULT_SAVE.lessons).toEqual([]);
    expect(parseSave(JSON.stringify({ badges: [] })).lessons).toEqual([]);
  });

  it("keeps known lesson ids once and drops the rest", () => {
    const s = parseSave(JSON.stringify({ lessons: ["basics-boot", "nope", 3, "basics-boot", "basics-modes"] }));
    expect(s.lessons).toEqual(["basics-boot", "basics-modes"]);
    expect(parseSave(JSON.stringify({ lessons: "basics-boot" })).lessons).toEqual([]);
  });
});
