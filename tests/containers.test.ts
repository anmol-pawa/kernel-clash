import { describe, expect, it } from "vitest";
import { PidNamespaces, cpuMax, cpuShares, memoryMax } from "@/game/sim/containers";

describe("PID namespaces (pid_namespaces(7))", () => {
  it("the first process in a new namespace is PID 1 inside and a larger PID on the host", () => {
    const ns = new PidNamespaces();
    ns.fork(0);
    ns.fork(0);
    const box = ns.create(0);
    const init = ns.fork(box);
    expect(init.get(box)).toBe(1);
    expect(init.get(0)).toBe(3);
    const sh = ns.fork(box);
    expect(sh.get(box)).toBe(2);
    expect(sh.get(0)).toBe(4);
  });

  it("nested namespaces give a process one PID per level", () => {
    const ns = new PidNamespaces();
    const a = ns.create(0);
    const b = ns.create(a);
    ns.fork(a);
    const p = ns.fork(b);
    expect([p.get(b), p.get(a), p.get(0)]).toEqual([1, 2, 2]);
  });

  it("sibling namespaces count independently", () => {
    const ns = new PidNamespaces();
    const a = ns.create(0);
    const b = ns.create(0);
    expect(ns.fork(a).get(a)).toBe(1);
    expect(ns.fork(b).get(b)).toBe(1);
  });

  it("rejects an unknown namespace", () => {
    expect(() => new PidNamespaces().fork(5)).toThrow();
    expect(() => new PidNamespaces().create(5)).toThrow();
  });
});

describe("cpu.max", () => {
  it('"50000 100000" is half a CPU: four busy threads burn it in 12.5 ms', () => {
    const t = cpuMax(50000, 100000, 4, 8);
    expect(t.cores).toBe(0.5);
    expect(t.runUs).toBe(12500);
    expect(t.throttledUs).toBe(87500);
  });
  it("one thread runs 50 ms then waits 50 ms", () => {
    const t = cpuMax(50000, 100000, 1, 8);
    expect([t.runUs, t.throttledUs]).toEqual([50000, 50000]);
  });
  it("threads beyond the CPU count do not burn quota faster", () => {
    expect(cpuMax(100000, 100000, 16, 2).runUs).toBe(50000);
  });
  it("a quota of at least period * busy CPUs never throttles", () => {
    const t = cpuMax(200000, 100000, 2, 4);
    expect(t.cores).toBe(2);
    expect([t.runUs, t.throttledUs]).toEqual([100000, 0]);
  });
});

describe("cpu.weight", () => {
  it("splits contended CPU in proportion", () => {
    expect(cpuShares([100, 300])).toEqual([0.25, 0.75]);
    expect(cpuShares([100, 100, 100]).every((s) => Math.abs(s - 1 / 3) < 1e-12)).toBe(true);
  });
});

describe("memory.max", () => {
  it("reclaims page cache before killing anything", () => {
    const r = memoryMax(512, [{ name: "app", anonMB: 400 }], 300);
    expect(r.reclaimedMB).toBe(188);
    expect(r.killed).toEqual([]);
  });
  it("does not reclaim when everything fits", () => {
    expect(memoryMax(512, [{ name: "app", anonMB: 200 }], 100).reclaimedMB).toBe(0);
  });
  it("OOM-kills the biggest process when anonymous memory alone exceeds the limit", () => {
    const r = memoryMax(512, [{ name: "web", anonMB: 200 }, { name: "leak", anonMB: 450 }], 50);
    expect(r.reclaimedMB).toBe(50);
    expect(r.killed).toEqual(["leak"]);
    expect(r.survivors.map((p) => p.name)).toEqual(["web"]);
  });
  it("keeps killing until the rest fits", () => {
    const r = memoryMax(300, [{ name: "a", anonMB: 200 }, { name: "b", anonMB: 190 }, { name: "c", anonMB: 150 }], 0);
    expect(r.killed).toEqual(["a", "b"]);
    expect(r.survivors.map((p) => p.name)).toEqual(["c"]);
  });
});
