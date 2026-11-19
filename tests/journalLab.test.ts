import { describe, expect, it } from "vitest";
import {
  JOURNAL_MODES, REACHABLE_OUTCOMES, alwaysSafe, classify, crashTable, gradeJournalProblem, makeJournalProblem, recover, stateAfter,
  totalBlockWrites, writeSteps,
} from "@/game/sim/journalLab";

const outcomes = (m: Parameters<typeof crashTable>[0]) => crashTable(m).map((r) => r.outcome);

describe("journaling crash simulator", () => {
  it("the full sequence always ends in the new state, and no steps means the old state", () => {
    for (const m of JOURNAL_MODES) {
      const t = crashTable(m);
      expect(t[0].outcome).toBe("old");
      expect(t[t.length - 1].outcome).toBe("new");
    }
  });

  it("no journal: crashing mid-update leaves an inconsistent or stale-data file (needs fsck)", () => {
    expect(outcomes("none")).toEqual(["old", "inconsistent", "garbage", "new"]);
    expect(crashTable("none").slice(1, 3).every((r) => r.recovery.action === "fsck-needed")).toBe(true);
    expect(alwaysSafe("none")).toBe(false);
  });

  it("ordered mode never exposes stale data: old or new at every crash point", () => {
    expect(outcomes("ordered")).toEqual(["old", "old", "old", "new", "new", "new", "new"]);
    expect(alwaysSafe("ordered")).toBe(true);
  });

  it("writeback mode can replay a committed transaction whose data never reached disk (stale-data exposure)", () => {
    // after the commit block (2 steps) the data block has not been written yet
    const row = crashTable("writeback")[2];
    expect(row.recovery.action).toBe("replay");
    expect(row.outcome).toBe("garbage");
    expect(outcomes("writeback")).toEqual(["old", "old", "garbage", "new", "new", "new", "new"]);
    expect(alwaysSafe("writeback")).toBe(false);
  });

  it("data journaling is all-or-nothing at the commit block", () => {
    expect(outcomes("data")).toEqual(["old", "old", "new", "new", "new", "new", "new"]);
    expect(alwaysSafe("data")).toBe(true);
  });

  it("an uncommitted transaction is discarded; a committed one is replayed", () => {
    expect(recover("ordered", stateAfter("ordered", 2)).action).toBe("discard");
    expect(recover("ordered", stateAfter("ordered", 3)).action).toBe("replay");
    expect(recover("ordered", stateAfter("ordered", 6)).action).toBe("none");
  });

  it("recovery is idempotent", () => {
    for (const m of JOURNAL_MODES) {
      for (const r of crashTable(m)) {
        const again = recover(m, r.recovery.state);
        expect(classify(again.state)).toBe(r.outcome);
      }
    }
  });

  it("write amplification: 3 blocks without a journal, 8 for metadata journaling, 9 for data journaling", () => {
    expect(totalBlockWrites("none")).toBe(3);
    expect(totalBlockWrites("writeback")).toBe(8);
    expect(totalBlockWrites("ordered")).toBe(8);
    expect(totalBlockWrites("data")).toBe(9);
  });

  it("classify covers the textbook single-write failures", () => {
    const base = { data: false, inode: false, bitmap: false, jBegin: false, jInode: false, jBitmap: false, jData: false, jCommit: false, jFreed: false };
    expect(classify({ ...base, bitmap: true })).toBe("leak");
    expect(classify({ ...base, inode: true })).toBe("inconsistent");
    expect(classify({ ...base, inode: true, bitmap: true })).toBe("garbage");
    expect(classify({ ...base, data: true })).toBe("old");
  });

  it("every mode has at least one step and the reachable outcomes are the four a crash can produce", () => {
    for (const m of JOURNAL_MODES) expect(writeSteps(m).length).toBeGreaterThan(0);
    expect([...REACHABLE_OUTCOMES].sort()).toEqual(["garbage", "inconsistent", "new", "old"]);
  });

  it("generated problems are deterministic, in range, and graded against the table", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = makeJournalProblem(seed);
      expect(makeJournalProblem(seed)).toEqual(p);
      expect(p.done).toBeGreaterThanOrEqual(0);
      expect(p.done).toBeLessThanOrEqual(writeSteps(p.mode).length);
      expect(p.answer).toBe(crashTable(p.mode)[p.done].outcome);
      expect(gradeJournalProblem(p, p.answer)).toBe(true);
      expect(gradeJournalProblem(p, p.answer === "old" ? "new" : "old")).toBe(false);
    }
    const modes = new Set(Array.from({ length: 60 }, (_, i) => makeJournalProblem(i + 1).mode));
    expect(modes.size).toBe(4);
  });
});
