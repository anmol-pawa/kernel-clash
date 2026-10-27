import { describe, expect, it } from "vitest";
import { FD_SETSIZE, IO_MODELS, eventLoopThroughput, threadStackBytes, threadedThroughput, waitCost, workersToSaturate } from "@/game/sim/ionet";

describe("Stevens' five I/O models", () => {
  it("only asynchronous I/O avoids blocking in both phases", () => {
    const both = Object.entries(IO_MODELS).filter(([, f]) => !f.waitBlocks && !f.copyBlocks);
    expect(both.map(([m]) => m)).toEqual(["async"]);
    expect(IO_MODELS.blocking).toMatchObject({ waitBlocks: true, copyBlocks: true });
    expect(IO_MODELS.nonblocking).toMatchObject({ waitBlocks: false, copyBlocks: true });
    expect(IO_MODELS.multiplexing).toMatchObject({ waitBlocks: true, copyBlocks: true });
    expect(IO_MODELS.signal).toMatchObject({ waitBlocks: false, copyBlocks: true });
  });

  it("POSIX calls only the async model asynchronous", () => {
    expect(Object.values(IO_MODELS).filter((f) => f.posixAsync)).toHaveLength(1);
  });
});

describe("select, poll and epoll", () => {
  it("select and poll scan every descriptor, epoll only the ready ones", () => {
    expect(waitCost("poll", 10000, 10)).toEqual({ examined: 10000, callerScan: 10000, ok: true });
    expect(waitCost("epoll", 10000, 10)).toEqual({ examined: 10, callerScan: 10, ok: true });
    expect(waitCost("select", 500, 3)).toEqual({ examined: 500, callerScan: 500, ok: true });
  });

  it("select cannot watch a descriptor numbered FD_SETSIZE or higher", () => {
    expect(FD_SETSIZE).toBe(1024);
    expect(waitCost("select", 10, 1, 1023).ok).toBe(true);
    expect(waitCost("select", 10, 1, 1024).ok).toBe(false);
    expect(waitCost("poll", 5000, 1).ok).toBe(true);
  });

  it("select scans up to the highest descriptor even when few are watched", () => {
    expect(waitCost("select", 2, 1, 900).examined).toBe(901);
  });
});

describe("server architectures", () => {
  const load = { cpuMs: 1, waitMs: 9 };

  it("a single blocking worker is limited by CPU + wait, an event loop by CPU alone", () => {
    expect(threadedThroughput(load, 1)).toBe(100);
    expect(eventLoopThroughput(load)).toBe(1000);
  });

  it("adding workers scales until the core saturates", () => {
    expect(threadedThroughput(load, 5)).toBe(500);
    expect(threadedThroughput(load, 10)).toBe(1000);
    expect(threadedThroughput(load, 50)).toBe(1000);
    expect(workersToSaturate(load)).toBe(10);
    expect(workersToSaturate(load, 4)).toBe(40);
    expect(threadedThroughput(load, 40, 4)).toBe(4000);
  });

  it("thread-per-connection stacks add up for C10K", () => {
    expect(threadStackBytes(10000, 8 * 1024 ** 2)).toBe(10000 * 8 * 1024 ** 2);
    expect(threadStackBytes(10000, 64 * 1024) / 1024 ** 2).toBeCloseTo(625);
  });
});
