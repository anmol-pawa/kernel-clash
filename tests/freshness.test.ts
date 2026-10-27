import { describe, expect, it } from "vitest";
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
