import { describe, expect, it } from "vitest";
import {
  JMODES, J_CHALLENGES, allCrashes, checkJChallenge, classify, crash, gradeJProblem, isSafe, makeJProblem, outcomesOf, writeSequence,
} from "@/game/sim/journalLab";

describe("write sequences", () => {
  it("ordered writes the data before the journal commit", () => {
    const s = writeSequence("ordered");
    expect(s[0]).toMatchObject({ kind: "home", blocks: ["data"] });
    expect(s.findIndex((x) => x.kind === "commit")).toBeGreaterThan(0);
  });
  it("data journaling puts all three blocks in the journal", () => {
    expect(writeSequence("data")[0]!.blocks.sort()).toEqual(["bitmap", "data", "inode"]);
  });
});

describe("classify", () => {
  it("covers the five outcomes", () => {
    expect(classify({ data: false, inode: false, bitmap: false })).toBe("old");
    expect(classify({ data: true, inode: false, bitmap: false })).toBe("old"); // orphan data is invisible
    expect(classify({ data: false, inode: false, bitmap: true })).toBe("leak");
    expect(classify({ data: false, inode: true, bitmap: true })).toBe("garbage");
    expect(classify({ data: true, inode: true, bitmap: false })).toBe("corrupt");
    expect(classify({ data: true, inode: true, bitmap: true })).toBe("new");
  });
});

describe("crash and recovery", () => {
  it("no journal: crash after BITMAP leaks a block, crash after INODE-only order can't happen", () => {
    expect(crash("none", 2).outcome).toBe("leak");
    expect(crash("none", 3).outcome).toBe("new");
    expect(crash("none", 0).outcome).toBe("old");
    expect(crash("none", 1).outcome).toBe("old");
  });
  it("uncommitted transactions are discarded", () => {
    const r = crash("ordered", 2); // data written, journal blocks written, no commit
    expect(r.committed).toBe(false);
    expect(r.replayed).toBe(false);
    expect(r.outcome).toBe("old");
  });
  it("committed transactions are replayed at recovery", () => {
    const r = crash("ordered", 3); // commit durable, nothing checkpointed
    expect(r.onDisk).toEqual({ data: true, inode: false, bitmap: false });
    expect(r.replayed).toBe(true);
    expect(r.outcome).toBe("new");
  });
  it("writeback: a crash right after commit replays metadata but the data never arrived", () => {
    const r = crash("writeback", 2);
    expect(r.outcome).toBe("garbage");
  });
  it("data journaling: crash after commit replays the data too", () => {
    expect(crash("data", 2).outcome).toBe("new");
    expect(crash("data", 1).outcome).toBe("old");
  });
  it("clamps crash points", () => {
    expect(crash("data", -4).crashAfter).toBe(0);
    expect(crash("data", 99).crashAfter).toBe(writeSequence("data").length);
  });
  it("every mode ends in the new state when nothing crashes", () => {
    for (const m of JMODES) expect(allCrashes(m).at(-1)!.outcome).toBe("new");
  });
});

describe("safety per mode", () => {
  it("ordered and data journaling only ever produce old or new", () => {
    expect(isSafe("ordered")).toBe(true);
    expect(isSafe("data")).toBe(true);
    expect(outcomesOf("ordered").sort()).toEqual(["new", "old"]);
  });
  it("writeback can expose garbage; no journal can leak", () => {
    expect(isSafe("writeback")).toBe(false);
    expect(outcomesOf("writeback")).toContain("garbage");
    expect(isSafe("none")).toBe(false);
    expect(outcomesOf("none")).toContain("leak");
  });
});

describe("problems and challenges", () => {
  it("generates deterministic gradable problems across all modes", () => {
    const modes = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const p = makeJProblem(s);
      modes.add(p.mode);
      expect(makeJProblem(s)).toEqual(p);
      expect(gradeJProblem(p, p.answer)).toBe(true);
      expect(gradeJProblem(p, p.answer === "old" ? "new" : "old")).toBe(false);
    }
    expect(modes.size).toBe(4);
  });
  it("every challenge is solved by at least one mode and not by all", () => {
    for (const c of J_CHALLENGES) {
      const solvers = JMODES.filter((m) => checkJChallenge(c, m));
      expect(solvers.length, c.id).toBeGreaterThan(0);
      expect(solvers.length, c.id).toBeLessThan(JMODES.length);
    }
  });
});
