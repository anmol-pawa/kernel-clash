import { describe, expect, it } from "vitest";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { STORAGE_GENERATORS, allocationReads, firstServed, headMovement, inodeBlocks, linkedBlocks, raidCapacity, sstfTies } from "@/content/storageGenerators";
import { BATTLE_TURNS, POOLS, STORAGE_EXTRA, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { cardKey } from "@/game/engine/leitner";
import { kindOf, questionProblems, type McqQ, type MultiQ, type NumericQ } from "@/game/engine/question";
import { DISK_EXAMPLE, scheduleDisk } from "@/game/sim/storage";

const pool = POOLS.storage;
const find = (id: string) => STORAGE_EXTRA.find((q) => q.id === id)!;
const nums = (s: string) => [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));

/** Head movement by plain loops over a sorted list, independent of scheduleDisk(). */
function plainMovement(queue: number[], head: number, policy: string, dir: "up" | "down", end = 199): number {
  const above = queue.filter((c) => c > head).sort((a, b) => a - b);
  const below = queue.filter((c) => c < head).sort((a, b) => b - a);
  const maxQ = Math.max(...queue), minQ = Math.min(...queue);
  switch (policy) {
    case "fcfs": { let at = head, t = 0; for (const c of queue) { t += Math.abs(c - at); at = c; } return t; }
    case "sstf": { const left = [...queue]; let at = head, t = 0; while (left.length) { left.sort((a, b) => Math.abs(a - at) - Math.abs(b - at)); const c = left.shift()!; t += Math.abs(c - at); at = c; } return t; }
    case "look": return dir === "up" ? (maxQ - head) + (maxQ - minQ) : (head - minQ) + (maxQ - minQ);
    case "scan": return dir === "up" ? (end - head) + (end - minQ) : head + maxQ;
    case "clook": return dir === "up" ? (maxQ - head) + (maxQ - below[below.length - 1]) + (below[0] - below[below.length - 1]) : (head - minQ) + (above[above.length - 1] - above[0]) + (above[above.length - 1] - minQ);
    default: return dir === "up" ? (end - head) + end + below[0] : head + end + (end - above[0]);
  }
}

describe("storage pool", () => {
  it("has the six boss questions plus the authored ones, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(18);
    expect(pool.authored.slice(0, 6).map((q) => q.id)).toEqual(GYM_QUESTIONS.storage.map((q) => q.id));
    for (const q of pool.authored) expect(questionProblems(q), q.id).toEqual([]);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.entries(GYM_QUESTIONS).filter(([k]) => k !== "storage").flatMap(([, v]) => v), ...Object.entries(POOLS).filter(([k]) => k !== "storage").flatMap(([, p]) => p.authored)].map((q) => q.id);
    for (const id of STORAGE_EXTRA.map((q) => q.id)) expect(elsewhere).not.toContain(id);
  });

  it("covers mcq, multi, numeric and order", () => {
    const kinds = new Set(pool.authored.map(kindOf));
    for (const k of ["mcq", "multi", "numeric", "order"]) expect(kinds.has(k as never), k).toBe(true);
  });

  it("authored answers match an independent key", () => {
    const mcq: Record<string, string> = {
      "st-contig": "External fragmentation, and files that can't grow without moving",
      "st-linked": "To reach block n the system must follow n links from the first block",
      "st-indexed": "Space for an index block per file, even for tiny files",
      "st-links": "It still opens the file, because the inode's link count is still 1",
      "st-cscan": "It gives more uniform waiting times, since requests at the ends aren't served twice as often as those in the middle",
      "st-starve": "SSTF: a steady stream of nearby requests keeps a far one waiting",
      "st-ssd": "There is no moving head, so access time doesn't depend on where the previous request was",
    };
    for (const [id, text] of Object.entries(mcq)) {
      const q = find(id) as McqQ;
      expect(q.options[q.answer], id).toBe(text);
    }
    const inode = find("multi-st-inode") as MultiQ;
    expect(inode.answers.map((i) => inode.options[i])).toEqual(["File size", "Owner and permissions", "Link count", "Pointers to data blocks"]);
    const raid = find("multi-st-raid") as MultiQ;
    expect(raid.answers.map((i) => raid.options[i])).toEqual(["RAID 1", "RAID 5", "RAID 6", "RAID 10"]);
  });

  it("computed authored answers agree with the simulator and the textbook", () => {
    const { queue, head } = DISK_EXAMPLE;
    expect((find("num-st-fcfs") as NumericQ).answer).toBe(scheduleDisk(queue, head, "fcfs").movement);
    expect((find("num-st-fcfs") as NumericQ).answer).toBe(640);
    expect((find("num-st-inode") as NumericQ).answer).toBe((12 + 4096 / 4) * 4);
    expect((find("num-st-raid5") as NumericQ).answer).toBe((6 - 1) * 2);
    expect((find("num-st-linked") as NumericQ).answer).toBe(9 + 1);
  });

  it("is in the question bank, labelled with the gym", () => {
    for (const q of STORAGE_EXTRA) expect(cardLabel(cardKey(q))?.from, q.id).toBe(cardLabel(cardKey(GYM_QUESTIONS.storage[0]))?.from);
    for (const g of pool.generators) expect(inBank(g.id)).toBe(true);
    expect(pool.generators).toBe(STORAGE_GENERATORS);
  });

  it("a gym battle draws six distinct questions from the pool", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const qs = gymBattleQuestions("storage", seed, {}, 1_700_000_000_000);
      expect(qs).toHaveLength(BATTLE_TURNS);
      expect(new Set(qs.map((q) => q.id)).size).toBe(BATTLE_TURNS);
      for (const q of qs) expect(questionProblems(q), q.id).toEqual([]);
    }
  });
});

describe("storage generators", () => {
  it("are seeded: the same seed makes the same problem", () => {
    for (const g of STORAGE_GENERATORS) {
      expect(g.make(7)).toEqual(g.make(7));
      expect(g.make(7).id).toBe(`${g.id}#7`);
      expect(new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(g.make(i + 1)))).size).toBeGreaterThan(20);
      for (let s = 1; s <= 100; s++) expect(questionProblems(g.make(s)), `${g.id}#${s}`).toEqual([]);
    }
  });

  it("head movement matches plain-loop formulas for every policy", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const q = headMovement.make(seed) as NumericQ;
      const m = /The head is at (\d+) and the queue is ([\d, ]+)\./.exec(q.prompt)!;
      const head = Number(m[1]);
      const queue = m[2].split(",").map(Number);
      const policy = /under ([A-Z-]+)\?$/.exec(q.prompt)![1];
      const dir = q.prompt.includes("toward lower") ? "down" : "up";
      seen.add(policy);
      const key = policy.toLowerCase().replace("-", "");
      expect(q.answer, `#${seed} ${policy}`).toBe(plainMovement(queue, head, key, dir));
      expect(sstfTies(queue, head)).toBe(false);
    }
    expect(seen.size).toBe(6);
  });

  it("first served: the keyed option is the first request of the policy's order", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = firstServed.make(seed) as McqQ;
      const m = /head is at (\d+) .* moving toward (higher|lower) cylinders\. The queue arrived as ([\d, ]+)\. Which request does ([A-Z-]+) serve first/.exec(q.prompt)!;
      const [head, dir, queue, name] = [Number(m[1]), m[2] === "higher" ? "up" : "down", m[3].split(",").map(Number), m[4]];
      const above = queue.filter((c) => c > head).sort((a, b) => a - b);
      const below = queue.filter((c) => c < head).sort((a, b) => b - a);
      const key = nums(q.options[q.answer])[0];
      if (name === "SSTF") {
        const nearest = [...queue].sort((a, b) => Math.abs(a - head) - Math.abs(b - head))[0];
        expect(key).toBe(nearest);
      } else if (name === "SCAN" || name === "LOOK") {
        expect(key).toBe(dir === "up" ? above[0] : below[0]);
      } else {
        expect(key).toBe(dir === "up" ? above[0] : below[0]);
      }
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it("inode blocks: direct + single + double", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const q = inodeBlocks.make(seed) as NumericQ;
      const [direct, block, ptr] = [/has (\d+) direct/, /Blocks are (\d+) bytes/, /pointers are (\d+) bytes/].map((x) => Number(x.exec(q.prompt)![1]));
      const per = Math.floor(block / ptr);
      expect(q.answer).toBe(direct + per + per * per);
    }
    // 12 direct, 1 KB blocks, 4-byte pointers: 12 + 256 + 65,536
    expect(12 + 256 + 256 * 256).toBe(65804);
  });

  it("allocation reads: linked n+1, indexed 2, contiguous 1", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const q = allocationReads.make(seed) as NumericQ;
      const method = /uses (\w+) allocation/.exec(q.prompt)![1];
      const n = Number(/logical block (\d+)/.exec(q.prompt)![1]);
      seen.add(method);
      expect(q.answer).toBe(method === "linked" ? n + 1 : method === "indexed" ? 2 : 1);
    }
    expect(seen.size).toBe(3);
  });

  it("linked blocks: ceil(bytes / (block - pointer))", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const q = linkedBlocks.make(seed) as NumericQ;
      const [block, ptr] = [Number(/blocks are (\d+) bytes/.exec(q.prompt)![1]), Number(/keeps a (\d+)-byte/.exec(q.prompt)![1])];
      const bytes = Number(/does a ([\d,]+)-byte/.exec(q.prompt)![1].replace(/,/g, ""));
      expect(q.answer).toBe(Math.ceil(bytes / (block - ptr)));
    }
    // 4096-byte blocks, 4-byte pointer: 4092 data bytes; a 10,000-byte file needs 3 blocks
    expect(Math.ceil(10000 / (4096 - 4))).toBe(3);
  });

  it("RAID capacity: textbook rules per level", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const q = raidCapacity.make(seed) as NumericQ;
      const [n, size, level] = /^(\d+) disks of (\d+) TB each form a RAID (\d+)/.exec(q.prompt)!.slice(1).map(Number);
      seen.add(level);
      const want = level === 0 ? n * size : level === 1 || level === 10 ? (n / 2) * size : level === 5 ? (n - 1) * size : (n - 2) * size;
      expect(q.answer).toBe(want);
      if (level === 5) expect(n).toBeGreaterThanOrEqual(3);
      if (level === 6) expect(n).toBeGreaterThanOrEqual(4);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 5, 6, 10]);
  });
});
