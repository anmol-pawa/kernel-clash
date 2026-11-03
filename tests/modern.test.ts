import { describe, expect, it } from "vitest";
import { NICE_0_WEIGHT, avgVruntime, eevdfPick, eligible, lag, psi, ringSizes, submitSyscalls, virtualDeadline } from "@/game/sim/modern";
import { EEVDF_TASKS, HEAVY, MODERN_TOPIC_QUESTIONS, PSI_TICKS } from "@/content/modernTopicQuestions";
import { grade, questionProblems } from "@/game/engine/question";
import { lessonById } from "@/content/lessons";
import { TOPIC_OF } from "@/content/interviewTopics";

describe("modern Linux simulators", () => {
  it("EEVDF: lag sums to zero and the earliest overall deadline need not be picked", () => {
    expect(avgVruntime(EEVDF_TASKS)).toBe(106);
    expect(EEVDF_TASKS.reduce((a, t) => a + lag(EEVDF_TASKS, t), 0)).toBeCloseTo(0);
    const [a, b, c] = EEVDF_TASKS;
    expect([a, b, c].map(virtualDeadline)).toEqual([130, 120, 124]);
    expect(eligible(EEVDF_TASKS, b)).toBe(false);
    expect(eevdfPick(EEVDF_TASKS).name).toBe("C");
  });
  it("EEVDF: weight scales the deadline", () => {
    expect(virtualDeadline(HEAVY)).toBe(92);
    expect(virtualDeadline({ ...HEAVY, weight: NICE_0_WEIGHT })).toBe(94);
  });
  it("io_uring: batching and ring sizes", () => {
    expect(submitSyscalls(1000, "syscall-per-op")).toBe(1000);
    expect(submitSyscalls(1000, "io_uring", 32)).toBe(32);
    expect(submitSyscalls(1000, "sqpoll")).toBe(0);
    expect(ringSizes(100)).toEqual({ sq: 128, cq: 256 });
    expect(ringSizes(128)).toEqual({ sq: 128, cq: 256 });
  });
  it("PSI: some vs full", () => {
    expect(psi(PSI_TICKS)).toEqual({ some: 60, full: 30 });
    expect(psi([{ nonidle: 0, stalled: 0 }]).full).toBe(0);
  });
});

describe("EEVDF / io_uring / cgroup v2 + PSI questions", () => {
  it("has five per topic, unique, well-formed, topic-mapped", () => {
    expect(MODERN_TOPIC_QUESTIONS).toHaveLength(15);
    expect(new Set(MODERN_TOPIC_QUESTIONS.map((q) => q.id)).size).toBe(15);
    for (const q of MODERN_TOPIC_QUESTIONS) {
      expect(questionProblems(q), q.id).toEqual([]);
      expect(TOPIC_OF[q.id], q.id).toBeDefined();
    }
    for (const p of ["mt-eevdf", "mt-uring"]) expect(MODERN_TOPIC_QUESTIONS.filter((q) => q.id.startsWith(p))).toHaveLength(5);
  });
  it("numeric answers match the simulators", () => {
    const num = (id: string) => MODERN_TOPIC_QUESTIONS.find((q) => q.id === id)!;
    const ok = (id: string, v: string) => grade(num(id), { kind: "numeric", value: v });
    expect(ok("mt-eevdf-avg", "106")).toBe(true);
    expect(ok("mt-eevdf-deadline", "92")).toBe(true);
    expect(ok("mt-uring-calls", "32")).toBe(true);
    expect(ok("mt-uring-size", "256")).toBe(true);
    expect(ok("mt-psi-some", "60")).toBe(true);
    expect(ok("mt-psi-full", "30")).toBe(true);
    expect(ok("mt-cg-weight", "60")).toBe(true);
    expect(ok("mt-uring-size", "128")).toBe(false);
  });
  it("keyed MCQ answers say the right thing", () => {
    const key = (id: string) => { const q = MODERN_TOPIC_QUESTIONS.find((x) => x.id === id)!; if (q.kind !== undefined && q.kind !== "mcq") throw new Error("mcq"); return q.options[q.answer]; };
    expect(key("mt-eevdf-pick")).toMatch(/^C/);
    expect(key("mt-eevdf-lag")).toMatch(/not eligible/);
    expect(key("mt-eevdf-latency")).toMatch(/shorter slice/);
    expect(key("mt-uring-rings")).toMatch(/shared/);
    expect(key("mt-uring-sqpoll")).toMatch(/polls/);
    expect(key("mt-uring-vs-epoll")).toMatch(/completion/);
    expect(key("mt-cg-noint")).toMatch(/cannot hold processes/);
    expect(key("mt-cg-high-max")).toMatch(/not OOM-killed/);
  });
  it("the three lessons exist with passing checks", () => {
    expect(grade(lessonById("modern-eevdf")!.check, { kind: "numeric", value: "106" })).toBe(true);
    expect(grade(lessonById("modern-iouring")!.check, { kind: "numeric", value: "8" })).toBe(true);
    expect(grade(lessonById("modern-cgroup-psi")!.check, { kind: "numeric", value: "50" })).toBe(true);
  });
});
