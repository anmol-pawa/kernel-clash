import { describe, expect, it } from "vitest";
import { inodeMaxBlocks } from "@/game/sim/storage";
import {
  DEFAULT_FS, LAYOUTS, blockIndex, extentsOf, gradeFsProblem, indirectionDepth, makeFile, makeFsProblem, openAndRead, pathParts, readOffset, walkPath,
  type FsFile,
} from "@/game/sim/fsLab";

const flat = (n: number, start = 500): FsFile => ({ sizeBytes: n * 4096, blocks: Array.from({ length: n }, (_, i) => start + i) });

describe("path walk", () => {
  it("/usr/ast/mbox takes 7 reads to reach the inode (root inode + dir block and inode per component)", () => {
    expect(walkPath("/usr/ast/mbox")).toHaveLength(7);
    expect(walkPath("/")).toHaveLength(1);
  });
  it("ignores empty components", () => {
    expect(pathParts("//a///b/")).toEqual(["a", "b"]);
    expect(walkPath("//a///b/")).toHaveLength(5);
  });
  it("alternates dir block and inode", () => {
    expect(walkPath("/a/b").map((r) => r.kind)).toEqual(["inode", "dir", "inode", "dir", "inode"]);
  });
});

describe("inode layout", () => {
  it("direct, single, double and triple depths with 4 KB blocks and 4-byte pointers", () => {
    expect(indirectionDepth(0, DEFAULT_FS)).toBe(0);
    expect(indirectionDepth(11, DEFAULT_FS)).toBe(0);
    expect(indirectionDepth(12, DEFAULT_FS)).toBe(1);
    expect(indirectionDepth(12 + 1023, DEFAULT_FS)).toBe(1);
    expect(indirectionDepth(12 + 1024, DEFAULT_FS)).toBe(2);
    expect(indirectionDepth(12 + 1024 + 1024 ** 2, DEFAULT_FS)).toBe(3);
  });
  it("depth boundaries agree with storage.ts inodeMaxBlocks", () => {
    const total = inodeMaxBlocks(4096, 4);
    expect(indirectionDepth(total - 1, DEFAULT_FS)).toBe(3);
    expect(indirectionDepth(total, DEFAULT_FS)).toBe(-1);
  });
  it("data reads add one read per indirection level", () => {
    const f = flat(2000);
    const reads = (off: number) => {
      const p = readOffset("inode", f, off);
      return p.ok ? p.reads.length : -1;
    };
    expect(reads(0)).toBe(1);
    expect(reads(12 * 4096)).toBe(2);
    expect(reads((12 + 1024) * 4096)).toBe(3);
  });
});

describe("FAT layout", () => {
  it("uncached: one FAT read per distinct FAT block on the way, then the data", () => {
    // 4 KB blocks, 4-byte entries: 1024 entries per FAT block. Clusters 10,11,12 share FAT block 0.
    const f: FsFile = { sizeBytes: 4 * 4096, blocks: [10, 11, 12, 2000] };
    const p = readOffset("fat", f, 3 * 4096);
    expect(p.ok && p.reads.map((r) => r.kind)).toEqual(["fat", "data"]);
    // a chain that hops FAT blocks: 10 (block 0), 1500 (block 1), 20 (block 0), then target
    const g: FsFile = { sizeBytes: 4 * 4096, blocks: [10, 1500, 20, 7] };
    const q = readOffset("fat", g, 3 * 4096);
    expect(q.ok && q.reads.filter((r) => r.kind === "fat")).toHaveLength(3);
  });
  it("block 0 needs no FAT read; cached FAT needs none at all", () => {
    const f = flat(10);
    const a = readOffset("fat", f, 0);
    expect(a.ok && a.reads).toHaveLength(1);
    const b = readOffset("fat", f, 9 * 4096, { ...DEFAULT_FS, fatCached: true });
    expect(b.ok && b.reads).toHaveLength(1);
  });
});

describe("extent layout", () => {
  it("compresses consecutive blocks into runs", () => {
    expect(extentsOf([5, 6, 7, 20, 21, 9])).toEqual([
      { logical: 0, physical: 5, length: 3 },
      { logical: 3, physical: 20, length: 2 },
      { logical: 5, physical: 9, length: 1 },
    ]);
  });
  it("up to four extents are inline, five need a tree block", () => {
    const four = makeFile(20, 4, 1);
    const five = makeFile(20, 5, 1);
    expect(extentsOf(four.blocks)).toHaveLength(4);
    expect(extentsOf(five.blocks)).toHaveLength(5);
    const a = readOffset("extent", four, 0);
    const b = readOffset("extent", five, 0);
    expect(a.ok && a.reads).toHaveLength(1);
    expect(b.ok && b.reads).toHaveLength(2);
  });
});

describe("open and read", () => {
  it("/usr/ast/mbox first byte on every layout is 8 reads", () => {
    for (const l of LAYOUTS) expect(openAndRead(l, "/usr/ast/mbox", flat(3), 0).total).toBe(8);
  });
  it("rejects offsets past the end or negative", () => {
    const f = flat(2);
    expect(openAndRead("inode", "/a", f, f.sizeBytes).ok).toBe(false);
    expect(openAndRead("inode", "/a", f, -1).ok).toBe(false);
    expect(openAndRead("inode", "/a", f, 1.5).ok).toBe(false);
  });
  it("blockIndex floors", () => {
    expect(blockIndex(4095, 4096)).toBe(0);
    expect(blockIndex(4096, 4096)).toBe(1);
  });
});

describe("makeFile", () => {
  it("produces the requested block and fragment counts, runs never touching", () => {
    for (const [n, f] of [[10, 1], [10, 3], [37, 8], [5, 9]] as const) {
      const file = makeFile(n, f, 3);
      expect(file.blocks).toHaveLength(n);
      expect(extentsOf(file.blocks)).toHaveLength(Math.min(f, n));
      expect(new Set(file.blocks).size).toBe(n);
    }
  });
});

describe("generated problems", () => {
  it("are deterministic, cycle layouts, stay in range and grade correctly", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 120; s++) {
      const p = makeFsProblem(s);
      expect(makeFsProblem(s)).toEqual(p);
      seen.add(p.layout);
      expect(p.offset).toBeGreaterThanOrEqual(0);
      expect(p.offset).toBeLessThan(p.file.sizeBytes);
      expect(p.answer).toBeGreaterThanOrEqual(2);
      expect(gradeFsProblem(p, p.answer)).toBe(true);
      expect(gradeFsProblem(p, p.answer + 1)).toBe(false);
    }
    expect(seen.size).toBe(3);
  });
  it("answers equal path reads plus layout reads computed independently", () => {
    for (let s = 1; s <= 60; s++) {
      const p = makeFsProblem(s);
      const depth = pathParts(p.path).length;
      const idx = blockIndex(p.offset, p.cfg.blockBytes);
      let extra = 1;
      if (p.layout === "inode") extra += indirectionDepth(idx, p.cfg);
      if (p.layout === "extent") extra += extentsOf(p.file.blocks).length > 4 ? 1 : 0;
      if (p.layout === "fat") {
        const per = p.cfg.blockBytes / 4;
        let last = -1;
        for (let j = 0; j < idx; j++) {
          const fb = Math.floor(p.file.blocks[j] / per);
          if (fb !== last) { extra++; last = fb; }
        }
      }
      expect(p.answer).toBe(1 + 2 * depth + extra);
    }
  });
});
