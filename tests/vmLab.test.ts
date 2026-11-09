import { describe, expect, it } from "vitest";
import { splitAddress, walkIndices } from "@/game/sim/memory";
import { BELADY_EXAMPLE, REFERENCE_EXAMPLE, faultCount } from "@/game/sim/paging";
import { DEFAULT_CONFIG, access, gradeTrace, levelBits, makeTrace, newMachine, parseHex, runAll, sanitizeConfig, solveTrace, splitVirtual, type VmConfig } from "@/game/sim/vmLab";

const cfg = (p: Partial<VmConfig> = {}): VmConfig => ({ ...DEFAULT_CONFIG, ...p });
const pageAddr = (page: number, off = 0, bits = 8) => page * 2 ** bits + off;

describe("address split", () => {
  it("agrees with the textbook splitter in game/sim/memory", () => {
    for (const offsetBits of [6, 8, 10]) {
      const { l1, l2 } = levelBits(offsetBits);
      expect(l1 + l2 + offsetBits).toBe(16);
      const ref = splitAddress(16, 2 ** offsetBits, 2, 2 ** offsetBits / 2 ** l2);
      for (const v of [0, 1, 0x1234, 0xabcd, 0xffff]) {
        const mine = splitVirtual(v, offsetBits);
        const w = walkIndices(v, { logical: 16, offset: offsetBits, pageNumber: 16 - offsetBits, levels: [l1, l2] });
        expect([mine.l1, mine.l2]).toEqual(w.indices);
        expect(mine.offset).toBe(w.offset);
      }
      expect(ref.offset).toBe(offsetBits);
    }
  });
  it("splits 0x1234 with 256-byte pages as L1 1, L2 2, offset 0x34", () => {
    expect(splitVirtual(0x1234, 8)).toEqual({ vpn: 0x12, offset: 0x34, l1: 1, l2: 2 });
  });
});

describe("access walk-through", () => {
  it("first touch faults into frame 0, then a repeat hits the TLB", () => {
    const m = newMachine(cfg());
    const first = access(m, 0x1234);
    expect(first.outcome).toBe("fault");
    expect(first.memRefs).toBe(4); // L1 invalid (1) + restarted walk (3)
    expect(first.physical).toBe(0x34);
    expect(first.victim).toBeNull();
    const again = access(m, 0x1299);
    expect(again.outcome).toBe("tlb-hit");
    expect(again.memRefs).toBe(1);
    expect(again.physical).toBe(0x99);
  });
  it("a second page in the same L2 region faults after a 2-reference walk", () => {
    const m = newMachine(cfg());
    access(m, pageAddr(0x10));
    const r = access(m, pageAddr(0x11)); // same L1 index (1)
    expect(r.outcome).toBe("fault");
    expect(r.memRefs).toBe(5);
    expect(r.frame).toBe(1);
  });
  it("a resident page that fell out of the TLB costs a 3-reference walk", () => {
    const m = newMachine(cfg({ tlbEntries: 1 }));
    access(m, pageAddr(1));
    access(m, pageAddr(2));
    const r = access(m, pageAddr(1));
    expect(r.outcome).toBe("walk");
    expect(r.memRefs).toBe(3);
    expect(r.frame).toBe(0);
  });
  it("evicting a page flushes its TLB entry, so a later touch faults, not hits", () => {
    const m = newMachine(cfg({ frames: 1, tlbEntries: 4 }));
    access(m, pageAddr(1));
    const r2 = access(m, pageAddr(2));
    expect(r2.victim).toBe(1);
    expect(access(m, pageAddr(1)).outcome).toBe("fault");
  });
  it("works with no TLB at all", () => {
    const m = newMachine(cfg({ tlbEntries: 0 }));
    access(m, pageAddr(3));
    const r = access(m, pageAddr(3));
    expect(r.outcome).toBe("walk");
    expect(r.memRefs).toBe(3);
  });
  it("FIFO and LRU pick different victims when a hit refreshes only LRU", () => {
    const seq = [1, 2, 3, 1, 4].map((p) => pageAddr(p));
    const fifo = runAll(cfg({ frames: 3, policy: "fifo" }), seq).results[4];
    const lru = runAll(cfg({ frames: 3, policy: "lru" }), seq).results[4];
    expect(fifo.victim).toBe(1);
    expect(lru.victim).toBe(2);
  });
  it("sanitizes configs", () => {
    expect(sanitizeConfig({ offsetBits: 7, tlbEntries: 99, frames: 0, policy: "x" as never })).toEqual({ offsetBits: 8, tlbEntries: 4, frames: 1, policy: "lru" });
  });
});

describe("page faults match the textbook replacement simulator", () => {
  for (const [name, refs] of [["reference string", REFERENCE_EXAMPLE], ["Belady string", BELADY_EXAMPLE]] as const) {
    for (const policy of ["fifo", "lru"] as const) {
      for (const frames of [1, 3, 4]) {
        it(`${name}, ${policy}, ${frames} frames`, () => {
          const { results } = runAll(cfg({ frames, policy, tlbEntries: 2 }), refs.map((p) => pageAddr(p)));
          expect(results.filter((r) => r.outcome === "fault").length).toBe(faultCount(refs, frames, policy));
        });
      }
    }
  }
  it("the textbook counts: 15 FIFO and 12 LRU faults with 3 frames", () => {
    const addrs = REFERENCE_EXAMPLE.map((p) => pageAddr(p));
    expect(runAll(cfg({ frames: 3, policy: "fifo" }), addrs).results.filter((r) => r.outcome === "fault")).toHaveLength(15);
    expect(runAll(cfg({ frames: 3, policy: "lru" }), addrs).results.filter((r) => r.outcome === "fault")).toHaveLength(12);
  });
});

describe("trace challenges", () => {
  it("are reproducible and well-formed", () => {
    expect(makeTrace(5)).toEqual(makeTrace(5));
    for (let s = 1; s <= 200; s++) {
      const c = makeTrace(s);
      expect(c.history.length).toBeGreaterThanOrEqual(5);
      for (const v of [...c.history, c.target]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(65536);
      }
      expect(c.config).toEqual(sanitizeConfig(c.config));
    }
  });
  it("cover every outcome and evictions", () => {
    const seen = new Set<string>();
    let evictions = 0;
    for (let s = 1; s <= 300; s++) {
      const { result } = solveTrace(makeTrace(s));
      seen.add(result.outcome);
      if (result.victim !== null) evictions++;
    }
    expect([...seen].sort()).toEqual(["fault", "tlb-hit", "walk"]);
    expect(evictions).toBeGreaterThan(10);
  });
  it("grading accepts the engine's answer and rejects wrong ones", () => {
    const c = makeTrace(11);
    const { result } = solveTrace(c);
    const good = { outcome: result.outcome, physical: result.physical!, victim: result.victim };
    expect(gradeTrace(c, good).ok).toBe(true);
    expect(gradeTrace(c, { ...good, physical: good.physical + 1 })).toMatchObject({ ok: false, physical: false, outcome: true });
    expect(gradeTrace(c, { ...good, outcome: result.outcome === "fault" ? "walk" : "fault" }).ok).toBe(false);
    expect(gradeTrace(c, { ...good, victim: (good.victim ?? -1) + 1 }).victim).toBe(false);
  });
  it("physical addresses stay inside physical memory", () => {
    for (let s = 1; s <= 100; s++) {
      const c = makeTrace(s);
      const { result } = solveTrace(c);
      expect(result.physical!).toBeLessThan(c.config.frames * 2 ** c.config.offsetBits);
    }
  });
  it("parses hex input", () => {
    expect(parseHex("0x1aF")).toBe(0x1af);
    expect(parseHex(" 20 ")).toBe(0x20);
    expect(parseHex("zz")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});
