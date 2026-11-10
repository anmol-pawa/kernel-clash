import { describe, expect, it } from "vitest";
import { replacePages, REFERENCE_EXAMPLE, BELADY_EXAMPLE } from "@/game/sim/paging";
import {
  CHALLENGE_START, DEFAULT_VM, VM_CHALLENGES, access, allowedConfigs, gradeTraceProblem, gradeVmChallenge, makeTraceProblem, newVm, pageAddress, runTrace, splitAddress, type VmConfig,
} from "@/game/sim/vmLab";

const classic: VmConfig = { offsetBits: 12, l1Bits: 10, l2Bits: 10, tlbSize: 4, frames: 8, policy: "fifo" };

describe("address splitting", () => {
  it("cuts a 32-bit address 10-10-12", () => {
    expect(splitAddress(classic, 0x00403004)).toEqual({ l1: 1, l2: 3, offset: 4, vpn: 1 * 1024 + 3 });
    expect(splitAddress(classic, 0xffffffff)).toMatchObject({ l1: 1023, l2: 1023, offset: 4095 });
    expect(splitAddress(classic, 0)).toMatchObject({ l1: 0, l2: 0, offset: 0 });
  });
});

describe("one access", () => {
  const cfg: VmConfig = { ...DEFAULT_VM, frames: 2, tlbSize: 1 };
  it("faults into a free frame, then hits the TLB, then walks after a TLB eviction", () => {
    const a = access(newVm(cfg), pageAddress(cfg, 5, 0x12));
    expect(a.step).toMatchObject({ outcome: "fault-free", frame: 0, pa: 0x12, newTable: true, memRefs: 3, diskReads: 1 });
    const b = access(a.state, pageAddress(cfg, 5, 0x80));
    expect(b.step).toMatchObject({ outcome: "tlb-hit", pa: 0x80, memRefs: 1, diskReads: 0 });
    const c = access(b.state, pageAddress(cfg, 6, 1)); // TLB of 1 entry now holds page 6
    expect(c.step).toMatchObject({ outcome: "fault-free", frame: 1, pa: 0x101 });
    const d = access(c.state, pageAddress(cfg, 5, 3));
    expect(d.step).toMatchObject({ outcome: "walk-hit", frame: 0, pa: 3, memRefs: 3, diskReads: 0 });
  });
  it("evicts, clears the victim's table entry and TLB entry, and shares an inner table", () => {
    let st = newVm({ ...cfg, tlbSize: 4 });
    for (const p of [0, 1]) st = access(st, pageAddress(cfg, p)).state; // pages 0 and 1 share outer entry 0
    const r = access(st, pageAddress(cfg, 2));
    expect(r.step).toMatchObject({ outcome: "fault-evict", victim: 0, frame: 0, newTable: false });
    expect(r.state.tlb.some((e) => e.vpn === 0)).toBe(false);
    expect(r.state.tables[0][0]).toBeUndefined();
    expect(access(r.state, pageAddress(cfg, 0)).step.outcome).toBe("fault-evict");
  });
  it("does not change the input state", () => {
    const s = newVm(cfg);
    access(s, 0x100);
    expect(s.tick).toBe(0);
    expect(s.tlb).toHaveLength(0);
  });
  it("works without a TLB", () => {
    const c = { ...cfg, tlbSize: 0 };
    const r = runTrace(c, [0x100, 0x100, 0x100]);
    expect(r.steps.map((x) => x.outcome)).toEqual(["fault-free", "walk-hit", "walk-hit"]);
    expect(r.memRefs).toBe(9);
  });
});

describe("replacement agrees with paging.ts (Silberschatz 10.4)", () => {
  for (const [name, refs, frames] of [["textbook", REFERENCE_EXAMPLE, 3], ["belady3", BELADY_EXAMPLE, 3], ["belady4", BELADY_EXAMPLE, 4]] as const) {
    for (const policy of ["fifo", "lru"] as const) {
      it(`${name} ${policy} ${frames} frames`, () => {
        const cfg: VmConfig = { ...DEFAULT_VM, frames, policy };
        const r = runTrace(cfg, refs.map((p) => pageAddress(cfg, p)));
        expect(r.faults).toBe(replacePages(refs, frames, policy).faults);
      });
    }
  }
  it("gives the textbook totals", () => {
    const run = (refs: number[], frames: number, policy: "fifo" | "lru") => runTrace({ ...DEFAULT_VM, frames, policy }, refs.map((p) => p * 256)).faults;
    expect(run(REFERENCE_EXAMPLE, 3, "fifo")).toBe(15);
    expect(run(REFERENCE_EXAMPLE, 3, "lru")).toBe(12);
    expect(run(BELADY_EXAMPLE, 3, "fifo")).toBe(9);
    expect(run(BELADY_EXAMPLE, 4, "fifo")).toBe(10);
  });
});

describe("lab challenges", () => {
  it("every challenge is solvable and the default setup does not already solve it", () => {
    for (const ch of VM_CHALLENGES) {
      const ok = allowedConfigs(ch).filter((c) => gradeVmChallenge(ch, c).ok);
      expect(ok.length, ch.id).toBeGreaterThan(0);
      expect(ok.length, ch.id).toBeLessThan(allowedConfigs(ch).length);
      expect(gradeVmChallenge(ch, CHALLENGE_START).ok, ch.id).toBe(false);
    }
  });
  it("accepts the intended answers and rejects the tempting wrong ones", () => {
    const g = (id: string, c: Partial<VmConfig>) => gradeVmChallenge(VM_CHALLENGES.find((x) => x.id === id)!, { ...DEFAULT_VM, ...c }).ok;
    expect(g("vm-fit", { frames: 5 })).toBe(true);
    expect(g("vm-fit", { frames: 4 })).toBe(false);
    expect(g("vm-lru", { policy: "lru" })).toBe(true);
    expect(g("vm-lru", { policy: "fifo" })).toBe(false);
    expect(g("vm-tlb", { tlbSize: 3 })).toBe(true);
    expect(g("vm-tlb", { tlbSize: 2 })).toBe(false);
    expect(g("vm-belady", { frames: 4 })).toBe(true);
    expect(g("vm-belady", { frames: 3 })).toBe(false);
  });
  it("unique ids", () => {
    expect(new Set(VM_CHALLENGES.map((c) => c.id)).size).toBe(VM_CHALLENGES.length);
  });
});

describe("generated trace problems", () => {
  it("are deterministic and graded by the engine", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = makeTraceProblem(seed);
      expect(makeTraceProblem(seed)).toEqual(p);
      expect(gradeTraceProblem(p, p.outcome, p.pa)).toEqual({ outcomeOk: true, paOk: true });
      expect(gradeTraceProblem(p, p.outcome, p.pa + 1).paOk).toBe(false);
      const other = p.outcome === "tlb-hit" ? "walk-hit" : "tlb-hit";
      expect(gradeTraceProblem(p, other, p.pa).outcomeOk).toBe(false);
    }
  });
  it("cover all four outcomes and mostly hit the wanted kind", () => {
    const kinds = new Map<string, number>();
    let match = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const p = makeTraceProblem(seed);
      kinds.set(p.outcome, (kinds.get(p.outcome) ?? 0) + 1);
      if (p.outcome === (["tlb-hit", "walk-hit", "fault-free", "fault-evict"] as const)[seed % 4]) match++;
    }
    expect(kinds.size).toBe(4);
    expect(match).toBeGreaterThan(60);
  });
  it("reports a victim exactly on eviction", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = makeTraceProblem(seed);
      expect(p.victim !== null).toBe(p.outcome === "fault-evict");
    }
  });
});
