import { describe, expect, it } from "vitest";
import { SIGNALS, UNCATCHABLE, NICE_WEIGHTS, niceWeight, cfsShares, cpusInMask, maskOf, canOpenFd, TOOL_FACTS } from "@/game/sim/linuxtools";

describe("signals", () => {
  it("matches x86-64 kill -l", () => {
    expect(SIGNALS.SIGKILL).toBe(9);
    expect(SIGNALS.SIGTERM).toBe(15);
    expect(SIGNALS.SIGSEGV).toBe(11);
    expect(SIGNALS.SIGSTOP).toBe(19);
    expect(SIGNALS.SIGCHLD).toBe(17);
  });
  it("has unique numbers and flags KILL and STOP as uncatchable", () => {
    const nums = Object.values(SIGNALS);
    expect(new Set(nums).size).toBe(nums.length);
    expect(UNCATCHABLE).toEqual(["SIGKILL", "SIGSTOP"]);
  });
});

describe("nice weights", () => {
  it("has 40 strictly decreasing entries with nice 0 = 1024", () => {
    expect(NICE_WEIGHTS).toHaveLength(40);
    for (let i = 1; i < 40; i++) expect(NICE_WEIGHTS[i]).toBeLessThan(NICE_WEIGHTS[i - 1]);
    expect(niceWeight(0)).toBe(1024);
    expect(niceWeight(-20)).toBe(88761);
    expect(niceWeight(19)).toBe(15);
  });
  it("each nice step is about 1.25x", () => {
    for (let n = -20; n < 19; n++) expect(niceWeight(n) / niceWeight(n + 1)).toBeGreaterThan(1.15);
    for (let n = -20; n < 19; n++) expect(niceWeight(n) / niceWeight(n + 1)).toBeLessThan(1.3);
  });
  it("splits one core by weight", () => {
    const [a, b] = cfsShares([0, 5]);
    expect(a).toBeCloseTo(1024 / 1359, 6);
    expect(b).toBeCloseTo(335 / 1359, 6);
    expect(cfsShares([0, 0]).every((s) => s === 0.5)).toBe(true);
    expect(cfsShares([0, 10])[0]).toBeCloseTo(0.9029, 3);
  });
  it("rejects out-of-range nice", () => {
    expect(() => niceWeight(20)).toThrow();
    expect(() => niceWeight(1.5)).toThrow();
  });
});

describe("taskset masks", () => {
  it("decodes hex masks", () => {
    expect(cpusInMask("0x5")).toEqual([0, 2]);
    expect(cpusInMask("f0")).toEqual([4, 5, 6, 7]);
    expect(cpusInMask("0x1")).toEqual([0]);
  });
  it("round-trips", () => {
    expect(maskOf([0, 2])).toBe("5");
    expect(maskOf([4, 5, 6, 7])).toBe("f0");
    expect(cpusInMask(maskOf([1, 3, 65]))).toEqual([1, 3, 65]);
  });
  it("rejects non-hex", () => expect(() => cpusInMask("zz")).toThrow());
});

describe("ulimit -n", () => {
  it("allows fds 0..limit-1", () => {
    expect(canOpenFd(1023, 1024)).toBe(true);
    expect(canOpenFd(1024, 1024)).toBe(false);
  });
});

describe("tool table", () => {
  it("has unique tools and answers", () => {
    expect(new Set(TOOL_FACTS.map((t) => t.tool)).size).toBe(TOOL_FACTS.length);
    expect(new Set(TOOL_FACTS.map((t) => t.answers)).size).toBe(TOOL_FACTS.length);
  });
});
