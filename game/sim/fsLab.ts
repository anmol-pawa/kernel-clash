/**
 * File-system lab engine: how many disk reads does it take to open a path and
 * read one byte offset, under three on-disk layouts for the file's blocks?
 *
 *  - "inode":  classic Unix inode (direct pointers, then single/double/triple indirect blocks)
 *  - "fat":    FAT-style linked clusters (the next-cluster table lives on disk, or is cached in RAM)
 *  - "extent": ext4-style extents (a few inline in the inode, else one extent-tree leaf block)
 *
 * Model assumptions (stated in the UI): cold caches, every directory fits in one
 * block, each lookup reads the parent directory block and then the child's inode
 * (the root inode is read first), one disk read per distinct block.
 */
import { rng } from "@/lib/rng";

export type Layout = "inode" | "fat" | "extent";
export const LAYOUTS: readonly Layout[] = ["inode", "fat", "extent"];
export const LAYOUT_LABEL: Record<Layout, string> = { inode: "Unix inode", fat: "FAT chain", extent: "Extents" };

export interface FsConfig {
  blockBytes: number;
  /** bytes per block pointer / FAT entry */
  pointerBytes: number;
  /** direct pointers in the inode */
  direct: number;
  /** FAT table cached in memory (no disk reads to follow the chain) */
  fatCached: boolean;
  /** extents that fit inside the inode before a tree block is needed */
  inlineExtents: number;
}

export const DEFAULT_FS: FsConfig = { blockBytes: 4096, pointerBytes: 4, direct: 12, fatCached: false, inlineExtents: 4 };

export type ReadKind = "inode" | "dir" | "indirect" | "fat" | "extent-tree" | "data";

export interface DiskRead {
  kind: ReadKind;
  label: string;
}

/** A file: its length and the physical block (or cluster) holding each logical block, in order. */
export interface FsFile {
  sizeBytes: number;
  blocks: number[];
}

export interface Extent {
  /** first logical block */
  logical: number;
  /** first physical block */
  physical: number;
  length: number;
}

/** Split a path into components ("/usr//ast/mbox" -> usr, ast, mbox). */
export function pathParts(path: string): string[] {
  return path.split("/").filter((p) => p.length > 0);
}

/** Reads to resolve a path down to the final inode: root inode, then (dir block, inode) per component. */
export function walkPath(path: string): DiskRead[] {
  const reads: DiskRead[] = [{ kind: "inode", label: "inode of /" }];
  let parent = "/";
  for (const part of pathParts(path)) {
    reads.push({ kind: "dir", label: `directory block of ${parent}` });
    reads.push({ kind: "inode", label: `inode of ${part}` });
    parent = part;
  }
  return reads;
}

/** Logical block number holding a byte offset. */
export const blockIndex = (offset: number, blockBytes: number): number => Math.floor(offset / blockBytes);

/** Number of blocks a file of this size occupies. */
export const blocksFor = (sizeBytes: number, blockBytes: number): number => Math.ceil(sizeBytes / blockBytes);

/** Indirection depth for logical block `idx`: 0 direct, 1 single, 2 double, 3 triple, -1 out of range. */
export function indirectionDepth(idx: number, cfg: FsConfig): number {
  const per = Math.floor(cfg.blockBytes / cfg.pointerBytes);
  if (idx < cfg.direct) return 0;
  let rest = idx - cfg.direct;
  if (rest < per) return 1;
  rest -= per;
  if (rest < per * per) return 2;
  rest -= per * per;
  if (rest < per * per * per) return 3;
  return -1;
}

/** Collapse a block list into maximal runs of consecutive physical blocks. */
export function extentsOf(blocks: readonly number[]): Extent[] {
  const out: Extent[] = [];
  blocks.forEach((p, i) => {
    const last = out[out.length - 1];
    if (last && last.physical + last.length === p) last.length++;
    else out.push({ logical: i, physical: p, length: 1 });
  });
  return out;
}

export type ReadPlan = { ok: true; reads: DiskRead[] } | { ok: false; why: string };

/** The reads needed after the inode is in memory, to fetch the data block holding `offset`. */
export function readOffset(layout: Layout, file: FsFile, offset: number, cfg: FsConfig = DEFAULT_FS): ReadPlan {
  if (!Number.isInteger(offset) || offset < 0) return { ok: false, why: "offset must be a whole number of bytes, 0 or more" };
  if (offset >= file.sizeBytes) return { ok: false, why: `offset ${offset} is at or past the end of the file (${file.sizeBytes} bytes)` };
  const idx = blockIndex(offset, cfg.blockBytes);
  const reads: DiskRead[] = [];
  if (layout === "inode") {
    const depth = indirectionDepth(idx, cfg);
    if (depth < 0) return { ok: false, why: "past the largest file the inode can address" };
    const names = ["single", "double", "triple"];
    for (let d = 0; d < depth; d++) reads.push({ kind: "indirect", label: `${names[d]} indirect block, level ${d + 1}` });
  } else if (layout === "fat") {
    if (!cfg.fatCached) {
      const perFat = Math.floor(cfg.blockBytes / cfg.pointerBytes);
      let lastFatBlock = -1;
      for (let j = 0; j < idx; j++) {
        const fb = Math.floor(file.blocks[j] / perFat);
        if (fb !== lastFatBlock) {
          reads.push({ kind: "fat", label: `FAT block ${fb} (next of cluster ${file.blocks[j]})` });
          lastFatBlock = fb;
        }
      }
    }
  } else {
    if (extentsOf(file.blocks).length > cfg.inlineExtents) reads.push({ kind: "extent-tree", label: "extent tree leaf block" });
  }
  reads.push({ kind: "data", label: `data block ${file.blocks[idx]} (file block ${idx})` });
  return { ok: true, reads };
}

export interface OpenReadResult {
  ok: boolean;
  why?: string;
  reads: DiskRead[];
  total: number;
}

/** Open `path` and read the byte at `offset`: path walk plus the layout's reads. */
export function openAndRead(layout: Layout, path: string, file: FsFile, offset: number, cfg: FsConfig = DEFAULT_FS): OpenReadResult {
  const walk = walkPath(path);
  const plan = readOffset(layout, file, offset, cfg);
  if (!plan.ok) return { ok: false, why: plan.why, reads: walk, total: walk.length };
  const reads = [...walk, ...plan.reads];
  return { ok: true, reads, total: reads.length };
}

/**
 * Build a file of `nBlocks` blocks laid out in `fragments` runs of consecutive
 * physical blocks, run order scrambled but runs never touching.
 */
export function makeFile(nBlocks: number, fragments: number, seed: number, cfg: FsConfig = DEFAULT_FS): FsFile {
  const f = Math.max(1, Math.min(fragments, nBlocks));
  const r = rng(seed);
  const order = r.shuffle(Array.from({ length: f }, (_, i) => i));
  const base = Math.floor(nBlocks / f);
  const extra = nBlocks % f;
  const blocks: number[] = [];
  for (let i = 0; i < f; i++) {
    const len = base + (i < extra ? 1 : 0);
    const start = 1000 + order[i] * (Math.ceil(nBlocks / f) + 10);
    for (let k = 0; k < len; k++) blocks.push(start + k);
  }
  // sizeBytes: last block partly filled
  return { sizeBytes: nBlocks * cfg.blockBytes - Math.floor(cfg.blockBytes / 4), blocks };
}

// ------------------------------------------------------------ generated problems

export interface FsProblem {
  seed: number;
  layout: Layout;
  cfg: FsConfig;
  path: string;
  file: FsFile;
  offset: number;
  answer: number;
}

const NAMES = ["home", "usr", "var", "etc", "log", "data", "ana", "bin", "src", "tmp", "mail", "www"];
const LEAVES = ["notes.txt", "mbox", "app.log", "db.bin", "photo.raw", "report.pdf"];

/** "How many disk reads?" problems: seeded path, file and offset; the answer comes from `openAndRead`. Seeds cycle the layout. */
export function makeFsProblem(seed: number): FsProblem {
  const r = rng(seed * 7919 + 13);
  const layout = LAYOUTS[seed % 3];
  const blockBytes = r.pick([1024, 4096]);
  const cfg: FsConfig = { ...DEFAULT_FS, blockBytes, fatCached: false };
  const depth = r.int(1, 4);
  const dirs = r.shuffle(NAMES).slice(0, depth - 1);
  const path = "/" + [...dirs, r.pick(LEAVES)].join("/");
  // inode problems reach into indirect levels; FAT/extent problems use moderate sizes
  const nBlocks = layout === "inode" ? r.pick([8, 20, 300, 1500]) : r.int(6, 40);
  const fragments = layout === "extent" ? r.pick([1, 2, 3, 6, 9]) : r.int(1, 8);
  const file = makeFile(nBlocks, fragments, seed, cfg);
  const offset = r.int(0, file.sizeBytes - 1);
  const res = openAndRead(layout, path, file, offset, cfg);
  return { seed, layout, cfg, path, file, offset, answer: res.total };
}

/** Grade a numeric answer by re-running the engine on the problem's own parameters. */
export function gradeFsProblem(p: FsProblem, answer: number): boolean {
  return openAndRead(p.layout, p.path, p.file, p.offset, p.cfg).total === answer;
}
