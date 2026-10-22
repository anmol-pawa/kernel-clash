import { describe, expect, it } from "vitest";
import {
  DISK_EXAMPLE as D, blockReads, inodeMaxBlocks, inodeMaxFileBytes, linkedDataBytes, raidGuaranteedFailures, raidUsableDisks, scheduleDisk,
} from "@/game/sim/storage";

const run = (p: Parameters<typeof scheduleDisk>[2], dir: "up" | "down" = "up", jump = true) =>
  scheduleDisk(D.queue, D.head, p, D.cylinders, dir, jump);

describe("disk scheduling (Silberschatz Figures 11.4–11.9)", () => {
  it("FCFS moves 640 cylinders", () => {
    expect(run("fcfs").movement).toBe(640);
    expect(run("fcfs").order).toEqual([...D.queue]);
  });
  it("SSTF moves 236 cylinders in the textbook order", () => {
    const r = run("sstf");
    expect(r.movement).toBe(236);
    expect(r.order).toEqual([65, 67, 37, 14, 98, 122, 124, 183]);
  });
  it("SCAN toward 0 moves 236, visiting cylinder 0", () => {
    const r = run("scan", "down");
    expect(r.movement).toBe(236);
    expect(r.path).toContain(0);
    expect(r.order).toEqual([37, 14, 65, 67, 98, 122, 124, 183]);
  });
  it("SCAN toward 199 goes to the end then back: 146 + 185 = 331", () => {
    expect(run("scan", "up").movement).toBe(331);
  });
  it("C-SCAN upward: 382 with the return jump, 183 without", () => {
    const r = run("cscan");
    expect(r.order).toEqual([65, 67, 98, 122, 124, 183, 14, 37]);
    expect(r.movement).toBe(382);
    expect(run("cscan", "up", false).movement).toBe(183);
  });
  it("LOOK turns at the last request: 208 down-first, 299 up-first", () => {
    expect(run("look", "down").movement).toBe(208);
    expect(run("look", "up").movement).toBe(299);
  });
  it("C-LOOK upward: 322 with the jump, 153 without", () => {
    expect(run("clook").movement).toBe(322);
    expect(run("clook", "up", false).movement).toBe(153);
  });
  it("LOOK never moves more than SCAN", () => {
    expect(run("look", "up").movement).toBeLessThanOrEqual(run("scan", "up").movement);
  });
  it("an empty queue costs nothing", () => {
    for (const p of ["fcfs", "sstf", "scan", "cscan", "look", "clook"] as const) expect(scheduleDisk([], 50, p).movement).toBe(0);
  });
  it("requests all on one side need no turn", () => {
    expect(scheduleDisk([60, 80], 50, "scan", 200, "up").movement).toBe(30);
    expect(scheduleDisk([60, 80], 50, "cscan", 200, "up").movement).toBe(30);
  });
});

describe("inodes and allocation", () => {
  it("4 KiB blocks, 4-byte pointers: 12 + 1024 + 1024² + 1024³ blocks", () => {
    expect(inodeMaxBlocks(4096, 4)).toBe(12 + 1024 + 1024 ** 2 + 1024 ** 3);
    expect(inodeMaxFileBytes(4096, 4)).toBe(1074791436 * 4096);
  });
  it("1 KiB blocks, 4-byte pointers: 12 + 256 + 256² + 256³", () => {
    expect(inodeMaxBlocks(1024, 4)).toBe(12 + 256 + 65536 + 16777216);
  });
  it("block reads: contiguous 1, linked n+1, indexed 2", () => {
    expect(blockReads("contiguous", 9)).toBe(1);
    expect(blockReads("linked", 9)).toBe(10);
    expect(blockReads("indexed", 9)).toBe(2);
  });
  it("linked blocks lose pointer bytes", () => {
    expect(linkedDataBytes(512, 4)).toBe(508);
  });
});

describe("RAID", () => {
  it("usable disks for 4 drives", () => {
    expect([0, 1, 5, 6, 10].map((l) => raidUsableDisks(l as 0, 4))).toEqual([4, 2, 3, 2, 2]);
  });
  it("guaranteed failures", () => {
    expect([0, 1, 5, 6, 10].map((l) => raidGuaranteedFailures(l as 0))).toEqual([0, 1, 1, 2, 1]);
  });
});
