import { describe, expect, it } from "vitest";
import {
  JMODES, applySteps, classify, crashAt, crashMatrix, gradeJournalProblem, journalSteps, makeJournalProblem, recover,
} from "@/game/sim/journalLab";

const outcomes = (m: (typeof JMODES)[number]) => crashMatrix(m).map((r) => r.outcome);

describe("journal step lists", () => {
  it("lists the expected write order per mode", () => {
    const k = (m: (typeof JMODES)[number]) => journalSteps(m).map((s) => (s.blk ? `${s.kind[0]}${s.blk}` : s.kind));
    expect(k("ordered")).toEqual(["hD", "begin", "jI", "jB", "commit", "hI", "hB", "retire"]);
    expect(k("data")).toEqual(["begin", "jD", "jI", "jB", "commit", "hD", "hI", "hB", "retire"]);
    expect(k("writeback")).toEqual(["begin", "jI", "jB", "commit", "hI", "hB", "hD", "retire"]);
    expect(k("none")).toEqual(["hI", "hB", "hD"]);
  });
  it("every mode ends with all blocks in place and the full run is complete", () => {
    JMODES.forEach((m) => expect(crashAt(m, journalSteps(m).length).outcome).toBe("complete"));
  });
});

describe("crash recovery", () => {
  it("data journaling never leaves anything but old or complete", () => {
    outcomes("data").forEach((o) => expect(["old", "complete"]).toContain(o));
    // crash before the commit block = old; crash right after it = replay finishes the job
    expect(crashAt("data", 4).outcome).toBe("old");
    const c = crashAt("data", 5);
    expect(c.outcome).toBe("complete");
    expect(c.replayed).toEqual(["D", "I", "B"]);
  });
  it("ordered journaling never exposes stale data or inconsistency (OSTEP: data before metadata commit)", () => {
    outcomes("ordered").forEach((o) => expect(["old", "complete"]).toContain(o));
    expect(crashAt("ordered", 1).outcome).toBe("old"); // data written, invisible
    expect(crashAt("ordered", 4).outcome).toBe("old"); // no commit yet: discarded
    expect(crashAt("ordered", 4).discarded).toBe(true);
    expect(crashAt("ordered", 5).outcome).toBe("complete"); // commit landed: replay
  });
  it("writeback journaling can expose stale data after a committed transaction", () => {
    expect(crashAt("writeback", 4).outcome).toBe("stale-data");
    expect(crashAt("writeback", 5).outcome).toBe("stale-data");
    expect(crashAt("writeback", 6).outcome).toBe("stale-data");
    expect(crashAt("writeback", 7).outcome).toBe("complete");
    expect(outcomes("writeback")).not.toContain("inconsistent");
    expect(outcomes("writeback")).not.toContain("leak");
  });
  it("no journal: inode-before-bitmap order leaves an inconsistent disk, then stale data", () => {
    expect(outcomes("none")).toEqual(["old", "inconsistent", "stale-data", "complete"]);
  });
  it("replay is idempotent", () => {
    JMODES.forEach((m) => {
      const n = journalSteps(m).length;
      for (let k = 0; k <= n; k++) {
        const once = recover(m, structuredClone(applySteps(m, k)));
        const twice = recover(m, structuredClone(once.state));
        expect(twice.state.home).toEqual(once.state.home);
      }
    });
  });
  it("a retired transaction is not replayed again", () => {
    const c = crashAt("ordered", 8);
    expect(c.replayed).toEqual([]);
    expect(c.outcome).toBe("complete");
  });
  it("clamps the crash point", () => {
    expect(crashAt("ordered", -3).crashAfter).toBe(0);
    expect(crashAt("ordered", 99).crashAfter).toBe(8);
  });
});

describe("classification", () => {
  it("covers all five outcomes", () => {
    expect(classify({ D: false, I: false, B: false })).toBe("old");
    expect(classify({ D: true, I: true, B: true })).toBe("complete");
    expect(classify({ D: false, I: true, B: true })).toBe("stale-data");
    expect(classify({ D: true, I: true, B: false })).toBe("inconsistent");
    expect(classify({ D: true, I: false, B: true })).toBe("leak");
  });
});

describe("generated problems", () => {
  it("are deterministic, cycle the modes and grade by the engine", () => {
    expect(makeJournalProblem(5)).toEqual(makeJournalProblem(5));
    for (let s = 1; s <= 40; s++) {
      const p = makeJournalProblem(s);
      expect(p.mode).toBe(JMODES[s % JMODES.length]);
      expect(p.crashAfter).toBeLessThanOrEqual(journalSteps(p.mode).length);
      expect(gradeJournalProblem(p, crashAt(p.mode, p.crashAfter).outcome)).toBe(true);
      expect(p.answer).toBe(crashAt(p.mode, p.crashAfter).outcome);
    }
  });
});
