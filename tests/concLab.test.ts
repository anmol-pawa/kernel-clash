import { describe, expect, it } from "vitest";
import { CONC_CHALLENGES, checkConcChallenge, parseProgram, runConc, verdict } from "@/game/sim/concLab";
import { opText } from "@/game/sim/threads";

describe("concurrency lab DSL", () => {
  it("parses every statement form", () => {
    const p = parseProgram(`var x = 3
sem s = 1
spurious
thread T
r = x
r += 2
x = r
x = 5
x += -1
lock m
unlock m
wait s
post s
cwait c m
signal c
broadcast c
top:
if r < 10 goto top
goto top
assert x != 0`);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.program.spurious).toBe(true);
    expect(p.program.threads[0]!.code.map(opText)).toEqual([
      "r = x", "r += 2", "x = r", "x = 5", "x += -1", "lock(m)", "unlock(m)", "sem_wait(s)", "sem_post(s)",
      "cond_wait(c, m)", "cond_signal(c)", "cond_broadcast(c)", "top:", "if (r < 10) goto top", "goto top", "assert(x != 0)",
    ]);
  });

  it("reports errors with line numbers", () => {
    expect(parseProgram("lock m")).toMatchObject({ ok: false, error: { line: 1 } });
    expect(parseProgram("thread A\nwait s")).toMatchObject({ ok: false, error: { line: 2 } });
    expect(parseProgram("thread A\nfoo bar baz qux")).toMatchObject({ ok: false, error: { line: 2 } });
    expect(parseProgram("thread A\ngoto nowhere").ok).toBe(false);
    expect(parseProgram("").ok).toBe(false);
    expect(parseProgram("thread A\nthread B\nthread C\nthread D").ok).toBe(false);
  });

  it("finds the lost update and its shortest schedule", () => {
    const r = runConc(CONC_CHALLENGES[0]!.starter);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.finals.map((f) => f.count).sort()).toEqual([1, 2]);
    expect(verdict(r.report).text).toMatch(/depends on the schedule/); // no assert: the goal catches it
  });
});

describe("concurrency lab challenges", () => {
  it("has eight with unique ids", () => {
    expect(CONC_CHALLENGES.length).toBe(8);
    expect(new Set(CONC_CHALLENGES.map((c) => c.id)).size).toBe(8);
  });
  for (const c of CONC_CHALLENGES) {
    it(`${c.id}: starter fails, reference fix passes`, () => {
      expect(checkConcChallenge(c, c.starter).passed).toBe(false);
      const ok = checkConcChallenge(c, c.solution);
      expect(ok.message).toMatch(/^(SAFE|No crash)/);
      expect(ok.passed).toBe(true);
    });
  }
  it("starters fail for the intended reason", () => {
    const why = (id: string) => {
      const r = runConc(CONC_CHALLENGES.find((c) => c.id === id)!.starter);
      if (!r.ok) throw new Error(r.error.message);
      return verdict(r.report);
    };
    expect(why("mutual-exclusion").text).toMatch(/^FAILS/);
    expect(why("lock-order").text).toMatch(/^DEADLOCK/);
    expect(why("lost-wakeup").text).toMatch(/^DEADLOCK/);
    expect(why("if-vs-while").text).toMatch(/^FAILS/);
    expect(why("sem-mutex").text).toMatch(/^FAILS/);
    expect(why("rendezvous").text).toMatch(/^DEADLOCK/);
    expect(why("early-exit").text).toMatch(/^DEADLOCK/);
  });
  it("rejects a 'fix' that deletes the work", () => {
    expect(checkConcChallenge(CONC_CHALLENGES[0]!, "var count = 0\nthread A\ncount = 0").passed).toBe(false);
  });
});
