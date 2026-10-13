import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { LESSONS, LESSON_IDS, lessonById, lessonsOf } from "@/content/lessons";
import { grade, questionProblems, type OrderQ } from "@/game/engine/question";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

const DIAGRAMS = ["modes", "syscall", "interrupt", "kernels", "boot"];

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
    expect(basics.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...DIAGRAMS].sort());
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
