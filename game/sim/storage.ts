/**
 * Storage simulators (Silberschatz ch. 11–14): disk-head scheduling (FCFS,
 * SSTF, SCAN, C-SCAN, LOOK, C-LOOK), Unix-style inode maximum file size, block
 * reads for the three file-allocation methods, and RAID capacity. The tests
 * check them against the textbook's worked examples.
 */

export type DiskPolicy = "fcfs" | "sstf" | "scan" | "cscan" | "look" | "clook";
export type Direction = "up" | "down";

/** Silberschatz Figure 11.4: queue 98 183 37 122 14 124 65 67, head at 53, cylinders 0–199. */
export const DISK_EXAMPLE = { queue: [98, 183, 37, 122, 14, 124, 65, 67], head: 53, cylinders: 200 } as const;

export interface DiskResult {
  /** every cylinder the head visits, starting at the initial head position */
  path: number[];
  /** the order requests are served in */
  order: number[];
  /** total cylinders moved; the C-SCAN/C-LOOK return jump is counted when `countJump` */
  movement: number;
}

const total = (path: readonly number[]) => path.slice(1).reduce((s, c, i) => s + Math.abs(c - path[i]), 0);

/**
 * Head movement for a request queue. SCAN and C-SCAN run to the physical end
 * of the disk (cylinders - 1 or 0); LOOK and C-LOOK turn at the last request.
 * The circular policies jump back to the far end; `countJump` includes that
 * return trip in the total (the usual textbook answer for C-SCAN does).
 */
export function scheduleDisk(
  queue: readonly number[], head: number, policy: DiskPolicy, cylinders = 200, direction: Direction = "up", countJump = true,
): DiskResult {
  const path = [head];
  const order: number[] = [];
  const visit = (c: number, serve: boolean) => { path.push(c); if (serve) order.push(c); };

  if (policy === "fcfs") {
    queue.forEach((c) => visit(c, true));
  } else if (policy === "sstf") {
    const left = [...queue];
    let at = head;
    while (left.length) {
      let k = 0;
      left.forEach((c, i) => { if (Math.abs(c - at) < Math.abs(left[k] - at)) k = i; });
      at = left.splice(k, 1)[0];
      visit(at, true);
    }
  } else {
    const up = queue.filter((c) => c >= head).sort((a, b) => a - b);
    const down = queue.filter((c) => c < head).sort((a, b) => b - a);
    const [first, second] = direction === "up" ? [up, down] : [down, up];
    first.forEach((c) => visit(c, true));
    const end = direction === "up" ? cylinders - 1 : 0;
    const other = direction === "up" ? 0 : cylinders - 1;
    if (policy === "scan") {
      if (second.length && path[path.length - 1] !== end) visit(end, false);
      second.forEach((c) => visit(c, true));
    } else if (policy === "look") {
      second.forEach((c) => visit(c, true));
    } else if (policy === "cscan") {
      if (second.length) {
        if (path[path.length - 1] !== end) visit(end, false);
        visit(other, false);
        // the circular sweep resumes from the far end in the same direction
        [...second].reverse().forEach((c) => visit(c, true));
      }
    } else if (second.length) {
      // c-look: jump straight to the request nearest the far end, keep sweeping
      [...second].reverse().forEach((c) => visit(c, true));
    }
  }
  let movement = total(path);
  if (!countJump && (policy === "cscan" || policy === "clook")) {
    const i = path.findIndex((c, k) => k > 0 && Math.abs(c - path[k - 1]) > 0 && (policy === "cscan" ? c === (direction === "up" ? 0 : cylinders - 1) && path[k - 1] === (direction === "up" ? cylinders - 1 : 0) : false));
    if (i > 0) movement -= Math.abs(path[i] - path[i - 1]);
    if (policy === "clook") {
      const asc = direction === "up";
      const k = path.findIndex((c, j) => j > 1 && (asc ? c < path[j - 1] : c > path[j - 1]));
      if (k > 0) movement -= Math.abs(path[k] - path[k - 1]);
    }
  }
  return { path, order, movement };
}

// ---- file allocation ---------------------------------------------------

/** Unix inode: direct pointers plus single, double and triple indirect blocks. */
export function inodeMaxBlocks(blockBytes: number, pointerBytes: number, direct = 12): number {
  const per = Math.floor(blockBytes / pointerBytes);
  return direct + per + per * per + per * per * per;
}

/** Largest file in bytes an inode can address (exact in a double up to 2^53 bytes). */
export function inodeMaxFileBytes(blockBytes: number, pointerBytes: number, direct = 12): number {
  return inodeMaxBlocks(blockBytes, pointerBytes, direct) * blockBytes;
}

export type Allocation = "contiguous" | "linked" | "indexed";

/**
 * Disk reads needed to get logical block `n` (0-based) of a file when only the
 * directory entry is in memory. Contiguous: one read. Linked: follow n+1 links.
 * Indexed: one read for the index block, one for the data block.
 */
export function blockReads(method: Allocation, n: number): number {
  if (method === "contiguous") return 1;
  if (method === "linked") return n + 1;
  return 2;
}

/** Usable data bytes per block when linked allocation spends `pointerBytes` on the next link. */
export function linkedDataBytes(blockBytes: number, pointerBytes: number): number {
  return blockBytes - pointerBytes;
}

// ---- RAID --------------------------------------------------------------

export type RaidLevel = 0 | 1 | 5 | 6 | 10;

/** Usable capacity in disks' worth for `n` equal disks. */
export function raidUsableDisks(level: RaidLevel, n: number): number {
  if (level === 0) return n;
  if (level === 1 || level === 10) return n / 2;
  if (level === 5) return n - 1;
  return n - 2;
}

/** Disk failures survived in the worst case (RAID 1/10 may survive more in the best case). */
export function raidGuaranteedFailures(level: RaidLevel): number {
  return level === 0 ? 0 : level === 6 ? 2 : 1;
}
