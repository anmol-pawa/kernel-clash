import type { Generator, McqQ, NumericQ, TranslateQ } from "@/game/engine/question";
import { allocate, effectiveAccessTime, pagesFor, pageTableBytes, splitAddress, translate, translateSegment, type Fit, type Hole, type Segment } from "@/game/sim/memory";
import { rng } from "@/lib/rng";

const mem = (name: string, power: number) => ({ name, type: "memory" as const, power });
const FITS: Record<Fit, string> = { first: "first fit", best: "best fit", worst: "worst fit" };

/** Which hole does this policy pick for one request? */
export const fitPlacement: Generator = {
  id: "gen-mem-fit",
  topic: "First, best and worst fit: which hole?",
  make(seed): McqQ {
    const r = rng(seed ^ 0x517);
    let holes: Hole[] = [];
    let size = 0;
    let fit: Fit = "first";
    for (let tries = 0; tries < 300; tries++) {
      const sizes = r.shuffle([100, 150, 200, 250, 300, 400, 500, 600, 700]).slice(0, 4);
      holes = sizes.map((s, i) => ({ start: 1000 * (i + 1), size: s }));
      size = r.pick([80, 120, 170, 210, 260, 320, 410]);
      fit = r.pick(["first", "best", "worst"] as Fit[]);
      // a good problem: the three policies disagree on at least two holes
      const picks = new Set((["first", "best", "worst"] as Fit[]).map((f) => allocate(holes, [size], f).placements[0].hole));
      if (!picks.has(null) && picks.size >= 2) break;
    }
    const p = allocate(holes, [size], fit).placements[0];
    const answer = p.hole!;
    const sizes = holes.map((h) => h.size);
    const rule = fit === "first" ? "the first hole, scanning from the lowest address, that is big enough" : fit === "best" ? "the smallest hole that is big enough" : "the largest hole";
    return {
      id: `${this.id}#${seed}`,
      prompt: `The free holes, in address order, are ${sizes.map((s) => `${s}K`).join(", ")}. Which hole does a ${size}K request use under ${FITS[fit]}?`,
      options: sizes.map((s) => `The ${s}K hole`),
      answer,
      explain: `${FITS[fit][0].toUpperCase()}${FITS[fit].slice(1)} takes ${rule}: the ${sizes[answer]}K hole, leaving ${sizes[answer] - size}K. The big-enough holes are ${sizes.filter((s) => s >= size).map((s) => `${s}K`).join(", ")}.`,
      move: mem("First Grab", 32),
    };
  },
};

/** Internal fragmentation in a process's last page. */
export const internalFrag: Generator = {
  id: "gen-mem-internal",
  topic: "Paging: internal fragmentation",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x1f);
    const pageSize = r.pick([512, 1024, 2048, 4096]);
    let size = 0;
    do size = r.int(2000, 40000);
    while (size % pageSize === 0);
    const p = pagesFor(size, pageSize);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `Pages are ${pageSize} bytes. A process is ${size} bytes. How many bytes are wasted to internal fragmentation?`,
      answer: p.internalFragmentation,
      unit: "bytes",
      explain: `The process needs ⌈${size} / ${pageSize}⌉ = ${p.pages} pages. The last page holds ${size} − ${p.pages - 1} × ${pageSize} = ${p.lastUsed} bytes, so ${pageSize} − ${p.lastUsed} = ${p.internalFragmentation} bytes are wasted. Only the last page can be partly empty.`,
      move: mem("Snug Fit", 30),
    };
  },
};

/** Logical address to physical address through a small page table. */
export const addressTranslation: Generator = {
  id: "gen-mem-translate",
  topic: "Paging: logical to physical address",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xadd);
    const pageSize = r.pick([256, 512, 1024, 2048]);
    const frames = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 6);
    const page = r.int(0, 5);
    const offset = r.int(0, pageSize - 1);
    const logical = page * pageSize + offset;
    const t = translate(logical, pageSize, frames);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `Pages and frames are ${pageSize} bytes. Using this page table, what physical address does logical address ${logical} map to?`,
      code: frames.map((f, p) => `page ${p} → frame ${f}`).join("\n"),
      answer: t.physical!,
      explain: `Page number = ⌊${logical} / ${pageSize}⌋ = ${t.page}, offset = ${logical} mod ${pageSize} = ${t.offset}. Page ${t.page} is in frame ${t.frame}, so physical = ${t.frame} × ${pageSize} + ${t.offset} = ${t.physical}.`,
      move: mem("Frame Shift", 32),
    };
  },
};

/** Size of a single-level page table. */
export const pageTableSize: Generator = {
  id: "gen-mem-ptsize",
  topic: "Paging: size of a page table",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x9a6e);
    const bits = r.pick([24, 28, 32]);
    const pageSize = r.pick([1024, 4096, 8192]);
    const entry = r.pick([2, 4, 8]);
    const bytes = pageTableBytes(bits, pageSize, entry);
    const pages = 2 ** (bits - Math.log2(pageSize));
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `Logical addresses have ${bits} bits, pages are ${pageSize / 1024} KB and each page-table entry is ${entry} bytes. How big is a single-level page table?`,
      answer: bytes / 1024,
      unit: "KB",
      explain: `There is one entry per page: 2^${bits} / ${pageSize} = ${pages} pages. ${pages} entries × ${entry} bytes = ${bytes} bytes = ${bytes / 1024} KB.`,
      move: mem("Frame Shift", 34),
    };
  },
};

/** Effective access time with a TLB. */
export const tlbEat: Generator = {
  id: "gen-mem-eat",
  topic: "TLB: effective access time",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xea7);
    const hit = r.pick([0.8, 0.9, 0.95, 0.98]);
    const tlb = r.pick([0, 10, 20]);
    const memTime = r.pick([50, 100, 200]);
    const levels = r.pick([1, 1, 2]);
    const eat = effectiveAccessTime(hit, tlb, memTime, levels);
    const hitT = tlb + memTime;
    const missT = tlb + memTime * (levels + 1);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `The TLB hit ratio is ${Math.round(hit * 100)}%, a TLB search takes ${tlb} ns and a memory access takes ${memTime} ns. The page table has ${levels === 1 ? "one level" : "two levels"}. What is the effective access time?`,
      answer: Math.round(eat * 100) / 100,
      unit: "ns",
      explain: `A hit costs ${tlb} + ${memTime} = ${hitT} ns. A miss costs ${tlb} + ${levels} page-table access${levels > 1 ? "es" : ""} + 1 access = ${tlb} + ${memTime} × ${levels + 1} = ${missT} ns. EAT = ${hit} × ${hitT} + ${Math.round((1 - hit) * 100) / 100} × ${missT} = ${Math.round(eat * 100) / 100} ns.`,
      move: mem("TLB Strike", 34),
    };
  },
};

/** How many bits index the outermost level of a two-level page table? */
export const outerBits: Generator = {
  id: "gen-mem-outer",
  topic: "Two-level paging: address split",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x2b17);
    const bits = r.pick([32, 36, 40]);
    const pageSize = r.pick([4096, 8192]);
    const entry = r.pick([4, 8]);
    const s = splitAddress(bits, pageSize, 2, entry);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A ${bits}-bit logical address, ${pageSize / 1024} KB pages and ${entry}-byte entries use a two-level page table whose inner tables each fill exactly one page. How many bits index the outer table?`,
      answer: s.levels[0],
      unit: "bits",
      explain: `The offset takes log2(${pageSize}) = ${s.offset} bits, leaving ${s.pageNumber} bits of page number. An inner table holds ${pageSize} / ${entry} = ${pageSize / entry} entries, so it is indexed by ${s.levels[1]} bits. The outer table gets the rest: ${s.pageNumber} − ${s.levels[1]} = ${s.levels[0]} bits (${s.levels[0]} + ${s.levels[1]} + ${s.offset}).`,
      move: mem("Frame Shift", 34),
    };
  },
};

/** One segment-table lookup: a physical address or a trap. */
export const segmentLookup: Generator = {
  id: "gen-mem-segment",
  topic: "Segmentation: translate or trap",
  make(seed): McqQ {
    const r = rng(seed ^ 0x5e6);
    const bases = r.shuffle([1400, 6300, 4300, 3200, 4700, 2000, 8000]).slice(0, 4);
    const table: Segment[] = bases.map((base) => ({ base, limit: r.pick([200, 400, 600, 1000]) }));
    const kind = r.pick(["ok", "ok", "beyond", "none"]);
    const segment = kind === "none" ? table.length + r.int(0, 2) : r.int(0, table.length - 1);
    const offset = kind === "beyond" ? table[segment].limit + r.int(0, 150) : r.int(0, (table[segment]?.limit ?? 100) - 1);
    const res = translateSegment(table, segment, offset);
    const shown = res.ok ? res.physical : (table[segment]?.base ?? 1000) + offset;
    const answer = res.ok ? 0 : res.trap === "beyond-limit" ? 1 : 2;
    return {
      id: `${this.id}#${seed}`,
      prompt: `Using this segment table, what happens when the CPU generates (segment ${segment}, offset ${offset})?`,
      code: ["seg  base  limit", ...table.map((s, i) => `${String(i).padEnd(5)}${String(s.base).padEnd(6)}${s.limit}`)].join("\n"),
      options: [`It maps to physical address ${shown}`, "Trap: the offset is beyond the segment's limit", "Trap: there is no such segment", "It maps to the segment's limit plus the offset"],
      answer,
      explain: res.ok
        ? `The segment exists and offset ${offset} < limit ${table[segment].limit}, so physical = base + offset = ${table[segment].base} + ${offset} = ${res.physical}.`
        : res.trap === "beyond-limit"
          ? `Segment ${segment} has limit ${table[segment].limit} and ${offset} ≥ ${table[segment].limit}, so the hardware traps to the OS (a segmentation fault) instead of adding the base.`
          : `The table only has segments 0 to ${table.length - 1}, so segment ${segment} doesn't exist and the hardware traps.`,
      move: mem("Segfault", 36),
    };
  },
};

/** Tap the page-table entry a logical address maps through (sometimes an invalid one). */
export const tapTranslate: Generator = {
  id: "gen-mem-tap-translate",
  topic: "Paging: which page-table entry?",
  make(seed): TranslateQ {
    const r = rng(seed ^ 0x7a9);
    const pageSize = r.pick([64, 128, 256, 512, 1024]);
    const n = r.int(4, 6);
    const frames = r.shuffle([...Array(12).keys()]).slice(0, n);
    const table = frames.map((f, i) => (i > 0 && r.int(0, 5) === 0 ? null : f));
    const logical = r.int(0, n * pageSize - 1);
    const t = translate(logical, pageSize, table);
    const bits = Math.log2(pageSize);
    return {
      kind: "translate",
      id: `${this.id}#${seed}`,
      prompt: `Pages are ${pageSize} bytes. Which page-table entry does logical address ${logical} go through?`,
      pageSize,
      logical,
      table,
      answer: t.page,
      explain: `The low ${bits} bits are the offset and the rest is the page number: ${logical} ÷ ${pageSize} = page ${t.page}, offset ${t.offset}. ${t.frame === null ? `Entry ${t.page} is invalid, so the MMU raises a trap.` : `Entry ${t.page} holds frame ${t.frame}, so the physical address is ${t.frame} × ${pageSize} + ${t.offset} = ${t.physical}.`}`,
      move: mem("Table Tap", 34),
    };
  },
};

export const MEMORY_GENERATORS: Generator[] = [fitPlacement, internalFrag, addressTranslation, pageTableSize, tlbEat, outerBits, segmentLookup, tapTranslate];
