import { describe, expect, it } from "vitest";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { MEMORY_GENERATORS, addressTranslation, fitPlacement, internalFrag, outerBits, pageTableSize, segmentLookup, tlbEat } from "@/content/memoryGenerators";
import { BATTLE_TURNS, MEMORY_EXTRA, POOLS, gymBattleQuestions } from "@/content/pools";
import { cardLabel, inBank } from "@/content/questionBank";
import { cardKey } from "@/game/engine/leitner";
import { kindOf, questionProblems, type McqQ, type MultiQ, type NumericQ, type OrderQ } from "@/game/engine/question";
import { allocate, effectiveAccessTime, pagesFor, translateSegment, type Fit, type Hole, type Segment } from "@/game/sim/memory";

const pool = POOLS.memory;
const find = (id: string) => MEMORY_EXTRA.find((q) => q.id === id)!;
const nums = (s: string) => [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));

/** Policy picks by plain loops, independent of allocate(). */
function pick(holes: number[], size: number, fit: Fit): number {
  const ok = holes.map((h, i) => [h, i]).filter(([h]) => h >= size);
  if (fit === "first") return ok[0][1];
  if (fit === "best") return ok.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
  return ok.reduce((a, b) => (b[0] > a[0] ? b : a))[1];
}

describe("memory pool", () => {
  it("has the six boss questions plus the authored ones, all well-formed with unique ids", () => {
    expect(pool.authored.length).toBeGreaterThanOrEqual(18);
    expect(pool.authored.slice(0, 6).map((q) => q.id)).toEqual(GYM_QUESTIONS.memory.map((q) => q.id));
    for (const q of pool.authored) expect(questionProblems(q), q.id).toEqual([]);
    const ids = pool.authored.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const elsewhere = [...Object.entries(GYM_QUESTIONS).filter(([k]) => k !== "memory").flatMap(([, v]) => v), ...POOLS.deadlocks.authored, ...POOLS.sync.authored, ...POOLS.basics.authored].map((q) => q.id);
    for (const id of MEMORY_EXTRA.map((q) => q.id)) expect(elsewhere).not.toContain(id);
  });

  it("covers mcq, multi, numeric and order", () => {
    const kinds = new Set(pool.authored.map(kindOf));
    for (const k of ["mcq", "multi", "numeric", "order"]) expect(kinds.has(k as never), k).toBe(true);
  });

  it("authored answers match an independent key", () => {
    const mcq: Record<string, string> = {
      "mm-internal": "Internal fragmentation: unused space in a process's last page",
      "mm-compaction": "Compaction, which needs addresses bound at run time",
      "mm-tlb-switch": "Its entries belong to the old process; the new one would otherwise be mapped to the wrong frames",
      "mm-ptbr": "The memory address of the running process's page table",
      "mm-valid-bit": "The hardware traps to the OS",
      "mm-sharing": "Map the same frames from both page tables (the code must be read-only and reentrant)",
      "mm-inverted": "Uses less memory (one entry per frame) but needs a search, usually a hash, to translate",
      "mm-worst-fit": "Worst fit",
    };
    for (const [id, text] of Object.entries(mcq)) {
      const q = find(id) as McqQ;
      expect(q.options[q.answer], id).toBe(text);
    }
    const paging = find("multi-mm-paging") as MultiQ;
    expect(paging.answers.map((i) => paging.options[i])).toEqual(["It causes no external fragmentation", "Physical memory is split into fixed-size frames", "The last page of a process may be only partly used"]);
    const big = find("multi-mm-bigpages") as MultiQ;
    expect(big.answers.map((i) => big.options[i])).toEqual(["A smaller page table", "More memory covered by each TLB entry", "More efficient disk transfers (a seek is paid once for more data)"]);
    const order = find("order-mm-translate") as OrderQ;
    expect(order.steps).toHaveLength(6);
  });

  it("computed authored answers agree with the simulators", () => {
    // Silberschatz §9.3.2: 72,766 bytes, 2,048-byte pages → 36 pages, 962 wasted
    expect(pagesFor(72766, 2048)).toMatchObject({ pages: 36, internalFragmentation: 962 });
    expect((find("num-mm-frames") as NumericQ).answer).toBe(36);
    expect((find("num-mm-offset") as NumericQ).answer).toBe(Math.log2(4096));
    expect((find("num-mm-ram") as NumericQ).answer).toBe((2 ** 20 * 4096) / 2 ** 30);
    // worst fit takes the largest hole: the leftover is the biggest
    const holes: Hole[] = [100, 500, 200, 300, 600].map((size, i) => ({ start: 1000 * (i + 1), size }));
    expect(allocate(holes, [212], "worst").placements[0].hole).toBe(4);
  });

  it("is in the question bank, labelled with the gym", () => {
    for (const q of MEMORY_EXTRA) expect(cardLabel(cardKey(q))).toEqual({ from: "Heap Harbor Gym", text: q.prompt });
    for (const g of pool.generators) expect(inBank(g.id)).toBe(true);
    expect(pool.generators).toBe(MEMORY_GENERATORS);
  });

  it("a gym battle draws six distinct questions from the pool", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const qs = gymBattleQuestions("memory", seed, {}, 1_700_000_000_000);
      expect(qs).toHaveLength(BATTLE_TURNS);
      expect(new Set(qs.map((q) => q.id)).size).toBe(BATTLE_TURNS);
      for (const q of qs) expect(questionProblems(q), q.id).toEqual([]);
    }
  });
});

describe("memory generators", () => {
  it("are seeded: the same seed makes the same problem", () => {
    for (const g of MEMORY_GENERATORS) {
      expect(g.make(7)).toEqual(g.make(7));
      expect(g.make(7).id).toBe(`${g.id}#7`);
      expect(new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(g.make(i + 1)))).size).toBeGreaterThan(20);
      for (let s = 1; s <= 100; s++) expect(questionProblems(g.make(s)), `${g.id}#${s}`).toEqual([]);
    }
  });

  it("fit: the marked hole is the one the policy picks by a plain scan", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = fitPlacement.make(seed) as McqQ;
      const [sizes, req, fit] = [nums(q.prompt.split("Which")[0]), Number(/a (\d+)K request/.exec(q.prompt)![1]), /under (\w+) fit/.exec(q.prompt)![1] as Fit];
      expect(q.options[q.answer], `#${seed}`).toBe(`The ${sizes[pick(sizes, req, fit)]}K hole`);
    }
  });

  it("internal fragmentation: waste is below one page and size + waste is a whole number of pages", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = internalFrag.make(seed) as NumericQ;
      const [page, size] = nums(q.prompt);
      expect(q.answer).toBeGreaterThan(0);
      expect(q.answer).toBeLessThan(page);
      expect((size + q.answer) % page).toBe(0);
    }
  });

  it("translation: frame × page size + offset, checked by hand", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = addressTranslation.make(seed) as NumericQ;
      const [pageSize, logical] = [Number(/are (\d+) bytes/.exec(q.prompt)![1]), Number(/logical address (\d+)/.exec(q.prompt)![1])];
      const table = q.code!.split("\n").map((l) => Number(l.split("frame ")[1]));
      const page = Math.floor(logical / pageSize);
      expect(q.answer).toBe(table[page] * pageSize + (logical - page * pageSize));
    }
    // a worked case: page size 1024, logical 3000 = page 2, offset 952
    expect(2 * 1024 + 952).toBe(3000);
  });

  it("page-table size: entries × entry size", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = pageTableSize.make(seed) as NumericQ;
      const [bits, kb, entry] = nums(q.prompt.replace("single-level", ""));
      expect(q.answer * 1024).toBe((2 ** bits / (kb * 1024)) * entry);
    }
    // 32-bit, 4 KB pages, 4-byte entries: 4 MB
    const four = Array.from({ length: 400 }, (_, s) => pageTableSize.make(s + 1) as NumericQ).find((q) => q.prompt.includes("32 bits") && q.prompt.includes("4 KB") && q.prompt.includes("4 bytes"));
    if (four) expect(four.answer).toBe(4096);
  });

  it("EAT: matches the weighted average of hit and miss times", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = tlbEat.make(seed) as NumericQ;
      const [pct, tlb, mem] = nums(q.prompt);
      const levels = q.prompt.includes("two levels") ? 2 : 1;
      const h = pct / 100;
      const expected = h * (tlb + mem) + (1 - h) * (tlb + mem * (levels + 1));
      expect(q.answer).toBeCloseTo(expected, 2);
      expect(q.answer).toBeCloseTo(effectiveAccessTime(h, tlb, mem, levels), 2);
    }
    // Silberschatz §9.3.2: 80% hit, 20 ns TLB, 100 ns memory → 140 ns; 99%-style 122 ns example
    expect(effectiveAccessTime(0.8, 20, 100)).toBeCloseTo(140);
    expect(effectiveAccessTime(0.98, 20, 100)).toBeCloseTo(122);
  });

  it("two-level split: outer + inner + offset = address bits and the inner table fills a page", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = outerBits.make(seed) as NumericQ;
      const [bits, kb, entry] = nums(q.prompt.replace("two-level", ""));
      const page = kb * 1024;
      const inner = Math.log2(page / entry);
      expect(q.answer + inner + Math.log2(page)).toBe(bits);
    }
    const a = Array.from({ length: 300 }, (_, s) => outerBits.make(s + 1) as NumericQ).find((q) => q.prompt.startsWith("A 32-bit") && q.prompt.includes("4 KB") && q.prompt.includes("4-byte"));
    if (a) expect(a.answer).toBe(10); // Silberschatz's 10 + 10 + 12
  });

  it("segments: physical = base + offset when in range, else the right trap", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = segmentLookup.make(seed) as McqQ;
      const rows = q.code!.split("\n").slice(1).map((l) => l.trim().split(/\s+/).map(Number));
      const table: Segment[] = rows.map(([, base, limit]) => ({ base, limit }));
      const [seg, off] = nums(/segment (\d+), offset (\d+)/.exec(q.prompt)!.slice(1).join(" "));
      const exists = seg < table.length;
      const inRange = exists && off < table[seg].limit;
      const expected = inRange ? 0 : exists ? 1 : 2;
      expect(q.answer, `#${seed}`).toBe(expected);
      if (inRange) expect(Number(/address (\d+)/.exec(q.options[0])![1])).toBe(table[seg].base + off);
      expect(translateSegment(table, seg, off).ok).toBe(inRange);
      seen.add(expected);
    }
    expect(seen.size).toBe(3);
  });
});
