import { describe, expect, it } from "vitest";
import { MODERN_LINUX_QUESTIONS } from "@/content/modernLinuxQuestions";
import { INTERVIEW_EXTRA } from "@/content/interviewQuestions";
import { SCHEDULING_EXTRA } from "@/content/pools";
import { TOPIC_OF } from "@/content/interviewTopics";

describe("Linux scheduler freshness (as of October 2026)", () => {
  const all = [...INTERVIEW_EXTRA, ...SCHEDULING_EXTRA];
  it("EEVDF question keys the earliest eligible virtual deadline", () => {
    const q = INTERVIEW_EXTRA.find((x) => x.id === "ivx-eevdf-pick");
    expect(q).toBeDefined();
    const mcq = q as unknown as { options: string[]; answer: number; explain: string };
    expect(mcq.options[mcq.answer]).toMatch(/earliest virtual deadline/);
    expect(mcq.explain).toMatch(/6\.6/);
  });
  it("CFS questions say they are the classic scheduler and mention EEVDF", () => {
    for (const id of ["sched-cfs", "ivx-cfs-vruntime"]) {
      const q = all.find((x) => x.id === id);
      expect(q, id).toBeDefined();
      expect(`${q!.prompt} ${q!.explain}`, id).toMatch(/EEVDF/);
    }
  });
  it("EEVDF question is in the scheduling topic", () => {
    expect(TOPIC_OF["ivx-eevdf-pick"]).toBe("Scheduling and sync");
  });
});

describe("Modern Linux internals (as of October 2026)", () => {
  const ml = MODERN_LINUX_QUESTIONS as unknown as { id: string; options: string[]; answer: number; explain: string }[];
  it("has six uniquely identified, topic-mapped questions with sane keys", () => {
    expect(new Set(ml.map((q) => q.id)).size).toBe(6);
    for (const q of ml) {
      expect(TOPIC_OF[q.id], q.id).toBeDefined();
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
    }
    expect(new Set(ml.map((q) => q.answer)).size).toBeGreaterThanOrEqual(3);
  });
  it("keys the facts correctly", () => {
    const key = (id: string) => { const q = ml.find((x) => x.id === id)!; return q.options[q.answer]; };
    expect(key("ml-sched-ext")).toMatch(/BPF/);
    expect(key("ml-sched-ext")).toMatch(/fall/);
    expect(key("ml-psi-meaning")).toMatch(/stalled/);
    expect(key("ml-ebpf-verifier")).toMatch(/verifier/);
    expect(key("ml-mglru")).toMatch(/generations/);
    expect(key("ml-folio")).toMatch(/contiguous pages/);
    expect(key("ml-thp-madvise")).toMatch(/madvise/);
  });
  it("states versions", () => {
    const text = (id: string) => ml.find((x) => x.id === id)!.explain;
    expect(text("ml-psi-meaning")).toMatch(/4\.20/);
    expect(text("ml-mglru")).toMatch(/October 2026/);
    expect(text("ml-folio")).toMatch(/5\.16/);
  });
});
