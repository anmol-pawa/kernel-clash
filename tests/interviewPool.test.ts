import { describe, expect, it } from "vitest";
import { INTERVIEW_EXTRA } from "@/content/interviewQuestions";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { BATTLE_TURNS, POOLS, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { cardKey } from "@/game/engine/leitner";
import { grade, kindOf, questionProblems, type McqQ, type MultiQ, type NumericQ, type OrderQ } from "@/game/engine/question";
import { fcfs, roundRobin, srtf } from "@/game/sim/scheduling";
import { scheduleDisk, DISK_EXAMPLE, blockReads, inodeMaxBlocks, linkedDataBytes, raidGuaranteedFailures, raidUsableDisks } from "@/game/sim/storage";
import { sjf } from "@/game/sim/scheduling";
import { runForks, runForkTree } from "@/game/sim/fork";
import { IPCS, step } from "@/game/sim/processes";
import { BANKER_EXAMPLE, canDeadlock, findCycle, isSafeSequence } from "@/game/sim/deadlock";
import { allocate, effectiveAccessTime, FIT_EXAMPLE, pagesFor, pageTableBytes } from "@/game/sim/memory";
import { BELADY_EXAMPLE, REFERENCE_EXAMPLE, faultCount } from "@/game/sim/paging";

const pool = POOLS.interview;
const find = (id: string) => INTERVIEW_EXTRA.find((q) => q.id === id)!;

/** Processes alive after n unconditional fork() calls, simulated rather than 2**n. */
function forkCount(n: number): number {
  let alive = 1;
  for (let i = 0; i < n; i++) alive += alive;
  return alive;
}

describe("interview pool", () => {
  it("has the six boss questions plus the authored ones, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(24);
    expect(pool.authored.slice(0, 6).map((q) => q.id)).toEqual(GYM_QUESTIONS.interview.map((q) => q.id));
    for (const q of pool.authored) expect(questionProblems(q), q.id).toEqual([]);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.entries(GYM_QUESTIONS).filter(([k]) => k !== "interview").flatMap(([, v]) => v), ...Object.entries(POOLS).filter(([k]) => k !== "interview").flatMap(([, p]) => p.authored)].map((q) => q.id);
    for (const id of INTERVIEW_EXTRA.map((q) => q.id)) expect(elsewhere).not.toContain(id);
  });

  it("covers mcq, multi, numeric and order, and spreads the right answer around", () => {
    const kinds = new Set(INTERVIEW_EXTRA.map(kindOf));
    for (const k of ["mcq", "multi", "numeric", "order"] as const) expect(kinds.has(k), k).toBe(true);
    const mcq = INTERVIEW_EXTRA.filter((q): q is McqQ => kindOf(q) === "mcq");
    expect(new Set(mcq.map((q) => q.answer)).size).toBeGreaterThanOrEqual(3);
    for (const q of mcq) expect(q.options.length, q.id).toBe(4);
  });

  it("grades the intended answer right and a wrong one wrong for every question", () => {
    for (const q of INTERVIEW_EXTRA) {
      switch (kindOf(q)) {
        case "mcq": {
          const m = q as McqQ;
          expect(grade(m, { kind: "mcq", choice: m.answer }), q.id).toBe(true);
          expect(grade(m, { kind: "mcq", choice: (m.answer + 1) % m.options.length }), q.id).toBe(false);
          break;
        }
        case "multi": {
          const m = q as MultiQ;
          expect(grade(m, { kind: "multi", choices: [...m.answers] }), q.id).toBe(true);
          expect(grade(m, { kind: "multi", choices: [m.answers[0]] }), q.id).toBe(false);
          break;
        }
        case "numeric": {
          const n = q as NumericQ;
          expect(grade(n, { kind: "numeric", value: String(n.answer) }), q.id).toBe(true);
          expect(grade(n, { kind: "numeric", value: String(n.answer + 1) }), q.id).toBe(false);
          break;
        }
        case "order": {
          const o = q as OrderQ;
          expect(grade(o, { kind: "order", order: o.steps.map((_, i) => i) }), q.id).toBe(true);
          expect(grade(o, { kind: "order", order: o.steps.map((_, i) => o.steps.length - 1 - i) }), q.id).toBe(false);
          break;
        }
      }
    }
  });

  it("checks each computed answer against the simulators", () => {
    expect((find("ivx-forks") as NumericQ).answer).toBe(forkCount(3));
    // Silberschatz 5.3.4: bursts 24, 3, 3 at quantum 4 wait 6, 4, 7 (average 17/3)
    const rr = roundRobin([{ name: "P1", arrival: 0, burst: 24 }, { name: "P2", arrival: 0, burst: 3 }, { name: "P3", arrival: 0, burst: 3 }], 4);
    expect(rr.waiting).toEqual([6, 4, 7]);
    expect((find("ivx-rr") as NumericQ).answer).toBeCloseTo(rr.avgWaiting, 2);
    expect((find("ivx-eat-tlb") as NumericQ).answer).toBeCloseTo(effectiveAccessTime(0.9, 10, 100), 6);
    const fault = 0.999 * 200 + 0.001 * 8_000_000;
    expect((find("ivx-eat-fault") as NumericQ).answer).toBeCloseTo(fault, 6);
    expect(pagesFor(2 ** 32, 4096).pages).toBe((find("ivx-ptentries") as NumericQ).answer);
    // counting semaphore: 5 waits on a count of 3 leave 2 blocked
    expect((find("ivx-semaphore") as NumericQ).answer).toBe(Math.max(0, 5 - 3));
  });

  it("checks the SJF, SSTF and inode answers against the simulators", () => {
    const jobs = [6, 8, 7, 3].map((burst, i) => ({ name: `P${i + 1}`, arrival: 0, burst }));
    const s = sjf(jobs);
    expect(s.waiting).toEqual([3, 16, 9, 0]);
    expect((find("ivx-sjf") as NumericQ).answer).toBeCloseTo(s.avgWaiting, 6);
    const d = scheduleDisk(DISK_EXAMPLE.queue, DISK_EXAMPLE.head, "sstf");
    expect(d.order).toEqual([65, 67, 37, 14, 98, 122, 124, 183]);
    expect((find("ivx-sstf") as NumericQ).answer).toBe(d.movement);
    expect((find("ivx-inode-blocks") as NumericQ).answer).toBe(inodeMaxBlocks(4096, 4, 12, 1));
  });

  it("keeps the journaling steps in write-ahead order and the link answer on the hard link", () => {
    const o = find("ivx-journal") as OrderQ;
    expect(o.steps[1]).toMatch(/commit/);
    expect(o.steps[2]).toMatch(/final locations/);
    expect((find("ivx-links") as McqQ).options[(find("ivx-links") as McqQ).answer]).toMatch(/hard link keeps working/);
  });

  it("checks the Banker sequence, lock-order and resource-graph answers against the deadlock simulator", () => {
    const b = find("ivx-banker-seq") as McqQ;
    const seqs = b.options.map((o) => (o.match(/\d/g) ?? []).map(Number));
    seqs.forEach((seq, i) => expect(isSafeSequence(BANKER_EXAMPLE, seq), b.options[i]).toBe(i === b.answer));
    expect(canDeadlock([["A", "B"], ["B", "A"]])).toBe(true);
    expect(canDeadlock([["A", "B"], ["A", "B"]])).toBe(false);
    expect((find("ivx-lock-order") as McqQ).options[(find("ivx-lock-order") as McqQ).answer]).toMatch(/global order/);
    expect(findCycle([["P1", "R1"], ["R1", "P2"], ["P2", "R2"], ["R2", "P1"]])).not.toBeNull();
    expect((find("ivx-rag") as McqQ).options[(find("ivx-rag") as McqQ).answer]).toMatch(/definitely deadlocked/);
    expect((find("ivx-coffman") as MultiQ).answers).toEqual([0, 1, 3, 4]);
    expect((find("ivx-coffman") as MultiQ).options[2]).toMatch(/inversion/);
  });

  it("orders the bounded-buffer producer steps: wait(empty), wait(mutex), add, signal(mutex), signal(full)", () => {
    const o = find("ivx-prodcons") as OrderQ;
    expect(o.steps.map((x) => x.split("(")[0])).toEqual(["wait", "wait", "Add the item to the buffer", "signal", "signal"]);
    expect(o.steps[0]).toBe("wait(empty)");
    expect(o.steps[4]).toBe("signal(full)");
  });

  it("checks the paging and allocation answers against the memory simulators", () => {
    expect(faultCount(BELADY_EXAMPLE, 3, "fifo")).toBe(9);
    const bel = find("ivx-belady") as McqQ;
    expect(bel.options[bel.answer]).toBe(`More faults, ${faultCount(BELADY_EXAMPLE, 4, "fifo")}`);
    expect((find("ivx-opt-faults") as NumericQ).answer).toBe(faultCount(REFERENCE_EXAMPLE, 3, "opt"));
    expect([faultCount(REFERENCE_EXAMPLE, 3, "lru"), faultCount(REFERENCE_EXAMPLE, 3, "fifo")]).toEqual([12, 15]);
    const frag = pagesFor(72766, 2048);
    expect(frag.pages).toBe(36);
    expect((find("ivx-internal-frag") as NumericQ).answer).toBe(frag.internalFragmentation);
    expect((find("ivx-table-size") as NumericQ).answer).toBe(pageTableBytes(32, 4096, 4) / 1024);
    const fits = (f: "first" | "best" | "worst") => allocate(FIT_EXAMPLE.holes, FIT_EXAMPLE.requests, f).placements.every((p) => p.start !== null);
    const ff = find("ivx-first-fit") as McqQ;
    expect(["first", "worst", "best"].map((f) => fits(f as "first"))).toEqual([false, false, true]);
    expect(ff.options[ff.answer]).toBe("Best-fit");
  });

  it("checks the disk, allocation and RAID answers against the storage simulators", () => {
    const look = scheduleDisk(DISK_EXAMPLE.queue, DISK_EXAMPLE.head, "look", DISK_EXAMPLE.cylinders, "down");
    expect(look.order).toEqual([37, 14, 65, 67, 98, 122, 124, 183]);
    expect((find("ivx-look") as NumericQ).answer).toBe(look.movement);
    expect(scheduleDisk(DISK_EXAMPLE.queue, DISK_EXAMPLE.head, "scan", DISK_EXAMPLE.cylinders, "down").movement).toBe(236);
    expect((find("ivx-linked-reads") as NumericQ).answer).toBe(blockReads("linked", 9));
    expect([blockReads("contiguous", 9), blockReads("indexed", 9)]).toEqual([1, 2]);
    expect((find("ivx-linked-data") as NumericQ).answer).toBe(linkedDataBytes(4096, 4));
    expect((find("ivx-raid5") as NumericQ).answer).toBe(raidUsableDisks(5, 6) * 2);
    const two = find("ivx-raid-two") as McqQ;
    expect(two.options[two.answer]).toBe("RAID 6");
    expect([0, 1, 5, 6].map((l) => raidGuaranteedFailures(l as 0)).map((f) => f >= 2)).toEqual([false, false, false, true]);
  });

  it("checks the process, fork and IPC answers against the simulators", () => {
    expect((find("ivx-fork-prints") as NumericQ).answer).toBe(runForks(["fork", "print", "fork", "print"]).prints);
    expect(runForks(["fork", "print", "fork", "print"])).toEqual({ processes: 4, prints: 6 });
    const tree = runForkTree([{ op: "ifChild", body: [{ op: "fork" }] }]);
    expect((find("ivx-fork-child") as NumericQ).answer).toBe(tree.processes);
    const wake = find("ivx-wake-state") as McqQ;
    expect(step("WAITING", "wake")).toBe("READY");
    expect(step("WAITING", "dispatch")).toBeNull();
    expect(wake.options[wake.answer]).toMatch(/^READY/);
    expect((find("ivx-exec") as McqQ).options[(find("ivx-exec") as McqQ).answer]).toMatch(/same PID/);
    const ipc = find("ivx-ipc-fast") as McqQ;
    expect(IPCS).toContain("Shared memory");
    expect(ipc.options[ipc.answer]).toBe("Shared memory");
  });

  it("checks the inode, indexed and file-descriptor answers against the simulators", () => {
    expect((find("ivx-inode-double") as NumericQ).answer).toBe(inodeMaxBlocks(4096, 4, 12, 2));
    expect(inodeMaxBlocks(4096, 4, 12, 2) * 4096).toBeGreaterThan(4 * 2 ** 30);
    expect((find("ivx-indexed-reads") as NumericQ).answer).toBe(blockReads("indexed", 500));
    expect(blockReads("linked", 500)).toBe(501);
    for (const id of ["ivx-shared-offset", "ivx-unlink-open", "ivx-write-durable"]) {
      const q = find(id) as McqQ;
      expect(q.answer).toBe(1);
    }
    expect((find("ivx-shared-offset") as McqQ).options[1]).toMatch(/byte 10/);
    expect((find("ivx-unlink-open") as McqQ).options[1]).toMatch(/last open descriptor/);
    expect((find("ivx-write-durable") as McqQ).options[1]).toMatch(/fsync/);
  });

  it("checks the round-robin, SRTF and scheduling-concept answers against the simulators", () => {
    const rr = roundRobin([{ name: "P1", arrival: 0, burst: 24 }, { name: "P2", arrival: 0, burst: 3 }, { name: "P3", arrival: 0, burst: 3 }], 4);
    expect((find("ivx-rr-wait") as NumericQ).answer).toBeCloseTo(rr.avgWaiting, 2);
    const jobs = [{ name: "P1", arrival: 0, burst: 8 }, { name: "P2", arrival: 1, burst: 4 }, { name: "P3", arrival: 2, burst: 9 }, { name: "P4", arrival: 3, burst: 5 }];
    expect((find("ivx-srtf-wait") as NumericQ).answer).toBe(srtf(jobs).avgWaiting);
    const big = roundRobin(jobs, 1000);
    expect(big.waiting).toEqual(fcfs(jobs).waiting);
    expect((find("ivx-rr-quantum") as McqQ).options[0]).toBe("It behaves like FCFS");
    expect((find("ivx-convoy") as McqQ).options[0]).toMatch(/behind one long/);
    expect((find("ivx-aging") as McqQ).options[1]).toMatch(/aging/);
  });

  it("puts the page-fault steps in the right order and keeps every step distinct", () => {
    const o = find("ivx-pagefault") as OrderQ;
    expect(o.steps[0]).toMatch(/traps/);
    expect(o.steps[o.steps.length - 1]).toMatch(/restarts/);
    expect(o.steps.findIndex((s) => /free frame/.test(s))).toBeLessThan(o.steps.findIndex((s) => /reads the page/.test(s)));
    expect(o.steps.findIndex((s) => /reads the page/.test(s))).toBeLessThan(o.steps.findIndex((s) => /page table/.test(s)));
  });

  it("is in the Leitner bank and draws a six-question battle", () => {
    for (const q of INTERVIEW_EXTRA) {
      expect(inBank(cardKey(q)), q.id).toBe(true);
      expect(cardLabel(cardKey(q))?.from).toBe("Kernel Summit");
    }
    const qs = gymBattleQuestions("interview", 3, {}, 0);
    expect(qs).toHaveLength(BATTLE_TURNS);
    expect(new Set(qs.map((q) => q.id)).size).toBe(BATTLE_TURNS);
  });
});
