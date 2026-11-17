import { describe, expect, it } from "vitest";
import {
  JOURNAL_MODES, crashAfter, crashTable, gradeJournalProblem, makeJournalProblem, writeCount, writeSequence,
} from "@/game/sim/journalLab";

describe("write sequences", () => {
  it("data journaling follows the textbook order: journal D, I, B, commit, then checkpoint", () => {
    const s = writeSequence("data").map((x) => x.kind + (x.block ?? ""));
    expect(s).toEqual(["journal-begin", "journal-blockD", "journal-blockI", "journal-blockB", "commit", "homeD", "homeI", "homeB", "journal-free"]);
  });
  it("ordered mode writes the data to its home location before the commit record", () => {
    const s = writeSequence("ordered");
    const dataAt = s.findIndex((x) => x.kind === "home" && x.block === "D");
    const commitAt = s.findIndex((x) => x.kind === "commit");
    expect(dataAt).toBeLessThan(commitAt);
    expect(s.some((x) => x.kind === "journal-block" && x.block === "D")).toBe(false);
  });
  it("commit always follows every journal content write; free is last among journal steps", () => {
    for (const m of JOURNAL_MODES) {
      const s = writeSequence(m);
      const commit = s.findIndex((x) => x.kind === "commit");
      s.forEach((x, i) => { if (x.kind === "journal-block") expect(i).toBeLessThan(commit); });
      expect(s.findIndex((x) => x.kind === "journal-free")).toBeGreaterThan(commit);
    }
  });
  it("counts writes: data journaling writes the data twice", () => {
    expect(writeCount("data")).toBe(9);
    expect(writeCount("ordered")).toBe(8);
    expect(writeCount("writeback")).toBe(8);
  });
});

describe("crash and recovery", () => {
  it("a crash before the commit record always leaves the old file, in every mode", () => {
    for (const m of JOURNAL_MODES) {
      const commit = writeSequence(m).findIndex((x) => x.kind === "commit");
      for (let k = 0; k <= commit; k++) expect(crashAfter(m, k).outcome, `${m} after ${k}`).toBe("old");
    }
  });
  it("crash right after the commit replays the journal", () => {
    for (const m of JOURNAL_MODES) {
      const commit = writeSequence(m).findIndex((x) => x.kind === "commit");
      const r = crashAfter(m, commit + 1);
      expect(r.replays).toBe(true);
      expect(r.afterRecovery.I).toBe("new");
      expect(r.afterRecovery.B).toBe("new");
    }
  });
  it("data and ordered journaling never expose stale data at any crash point", () => {
    for (const m of ["data", "ordered"] as const) {
      for (const r of crashTable(m)) expect(r.outcome, `${m} after ${r.after}`).not.toBe("stale-data");
    }
  });
  it("writeback journaling can expose stale data: committed metadata, data not yet written", () => {
    const stale = crashTable("writeback").filter((r) => r.outcome === "stale-data");
    expect(stale.length).toBeGreaterThan(0);
    expect(crashAfter("writeback", 4).outcome).toBe("stale-data");
    // once the data is written the append is whole
    expect(crashAfter("writeback", writeCount("writeback")).outcome).toBe("new");
  });
  it("ordered mode leaves an orphan data block when it crashes before the commit", () => {
    expect(crashAfter("ordered", 1).orphanData).toBe(true);
    expect(crashAfter("ordered", 0).orphanData).toBe(false);
    expect(crashAfter("data", 3).orphanData).toBe(false);
  });
  it("data mode: the home data block is old right after commit, new after recovery", () => {
    const r = crashAfter("data", 5);
    expect(r.beforeRecovery.D).toBe("old");
    expect(r.afterRecovery.D).toBe("new");
  });
  it("a finished sequence is a clean new state with nothing to replay", () => {
    for (const m of JOURNAL_MODES) {
      const r = crashAfter(m, writeCount(m));
      expect(r.outcome).toBe("new");
      expect(r.replays).toBe(false);
    }
  });
  it("clamps out-of-range crash points", () => {
    expect(crashAfter("data", -3).after).toBe(0);
    expect(crashAfter("data", 99).after).toBe(9);
  });
});

describe("generated problems", () => {
  it("are deterministic, cover all modes and grade by the engine", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 60; s++) {
      const p = makeJournalProblem(s);
      expect(makeJournalProblem(s)).toEqual(p);
      expect(p.answer).toBe(crashAfter(p.mode, p.after).outcome);
      expect(gradeJournalProblem(p, p.answer)).toBe(true);
      seen.add(p.mode + ":" + p.answer);
    }
    expect(new Set([...seen].map((x) => x.split(":")[0])).size).toBe(3);
    expect(seen.has("writeback:stale-data")).toBe(true);
  });
});
