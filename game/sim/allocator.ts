/**
 * Memory allocators: a free-list heap (first / best / worst fit with split and
 * coalescing), the buddy system, and glibc's brk-vs-mmap choice.
 *
 * Facts follow Silberschatz, Operating System Concepts, 10th ed. §10.8.1 (buddy
 * system: a 256 KB segment serves a 21 KB request by halving into 128, 64 and 32
 * KB and handing out the 32 KB block; freed buddies coalesce back) and the glibc
 * malloc documentation (requests of at least M_MMAP_THRESHOLD, 128 KiB by
 * default, are served by mmap; smaller ones come from the brk heap).
 */

export const MMAP_THRESHOLD = 128 * 1024;

/** Where glibc's malloc gets memory for a request of `bytes`. */
export const mallocSource = (bytes: number, threshold = MMAP_THRESHOLD): "brk" | "mmap" => (bytes >= threshold ? "mmap" : "brk");

export type FitPolicy = "first" | "best" | "worst";

export interface Chunk {
  addr: number;
  size: number;
  /** Owner id, or null for a free hole. */
  id: string | null;
}

/** A heap of contiguous chunks; free neighbours coalesce when memory is freed. */
export class FreeListHeap {
  chunks: Chunk[];

  constructor(readonly size: number) {
    this.chunks = [{ addr: 0, size, id: null }];
  }

  /** Allocates `bytes` for `id`; returns the address or null if no hole is big enough. */
  malloc(id: string, bytes: number, policy: FitPolicy = "first"): number | null {
    if (bytes <= 0) throw new Error("size must be positive");
    const holes = this.chunks.filter((c) => c.id === null && c.size >= bytes);
    if (holes.length === 0) return null;
    let pick = holes[0];
    for (const h of holes) {
      if (policy === "best" && h.size < pick.size) pick = h;
      if (policy === "worst" && h.size > pick.size) pick = h;
    }
    const at = this.chunks.indexOf(pick);
    if (pick.size === bytes) pick.id = id;
    else this.chunks.splice(at, 1, { addr: pick.addr, size: bytes, id }, { addr: pick.addr + bytes, size: pick.size - bytes, id: null });
    return pick.addr;
  }

  free(id: string): void {
    const at = this.chunks.findIndex((c) => c.id === id);
    if (at < 0) throw new Error(`${id} is not allocated`);
    this.chunks[at].id = null;
    for (let i = Math.max(0, at - 1); i < this.chunks.length - 1; ) {
      const a = this.chunks[i];
      const b = this.chunks[i + 1];
      if (a.id === null && b.id === null) {
        a.size += b.size;
        this.chunks.splice(i + 1, 1);
      } else if (i >= at) break;
      else i++;
    }
  }

  get freeBytes(): number {
    return this.chunks.filter((c) => c.id === null).reduce((s, c) => s + c.size, 0);
  }

  get largestHole(): number {
    return Math.max(0, ...this.chunks.filter((c) => c.id === null).map((c) => c.size));
  }

  /** External fragmentation: the share of free memory outside the largest hole. */
  get externalFragmentation(): number {
    const f = this.freeBytes;
    return f === 0 ? 0 : 1 - this.largestHole / f;
  }
}

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(n));

export interface BuddyGrant {
  addr: number;
  /** The power-of-two block actually handed out. */
  block: number;
  /** Halvings needed to cut that block from a bigger free one. */
  splits: number;
  /** Internal fragmentation: block minus the bytes asked for. */
  wasted: number;
}

/** Binary buddy allocator over `total` bytes (a power of two) with a smallest block of `minBlock`. */
export class Buddy {
  private free = new Map<number, number[]>();
  private owned = new Map<string, { addr: number; block: number }>();

  constructor(readonly total: number, readonly minBlock = 1) {
    if (nextPow2(total) !== total) throw new Error("total must be a power of two");
    this.free.set(total, [0]);
  }

  alloc(id: string, bytes: number): BuddyGrant | null {
    const block = Math.max(this.minBlock, nextPow2(bytes));
    let size = block;
    while (size <= this.total && !(this.free.get(size)?.length ?? 0)) size *= 2;
    if (size > this.total) return null;
    const addr = this.free.get(size)!.sort((a, b) => a - b).shift()!;
    let splits = 0;
    while (size > block) {
      size /= 2;
      splits++;
      this.free.set(size, [...(this.free.get(size) ?? []), addr + size]);
    }
    this.owned.set(id, { addr, block });
    return { addr, block, splits, wasted: block - bytes };
  }

  /** Frees `id`, merging with free buddies (address XOR size); returns the merges done. */
  release(id: string): number {
    const o = this.owned.get(id);
    if (!o) throw new Error(`${id} is not allocated`);
    this.owned.delete(id);
    let { addr, block } = o;
    let merges = 0;
    for (;;) {
      const list = this.free.get(block) ?? [];
      const buddy = addr ^ block;
      if (block < this.total && list.includes(buddy)) {
        this.free.set(block, list.filter((a) => a !== buddy));
        addr = Math.min(addr, buddy);
        block *= 2;
        merges++;
      } else {
        this.free.set(block, [...list, addr]);
        return merges;
      }
    }
  }

  /** Free blocks as [addr, size], sorted by address. */
  freeBlocks(): [number, number][] {
    return [...this.free].flatMap(([size, addrs]) => addrs.map((a) => [a, size] as [number, number])).sort((a, b) => a[0] - b[0]);
  }
}

/**
 * Slab allocation (Bonwick 1994; Silberschatz §10.8.2): a cache holds objects of
 * one size in slabs (one or more contiguous pages). Objects are constructed when
 * a slab is created and stay constructed while free, so alloc/free only flip a
 * flag. Alloc prefers a partial slab, then an empty one, then grows the cache.
 */
export const slabObjects = (slabBytes: number, objBytes: number) => Math.floor(slabBytes / objBytes);

/** Bytes lost per slab because the slab size is not a multiple of the object size. */
export const slabLeftover = (slabBytes: number, objBytes: number) => slabBytes - slabObjects(slabBytes, objBytes) * objBytes;

export class SlabCache {
  /** Used-object count per slab. */
  slabs: number[] = [];
  /** Constructor calls made so far (one per object, when its slab is created). */
  constructorCalls = 0;
  readonly perSlab: number;

  constructor(readonly slabBytes: number, readonly objBytes: number) {
    this.perSlab = slabObjects(slabBytes, objBytes);
    if (this.perSlab < 1) throw new Error("object larger than a slab");
  }

  /** Allocates one object; returns the slab index it came from. */
  alloc(): number {
    let at = this.slabs.findIndex((u) => u > 0 && u < this.perSlab);
    if (at < 0) at = this.slabs.findIndex((u) => u === 0);
    if (at < 0) {
      this.slabs.push(0);
      at = this.slabs.length - 1;
      this.constructorCalls += this.perSlab;
    }
    this.slabs[at]++;
    return at;
  }

  free(slab: number): void {
    if (!(this.slabs[slab] > 0)) throw new Error("slab has no used objects");
    this.slabs[slab]--;
  }

  get states() {
    return {
      full: this.slabs.filter((u) => u === this.perSlab).length,
      partial: this.slabs.filter((u) => u > 0 && u < this.perSlab).length,
      empty: this.slabs.filter((u) => u === 0).length,
    };
  }
}

/**
 * Thread-local caches (the tcmalloc / jemalloc tcache idea): each thread serves
 * allocations from a private list and only takes the shared central lock to
 * refill `batch` objects at a time. Returns central-lock acquisitions.
 */
export const centralLockAcquisitions = (allocs: number, batch: number | null): number => (batch === null ? allocs : Math.ceil(allocs / batch));

/** Bytes of address space the TLB covers: entries × page size. */
export const tlbReach = (entries: number, pageBytes: number) => entries * pageBytes;

/** Pages (hence TLB entries and PTEs) needed to map `bytes`. */
export const pagesToMap = (bytes: number, pageBytes: number) => Math.ceil(bytes / pageBytes);

/** Bytes of leaf page-table entries (8 bytes each on x86-64) to map `bytes`. */
export const leafTableBytes = (bytes: number, pageBytes: number) => pagesToMap(bytes, pageBytes) * 8;
