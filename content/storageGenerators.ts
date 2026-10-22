import type { Generator, McqQ, NumericQ } from "@/game/engine/question";
import { blockReads, inodeMaxBlocks, linkedDataBytes, raidUsableDisks, scheduleDisk, type Allocation, type DiskPolicy, type RaidLevel } from "@/game/sim/storage";
import { rng, type Rng } from "@/lib/rng";

const st = (name: string, power: number) => ({ name, type: "storage" as const, power });
const DISK_NAMES: Record<DiskPolicy, string> = { fcfs: "FCFS", sstf: "SSTF", scan: "SCAN", cscan: "C-SCAN", look: "LOOK", clook: "C-LOOK" };
const CYLINDERS = 200;

/** SSTF with two equally near requests is ambiguous, so problems avoid it. */
export function sstfTies(queue: readonly number[], head: number): boolean {
  const left = [...queue];
  let at = head;
  while (left.length) {
    const d = left.map((c) => Math.abs(c - at)).sort((a, b) => a - b);
    if (d.length > 1 && d[0] === d[1]) return true;
    at = left.splice(left.findIndex((c) => Math.abs(c - at) === d[0]), 1)[0];
  }
  return false;
}

/** A queue of distinct cylinders with requests on both sides of the head, and no SSTF ties. */
function diskQueue(r: Rng, count: number): { queue: number[]; head: number } {
  for (;;) {
    const head = r.int(20, 180);
    const queue: number[] = [];
    while (queue.length < count) {
      const c = r.int(0, CYLINDERS - 1);
      if (c !== head && !queue.includes(c)) queue.push(c);
    }
    if (queue.some((c) => c < head) && queue.some((c) => c > head) && !sstfTies(queue, head)) return { queue, head };
  }
}

/** Total head movement for a policy. */
export const headMovement: Generator = {
  id: "gen-st-movement",
  topic: "Disk scheduling: total head movement",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xd15c);
    const policy = r.pick(["fcfs", "sstf", "scan", "cscan", "look", "clook"] as DiskPolicy[]);
    const { queue, head } = diskQueue(r, r.int(6, 8));
    const direction = r.pick(["up", "down"] as const);
    const circular = policy === "cscan" || policy === "clook";
    const res = scheduleDisk(queue, head, policy, CYLINDERS, direction, true);
    const sweeps = policy === "fcfs" || policy === "sstf" ? "" : ` The head is moving toward ${direction === "up" ? "higher" : "lower"} cylinders.`;
    const jump = circular ? " Count the return jump." : "";
    const turn = policy === "scan" || policy === "cscan" ? ` ${DISK_NAMES[policy]} goes all the way to the end of the disk before turning.` : policy === "look" || policy === "clook" ? ` ${DISK_NAMES[policy]} turns at the last request in each direction.` : "";
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A disk has cylinders 0–${CYLINDERS - 1}. The head is at ${head} and the queue is ${queue.join(", ")}.${sweeps}${turn}${jump} How many cylinders does the head move under ${DISK_NAMES[policy]}?`,
      answer: res.movement,
      unit: "cylinders",
      explain: `${DISK_NAMES[policy]} visits ${res.path.join(" → ")}, so the moves add up to ${res.movement} cylinders.${res.order.length ? ` Service order: ${res.order.join(", ")}.` : ""}`,
      move: st("Seek Sweep", 34),
    };
  },
};

/** Which request does a policy serve first? */
export const firstServed: Generator = {
  id: "gen-st-first",
  topic: "Disk scheduling: which request is served first?",
  make(seed): McqQ {
    const r = rng(seed ^ 0xf125);
    for (;;) {
      const policy = r.pick(["sstf", "scan", "look", "cscan", "clook"] as DiskPolicy[]);
      const { queue, head } = diskQueue(r, 6);
      const direction = r.pick(["up", "down"] as const);
      const first = scheduleDisk(queue, head, policy, CYLINDERS, direction).order[0];
      if (first === queue[0]) continue;
      const wrong = r.shuffle(queue.filter((c) => c !== first)).slice(0, 3);
      const options = r.shuffle([first, ...wrong]);
      const how = policy === "sstf" ? "the request nearest the head" : `the nearest request in the direction of travel (${direction === "up" ? "up" : "down"})`;
      return {
        id: `${this.id}#${seed}`,
        prompt: `The head is at ${head} on a ${CYLINDERS}-cylinder disk, moving ${direction === "up" ? "toward higher" : "toward lower"} cylinders. The queue arrived as ${queue.join(", ")}. Which request does ${DISK_NAMES[policy]} serve first?`,
        options: options.map((c) => `Cylinder ${c}`),
        answer: options.indexOf(first),
        explain: `${DISK_NAMES[policy]} serves ${how}: cylinder ${first}. (FCFS would serve ${queue[0]}, the oldest.)`,
        move: st("Nearest Nab", 34),
      };
    }
  },
};

/** Maximum blocks addressable by an inode with direct, single and double indirect pointers. */
export const inodeBlocks: Generator = {
  id: "gen-st-inode",
  topic: "Inodes: how many blocks can a file use?",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x10de);
    const block = r.pick([512, 1024, 2048, 4096]);
    const ptr = r.pick([4, 4, 8]);
    const direct = r.pick([10, 12, 12, 15]);
    const per = Math.floor(block / ptr);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `An inode has ${direct} direct pointers, one single indirect and one double indirect pointer. Blocks are ${block} bytes and pointers are ${ptr} bytes. What is the largest file, in blocks?`,
      answer: inodeMaxBlocks(block, ptr, direct, 2),
      unit: "blocks",
      explain: `An indirect block holds ${block} / ${ptr} = ${per} pointers. Blocks = ${direct} direct + ${per} single + ${per} × ${per} = ${per * per} double = ${direct + per + per * per}.`,
      move: st("Inode Ink", 32),
    };
  },
};

const METHOD_NAMES: Record<Allocation, string> = { contiguous: "contiguous", linked: "linked", indexed: "indexed" };

/** Disk reads to reach block n under an allocation method. */
export const allocationReads: Generator = {
  id: "gen-st-reads",
  topic: "File allocation: reads to reach a block",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xa110c);
    const method = r.pick(["linked", "linked", "indexed", "contiguous"] as Allocation[]);
    const n = r.int(3, 40);
    const reads = blockReads(method, n);
    const why = method === "linked" ? `a linked file must follow the chain from block 0, so reaching block ${n} takes ${n} + 1 = ${reads} reads` : method === "indexed" ? "one read for the index block, then one for the data block: 2" : "the start address plus the offset gives the block directly: 1 read";
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A file uses ${METHOD_NAMES[method]} allocation. Only its directory entry is in memory (no caches). How many disk reads does it take to read logical block ${n}, counting from 0 and including the data block itself?`,
      answer: reads,
      unit: "reads",
      explain: `With ${METHOD_NAMES[method]} allocation, ${why}.`,
      move: st("Chain Lookup", 32),
    };
  },
};

/** Blocks a file needs under linked allocation, where each block loses bytes to the link. */
export const linkedBlocks: Generator = {
  id: "gen-st-linked-blocks",
  topic: "Linked allocation: blocks for a file",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x11bd);
    const block = r.pick([512, 1024, 2048, 4096]);
    const ptr = r.pick([4, 4, 8]);
    const data = linkedDataBytes(block, ptr);
    const bytes = r.int(3, 40) * 1000 + r.int(1, 999);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `Disk blocks are ${block} bytes, and linked allocation keeps a ${ptr}-byte pointer in each block. How many blocks does a ${bytes.toLocaleString("en-US")}-byte file need?`,
      answer: Math.ceil(bytes / data),
      unit: "blocks",
      explain: `Each block holds ${block} − ${ptr} = ${data} bytes of data. ${bytes.toLocaleString("en-US")} / ${data} = ${(bytes / data).toFixed(2)}, rounded up to ${Math.ceil(bytes / data)} blocks.`,
      move: st("Chain Lookup", 30),
    };
  },
};

/** Usable capacity of a RAID array. */
export const raidCapacity: Generator = {
  id: "gen-st-raid",
  topic: "RAID: usable capacity",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x2a1d);
    const level = r.pick([0, 1, 5, 5, 6, 10] as RaidLevel[]);
    const n = level === 1 ? 2 : level === 10 ? r.pick([4, 6, 8]) : level === 6 ? r.int(4, 8) : level === 5 ? r.int(3, 8) : r.int(2, 8);
    const size = r.pick([1, 2, 4, 8]);
    const usable = raidUsableDisks(level, n);
    const rule = level === 0 ? "RAID 0 stripes with no redundancy: all n disks hold data" : level === 5 ? "RAID 5 spends one disk's worth on parity: n − 1" : level === 6 ? "RAID 6 spends two disks' worth on parity: n − 2" : `RAID ${level} mirrors every disk: n / 2`;
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `${n} disks of ${size} TB each form a RAID ${level} array. How many TB of data can it hold?`,
      answer: usable * size,
      unit: "TB",
      explain: `${rule}. Here that is ${usable} disks × ${size} TB = ${usable * size} TB.`,
      move: st(level === 5 || level === 6 ? "Parity Wave" : "Mirror Image", 32),
    };
  },
};

export const STORAGE_GENERATORS: Generator[] = [headMovement, firstServed, inodeBlocks, allocationReads, linkedBlocks, raidCapacity];
