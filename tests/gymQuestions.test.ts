import { describe, expect, it } from "vitest";
import { GYM_QUESTIONS } from "@/content/gymQuestions";
import { GYMS } from "@/content/gyms";
import { STARTERS, starterFighter } from "@/content/starters";
import { initialState, reducer, type BattleState, type Fighter } from "@/game/engine/battle";
import { counterDamage } from "@/game/engine/damage";
import { effectiveness } from "@/game/engine/types";
import { MOVE_TYPES } from "@/game/engine/types";
import { bossFighter } from "@/game/world/gymBattle";

const ALL = Object.values(GYM_QUESTIONS).flat();
const byId = (id: string) => {
  const q = ALL.find((x) => x.id === id);
  if (!q) throw new Error(`no question ${id}`);
  return q;
};
const answerOf = (id: string) => byId(id).options[byId(id).answer];

/** The answer key, written independently of the question data. */
const KEY: Record<string, string> = {
  "basics-priv": "The hardware traps to the OS",
  "basics-irq": "A hardware interrupt",
  "basics-syscall": "It traps from user mode into kernel mode",
  "basics-micro": "Microkernel",
  "basics-linux": "Monolithic, with loadable modules",
  "basics-boot": "Load the kernel into memory and start it",
  "proc-ready": "The CPU",
  "proc-fork3": "8",
  "proc-exec": "Its memory image is replaced by the new program; the PID stays",
  "proc-threads": "Heap and global data",
  "proc-zombie": "A zombie",
  "proc-shm": "Shared memory",
  "sched-fcfs": "17 ms",
  "sched-sjf": "3 ms",
  "sched-turnaround": "Completion time minus arrival time",
  "sched-starve": "Shortest Job First",
  "sched-rr-big": "FCFS",
  "sched-preempt": "Shortest Remaining Time First",
  "sync-race": "count++ is a load, add and store that can interleave",
  "sync-cs-reqs": "Strict alternation",
  "sync-counting": "3",
  "sync-wait-zero": "It blocks until another thread calls signal()",
  "sync-mutex-owner": "The thread that locked it",
  "sync-peterson": "Exactly two processes",
  "dl-coffman": "Preemption",
  "dl-rag": "A deadlock exists",
  "dl-banker-kind": "avoidance",
  "dl-ordering": "Circular wait",
  "dl-safe-seq": "P2, P0, P1",
  "dl-recovery": "recovery",
  "mem-best-fit": "300K",
  "mem-first-fit": "500K",
  "mem-page-offset": "Page 3, offset 712",
  "mem-ext-frag": "External",
  "mem-eat": "120 ns",
  "mem-segments": "Variable-size logical units such as code, stack and heap",
  "vm-fifo": "15",
  "vm-lru": "12",
  "vm-belady": "FIFO",
  "vm-thrash": "Processes spend more time paging than executing",
  "vm-fault": "Not currently in physical memory",
  "vm-opt": "OPT: evict the page used farthest in the future",
  "fs-inode": "The file's name",
  "fs-raid1": "Mirroring",
  "fs-raid5": "RAID 5",
  "fs-fcfs-disk": "640",
  "fs-journal": "Inconsistency after a crash",
  "fs-sstf": "236",
  "iv-thread": "A shared address space",
  "iv-cow": "Copy-on-write: pages are shared read-only and copied on the first write",
  "iv-mutex-sem": "Ownership: only the thread that locked it may unlock it",
  "iv-malloc": "Pages are mapped lazily; the first touch page-faults to get a frame",
  "iv-epoll": "It returns only the ready descriptors instead of rescanning every fd each call",
  "iv-ctx": "Cache and TLB contents are lost or flushed",
};

// ---- small reference solvers for the computed questions ----

/** Average waiting time when all jobs arrive at 0 and run in the given order. */
const avgWait = (bursts: number[]) => {
  let t = 0;
  let sum = 0;
  for (const b of bursts) {
    sum += t;
    t += b;
  }
  return sum / bursts.length;
};

/** Page faults for a reference string under FIFO, LRU or OPT. */
function faults(refs: number[], frames: number, policy: "fifo" | "lru" | "opt"): number {
  const mem: number[] = [];
  const lastUse = new Map<number, number>();
  let n = 0;
  refs.forEach((p, i) => {
    if (mem.includes(p)) {
      lastUse.set(p, i);
      return;
    }
    n++;
    if (mem.length === frames) {
      let victim = 0;
      if (policy === "lru") victim = mem.reduce((v, q, k) => (lastUse.get(q)! < lastUse.get(mem[v])! ? k : v), 0);
      if (policy === "opt") {
        const next = (q: number) => {
          const j = refs.indexOf(q, i + 1);
          return j < 0 ? Infinity : j;
        };
        victim = mem.reduce((v, q, k) => (next(q) > next(mem[v]) ? k : v), 0);
      }
      mem.splice(victim, 1);
    }
    mem.push(p);
    lastUse.set(p, i);
  });
  return n;
}

const seekFcfs = (head: number, q: number[]) => q.reduce((a, c, i) => a + Math.abs(c - (i ? q[i - 1] : head)), 0);
function seekSstf(head: number, queue: number[]): number {
  const q = [...queue];
  let total = 0;
  while (q.length) {
    const i = q.reduce((b, c, k) => (Math.abs(c - head) < Math.abs(q[b] - head) ? k : b), 0);
    total += Math.abs(q[i] - head);
    head = q.splice(i, 1)[0];
  }
  return total;
}

/** Single-resource Banker's check: is `order` a safe sequence? */
function isSafe(available: number, alloc: number[], max: number[], order: number[]): boolean {
  let work = available;
  for (const p of order) {
    if (max[p] - alloc[p] > work) return false;
    work += alloc[p];
  }
  return true;
}

const fit = (holes: number[], size: number, mode: "first" | "best") => {
  const ok = holes.filter((h) => h >= size);
  return mode === "first" ? ok[0] : Math.min(...ok);
};

const REFS = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
const DISK = [98, 183, 37, 122, 14, 124, 65, 67];
const HOLES = [100, 500, 200, 300, 600];

describe("gym boss questions", () => {
  it("every gym has six well-formed questions with unique ids", () => {
    expect(Object.keys(GYM_QUESTIONS).sort()).toEqual(GYMS.map((g) => g.id).sort());
    for (const qs of Object.values(GYM_QUESTIONS)) expect(qs).toHaveLength(6);
    expect(new Set(ALL.map((q) => q.id)).size).toBe(ALL.length);
    for (const q of ALL) {
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.id).toBeLessThan(4);
      expect(MOVE_TYPES, q.id).toContain(q.move.type);
      expect(q.move.power, q.id).toBeGreaterThanOrEqual(30);
      expect(q.explain.length, q.id).toBeGreaterThan(20);
    }
  });

  it("matches the answer key for every question", () => {
    expect(Object.keys(KEY).sort()).toEqual(ALL.map((q) => q.id).sort());
    for (const [id, a] of Object.entries(KEY)) expect(answerOf(id), id).toBe(a);
  });

  it("doesn't park every answer in the same slot", () => {
    for (const [gym, qs] of Object.entries(GYM_QUESTIONS)) expect(new Set(qs.map((q) => q.answer)).size, gym).toBeGreaterThanOrEqual(3);
  });

  it("fork() n times gives 2^n processes", () => {
    let procs = 1;
    for (let i = 0; i < 3; i++) procs *= 2;
    expect(answerOf("proc-fork3")).toBe(String(procs));
  });

  it("FCFS and SJF waiting times (Silberschatz 24/3/3)", () => {
    expect(avgWait([24, 3, 3])).toBe(17);
    expect(avgWait([3, 3, 24])).toBe(3);
    expect(answerOf("sched-fcfs")).toBe(`${avgWait([24, 3, 3])} ms`);
    expect(answerOf("sched-sjf")).toBe(`${avgWait([24, 3, 3].sort((a, b) => a - b))} ms`);
  });

  it("Banker's safe sequence", () => {
    const alloc = [1, 2, 3];
    const max = [4, 6, 5];
    const parse = (s: string) => s.split(", ").map((p) => Number(p.slice(1)));
    const q = byId("dl-safe-seq");
    const safe = q.options.filter((o) => !o.startsWith("None") && isSafe(3, alloc, max, parse(o)));
    expect(safe).toEqual([q.options[q.answer]]);
  });

  it("first fit and best fit (Silberschatz holes)", () => {
    expect(answerOf("mem-first-fit")).toBe(`${fit(HOLES, 212, "first")}K`);
    expect(answerOf("mem-best-fit")).toBe(`${fit(HOLES, 212, "best")}K`);
  });

  it("page number and offset", () => {
    expect(answerOf("mem-page-offset")).toBe(`Page ${Math.floor(13000 / 4096)}, offset ${13000 % 4096}`);
  });

  it("effective access time with a TLB", () => {
    const eat = 0.8 * 100 + 0.2 * (100 + 100);
    expect(answerOf("mem-eat")).toBe(`${eat} ns`);
  });

  it("page replacement on the Silberschatz reference string", () => {
    expect(faults(REFS, 3, "fifo")).toBe(15);
    expect(faults(REFS, 3, "lru")).toBe(12);
    expect(faults(REFS, 3, "opt")).toBe(9);
    expect(answerOf("vm-fifo")).toBe(String(faults(REFS, 3, "fifo")));
    expect(answerOf("vm-lru")).toBe(String(faults(REFS, 3, "lru")));
  });

  it("Belady's anomaly shows up under FIFO but not LRU", () => {
    const b = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    expect([faults(b, 3, "fifo"), faults(b, 4, "fifo")]).toEqual([9, 10]);
    expect(faults(b, 4, "lru")).toBeLessThanOrEqual(faults(b, 3, "lru"));
  });

  it("disk scheduling head movement (Silberschatz queue)", () => {
    expect(seekFcfs(53, DISK)).toBe(640);
    expect(seekSstf(53, DISK)).toBe(236);
    expect(answerOf("fs-fcfs-disk")).toBe(String(seekFcfs(53, DISK)));
    expect(answerOf("fs-sstf")).toBe(String(seekSstf(53, DISK)));
  });
});

describe("gym boss battles", () => {
  const players = STARTERS.map(starterFighter);
  /** Play a boss battle with a fixed pattern of right/wrong, slow answers (no crits). */
  function play(gymId: string, pattern: boolean[], player: Fighter): BattleState {
    const gym = GYMS.find((g) => g.id === gymId)!;
    const qs = GYM_QUESTIONS[gymId];
    let s = reducer(initialState(player, bossFighter(gym), qs.length), { type: "ready" });
    for (let i = 0; s.phase === "ask"; i++) {
      s = reducer(s, { type: "answer", correct: pattern[i] ?? false, power: qs[i].move.power, seconds: 30, moveType: qs[i].move.type, counterType: gym.type });
      s = reducer(s, { type: "next" });
    }
    return s;
  }

  it("bosses get tougher along the map", () => {
    const f = GYMS.map(bossFighter);
    for (let i = 1; i < f.length; i++) {
      expect(f[i].maxHp).toBeGreaterThan(f[i - 1].maxHp);
      expect(f[i].level).toBeGreaterThan(f[i - 1].level);
    }
    for (const [i, g] of GYMS.entries()) expect(f[i].name).toBe(g.boss.name);
  });

  it("a perfect run beats every boss with every starter, and so does one early slip", () => {
    for (const p of players)
      for (const g of GYMS) {
        expect(play(g.id, [true, true, true, true, true, true], p).phase, `${p.name} ${g.id}`).toBe("victory");
        expect(play(g.id, [false, true, true, true, true, true], p).phase, `${p.name} ${g.id}`).toBe("victory");
      }
  });

  it("some boss battles have type matchups to exploit", () => {
    const supers = GYMS.filter((g) => GYM_QUESTIONS[g.id].some((q) => effectiveness(q.move.type, g.type) === 2)).map((g) => g.id);
    expect(supers).toEqual(expect.arrayContaining(["scheduling", "virtual", "interview"]));
  });

  it("three right answers are never enough", () => {
    for (const p of players) for (const g of GYMS) expect(play(g.id, [true, true, true, false, false, false], p).phase, `${p.name} ${g.id}`).toBe("defeat");
  });

  it("a boss's counter never knocks out a full-HP starter in one hit, even when super effective", () => {
    for (const p of players)
      for (const g of GYMS) {
        const effect = effectiveness(g.type, p.type);
        expect(counterDamage(bossFighter(g).level, effect), `${g.id} vs ${p.name}`).toBeLessThan(p.maxHp);
      }
  });

  it("every starter meets at least one boss that hits it super effectively", () => {
    for (const p of players) expect(GYMS.some((g) => effectiveness(g.type, p.type) === 2), p.name).toBe(true);
  });
});
