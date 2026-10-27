import { describe, expect, it } from "vitest";
import { FdWorld, firstRunTimes, LruCache, nonblockingWrite, SELECT_MAX_FD, submitBurst, TokenBucket } from "@/game/sim/designs";
import { FreeListHeap } from "@/game/sim/allocator";
import { FD_SETSIZE } from "@/game/sim/ionet";

describe("LRU cache", () => {
  it("evicts the least recently used key, and a get counts as a use", () => {
    const c = new LruCache<number>(2);
    c.put("a", 1);
    c.put("b", 2);
    c.get("a");
    expect(c.put("c", 3)).toBe("b");
    expect(c.keys()).toEqual(["a", "c"]);
  });
  it("without recency tracking on get, the hot key would be evicted (FIFO)", () => {
    const c = new LruCache<number>(2);
    c.put("a", 1);
    c.put("b", 2);
    expect(c.put("c", 3)).toBe("a");
  });
  it("a get changes the order, so it mutates shared state", () => {
    const c = new LruCache<number>(3);
    ["a", "b", "c"].forEach((k) => c.put(k, 0));
    const before = c.keys().join();
    c.get("a");
    expect(c.keys().join()).not.toBe(before);
  });
});

describe("token bucket", () => {
  it("allows a burst of capacity, then the steady rate", () => {
    const b = new TokenBucket(5, 1);
    expect([0, 0, 0, 0, 0, 0].map((t) => b.allow(t))).toEqual([true, true, true, true, true, false]);
    expect(b.allow(1000)).toBe(true);
    expect(b.allow(1000)).toBe(false);
  });
  it("caps the refill, so an idle hour does not allow an hour-sized burst", () => {
    const b = new TokenBucket(5, 1);
    for (let i = 0; i < 5; i++) b.allow(0);
    let ok = 0;
    for (let i = 0; i < 100; i++) if (b.allow(3_600_000)) ok++;
    expect(ok).toBe(5);
  });
});

describe("bounded pool", () => {
  it("rejects what neither runs nor fits in the queue", () => {
    expect(submitBurst(8, 2, 3)).toEqual({ running: 2, queued: 3, rejected: 3 });
  });
  it("an unbounded queue never rejects, it just grows", () => {
    expect(submitBurst(1000, 2, null)).toEqual({ running: 2, queued: 998, rejected: 0 });
  });
});

describe("user-space scheduler", () => {
  it("run-to-completion makes short tasks wait behind a long one; round-robin does not", () => {
    expect(firstRunTimes([100, 5, 5], null)).toEqual([0, 100, 105]);
    expect(firstRunTimes([100, 5, 5], 10)).toEqual([0, 10, 15]);
  });
});

describe("shell pipeline", () => {
  const run = (parentClosesWrite: boolean, readerClosesWrite: boolean) => {
    const w = new FdWorld();
    const { read, write, id } = w.pipe(1);
    const a = w.fork(1); // ls
    w.dup2(a, write, 1);
    w.close(a, read);
    w.close(a, write);
    const b = w.fork(1); // wc
    w.dup2(b, read, 0);
    w.close(b, read);
    if (readerClosesWrite) w.close(b, write);
    w.close(1, read);
    if (parentClosesWrite) w.close(1, write);
    w.exit(a);
    return w.readerSeesEof(id);
  };
  it("wc sees EOF only when ls exited and every other copy of the write end is closed", () => {
    expect(run(true, true)).toBe(true);
  });
  it("leaving the write end open in the parent hangs the reader", () => {
    expect(run(false, true)).toBe(false);
  });
  it("leaving the write end open in the reader itself hangs it too", () => {
    expect(run(true, false)).toBe(false);
  });
  it("pipe() takes the lowest free descriptors: 3 and 4 after stdio", () => {
    const w = new FdWorld();
    expect(w.pipe(1)).toMatchObject({ read: 3, write: 4 });
  });
});

describe("malloc and chat server facts", () => {
  it("coalescing lets three adjacent 100-byte frees satisfy a 300-byte request", () => {
    const h = new FreeListHeap(300);
    ["a", "b", "c"].forEach((id) => h.malloc(id, 100));
    ["a", "b", "c"].forEach((id) => h.free(id));
    expect(h.malloc("big", 300)).toBe(0);
    // without merging, the largest hole would stay 100 bytes and this would fail
  });
  it("select cannot watch descriptors at or above FD_SETSIZE", () => {
    expect(SELECT_MAX_FD).toBe(FD_SETSIZE - 1);
  });
  it("a non-blocking write can be short, so the rest must be buffered", () => {
    expect(nonblockingWrite(100_000, 16_384)).toBe(16_384);
    expect(nonblockingWrite(100, 16_384)).toBe(100);
  });
});
