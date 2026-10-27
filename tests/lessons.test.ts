import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { LESSONS, LESSON_IDS, lessonById, lessonsOf } from "@/content/lessons";
import { grade, questionProblems, type OrderQ } from "@/game/engine/question";
import { runForks } from "@/game/sim/fork";
import { DIAGRAM_IDS, SCHEDULING_EXAMPLES, SYNC_EXAMPLES, switches } from "@/components/lesson/Diagrams";
import { RAG_PLAY } from "@/components/lesson/RagBoard";
import { DETECT_EXAMPLE, detect, findCycle, isCycleNodes } from "@/game/sim/deadlock";
import { PETERSON, finalValues, lostUpdates, runSemaphore, trace } from "@/game/sim/sync";
import { DETECT_CHECK_REQUESTS, RACE_THREADS, RACE_VALUES, RAG_CHECK_EDGES, RR_CHECK_JOBS, SEM_CHECK, SJF_CHECK_JOBS } from "@/content/lessons";
import { fcfs, ganttText, mlfq, roundRobin, sjf } from "@/game/sim/scheduling";
import { BEST_LEFT, FLAT_TABLE_MB, PAGING_CHECK, TLB_CHECK } from "@/content/lessons";
import { FRAG_EXAMPLE, PAGING_EXAMPLE, PTABLE_EXAMPLE, SEGMENT_TRACES, TLB_EXAMPLE } from "@/components/lesson/Diagrams";
import { FIT_EXAMPLE, allocate } from "@/game/sim/memory";
import { ANOMALY, DEMAND_CHECK, LRU_CHECK, WSS_CHECK } from "@/content/lessons";
import { BELADY_CURVES, DEMAND_EXAMPLE, REPLACE_EXAMPLE, WSS_EXAMPLE } from "@/components/lesson/Diagrams";
import { ALLOC_CHECK, INODE_CHECK, LOOK_CHECK, RAID_CHECK } from "@/content/lessons";
import { ALLOC_ROWS, DISK_BARS, INODE_EXAMPLE, RAID_EXAMPLE } from "@/components/lesson/Diagrams";
import { COPY_UP_CHECK, CPU_MAX_CHECK, MIGRATE_CHECK, NESTED_CHECK } from "@/content/lessons";
import { IO_EXAMPLE, SLAB_EXAMPLE, HUGE_EXAMPLE, BUDDY_EXAMPLE, HEAP_EXAMPLE, FALSE_SHARING_EXAMPLE, FUTEX_EXAMPLE, ABA_EXAMPLE, SB_EXAMPLE, CGROUP_EXAMPLE, DOCKER_RUN_STEPS, MIGRATION_EXAMPLE, NESTED_WALK, TRAP_EXAMPLE, NAMESPACE_EXAMPLE, OVERLAY_EXAMPLE } from "@/components/lesson/Diagrams";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

const BASICS_DIAGRAMS = ["modes", "syscall", "interrupt", "kernels", "boot"];
const PROCESS_DIAGRAMS = ["pstates", "context", "fork", "threads", "ipc"];
const SCHEDULING_DIAGRAMS = ["fcfs", "sjf", "priority", "rr", "mlfq"];
const SYNC_DIAGRAMS = ["race", "peterson", "semaphore", "monitor", "philosophers"];
const DEADLOCK_DIAGRAMS = ["rag", "banker"];
const MEMORY_DIAGRAMS = ["fit", "frag", "paging", "ptable", "tlb", "segments"];
const VIRTUAL_DIAGRAMS = ["demand", "replace", "belady", "thrash", "wss"];
const STORAGE_DIAGRAMS = ["alloc", "inode", "journal", "raid", "disk"];
const CONTAINER_DIAGRAMS = ["namespaces", "cgroups", "overlay", "vmcompare", "dockerrun"];
const VIRT_DIAGRAMS = ["trapemul", "nestedpt", "migration"];
const ATOMIC_DIAGRAMS = ["cas", "ordering", "falseshare", "futex"];
const ALLOCATOR_DIAGRAMS = ["freelist", "buddy", "slab", "hugepages"];
const IO_DIAGRAMS = ["iomodels", "epoll"];
const DIAGRAMS = [...IO_DIAGRAMS, ...ALLOCATOR_DIAGRAMS, ...CONTAINER_DIAGRAMS, ...ATOMIC_DIAGRAMS, ...VIRT_DIAGRAMS, ...BASICS_DIAGRAMS, ...PROCESS_DIAGRAMS, ...SCHEDULING_DIAGRAMS, ...SYNC_DIAGRAMS, ...DEADLOCK_DIAGRAMS, ...MEMORY_DIAGRAMS, ...VIRTUAL_DIAGRAMS, ...STORAGE_DIAGRAMS];

describe("lessons", () => {
  it("have unique ids, a known gym, pages with text and well-formed checks", () => {
    expect(LESSON_IDS.size).toBe(LESSONS.length);
    const checkIds = new Set(LESSONS.map((l) => l.check.id));
    expect(checkIds.size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(GYMS.some((g) => g.id === l.gym)).toBe(true);
      expect(l.pages.length).toBeGreaterThanOrEqual(1);
      for (const p of l.pages) {
        expect(p.heading.trim()).not.toBe("");
        expect(p.body.length).toBeGreaterThan(0);
        // `code` spans must be closed
        for (const t of p.body) expect(t.split("`").length % 2).toBe(1);
        if (p.diagram) expect(DIAGRAMS).toContain(p.diagram);
      }
      expect(questionProblems(l.check)).toEqual([]);
    }
  });

  it("cover every OS-basics topic, with each diagram used once", () => {
    const basics = lessonsOf("basics");
    expect(basics).toHaveLength(GYMS[0].topics.length);
    expect(basics.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...BASICS_DIAGRAMS].sort());
  });

  it("cover every processes-and-threads topic in order, with each diagram used once", () => {
    const procs = lessonsOf("processes");
    const gym = GYMS.find((g) => g.id === "processes")!;
    expect(procs).toHaveLength(gym.topics.length);
    expect(procs.map((l) => l.id)).toEqual(["processes-states", "processes-context", "processes-fork", "processes-threads", "processes-ipc"]);
    expect(procs.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...PROCESS_DIAGRAMS].sort());
    for (const l of procs) expect(l.check.move.type).toBe("process");
  });

  it("every diagram id is drawn", () => {
    expect([...DIAGRAM_IDS].sort()).toEqual([...DIAGRAMS].sort());
  });

  it("modes check: only the trap instruction is allowed in user mode (Silberschatz §1.4.2: the others are privileged)", () => {
    const q = lessonById("basics-modes")!.check;
    expect(q.kind ?? "mcq").toBe("mcq");
    if (q.kind === undefined || q.kind === "mcq") {
      expect(q.options[q.answer]).toMatch(/trap/i);
      expect(grade(q, { kind: "mcq", choice: q.answer })).toBe(true);
      for (let i = 0; i < 4; i++) if (i !== q.answer) expect(grade(q, { kind: "mcq", choice: i })).toBe(false);
    }
  });

  it("syscall check: wrapper → registers → trap → table → return", () => {
    const q = lessonById("basics-syscalls")!.check as OrderQ;
    expect(q.kind).toBe("order");
    expect(q.steps[0]).toMatch(/C library/);
    expect(q.steps[2]).toMatch(/trap/i);
    expect(q.steps[3]).toMatch(/system-call table/);
    expect(q.steps.at(-1)).toMatch(/user mode/);
    expect(grade(q, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(q, { kind: "order", order: [0, 2, 1, 3, 4] })).toBe(false);
  });

  it("interrupts check: divide by zero, page fault and syscall are traps; disk and timer are interrupts", () => {
    const q = lessonById("basics-interrupts")!.check;
    if (q.kind !== "multi") throw new Error("expected select-all");
    const traps = q.answers.map((i) => q.options[i]);
    expect(traps.sort()).toEqual(["A page fault", "A system-call instruction", "Divide by zero"]);
    expect(grade(q, { kind: "multi", choices: [4, 2, 0] })).toBe(true);
    expect(grade(q, { kind: "multi", choices: [0, 2] })).toBe(false);
    expect(grade(q, { kind: "multi", choices: [0, 1, 2, 4] })).toBe(false);
  });

  it("kernels check: a driver crash is contained in a microkernel", () => {
    const q = lessonById("basics-kernels")!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toBe("Microkernel");
  });

  it("boot check: firmware → POST → boot loader → kernel → init", () => {
    const q = lessonById("basics-boot")!.check as OrderQ;
    expect(q.steps.map((s) => s.match(/firmware|self-test|boot loader is|kernel into|init/i)?.[0].toLowerCase())).toEqual(["firmware", "self-test", "boot loader is", "kernel into", "init"]);
    expect(grade(q, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(q, { kind: "order", order: [1, 0, 2, 3, 4] })).toBe(false);
  });
});

describe("processes-and-threads quick checks", () => {
  const mcq = (id: string) => {
    const q = lessonById(id)!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    return q;
  };

  it("states check: Waiting → Running is not a transition (Silberschatz Fig. 3.2: waiting goes to ready)", () => {
    const q = mcq("processes-states");
    expect(q.options[q.answer]).toBe("Waiting → Running");
    // the other three are edges of the five-state diagram
    const edges = new Set(["New → Ready", "Ready → Running", "Running → Ready", "Running → Waiting", "Waiting → Ready", "Running → Terminated"]);
    q.options.forEach((o, i) => expect(edges.has(o)).toBe(i !== q.answer));
  });

  it("context-switch check: interrupt → save PCB0 → reload PCB1 → resume P1 (Silberschatz Fig. 3.6)", () => {
    const q = lessonById("processes-context")!.check as OrderQ;
    expect(q.kind).toBe("order");
    expect(q.steps[1]).toMatch(/interrupt/i);
    expect(q.steps[2]).toMatch(/saves P0.*PCB0/);
    expect(q.steps[3]).toMatch(/reloads P1.*PCB1/);
    expect(grade(q, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(q, { kind: "order", order: [0, 1, 3, 2, 4] })).toBe(false);
  });

  it("fork check: two fork()s then a print prints 4 times, matching the fork simulator", () => {
    const q = lessonById("processes-fork")!.check;
    if (q.kind !== "numeric") throw new Error("expected numeric");
    expect(q.code).toMatch(/fork\(\);\n {2}fork\(\);\n {2}printf/);
    expect(runForks(["fork", "fork", "print"]).prints).toBe(4);
    expect(q.answer).toBe(runForks(["fork", "fork", "print"]).prints);
    expect(grade(q, { kind: "numeric", value: "4" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "3" })).toBe(false);
  });

  it("threads check: registers, stack and PC are per thread; heap, globals and files are shared (Silberschatz Fig. 4.2)", () => {
    const q = lessonById("processes-threads")!.check;
    if (q.kind !== "multi") throw new Error("expected select-all");
    expect(q.answers.map((i) => q.options[i]).sort()).toEqual(["Program counter", "Registers", "Stack"]);
    expect(grade(q, { kind: "multi", choices: [4, 1, 0] })).toBe(true);
    expect(grade(q, { kind: "multi", choices: [0, 1, 2, 4] })).toBe(false);
  });

  it("IPC check: shared memory avoids a system call per exchange", () => {
    const q = mcq("processes-ipc");
    expect(q.options[q.answer]).toBe("Shared memory");
  });
});

describe("CPU-scheduling lessons", () => {
  const mcq = (id: string) => {
    const q = lessonById(id)!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    return q;
  };

  it("cover every scheduling topic in order, with each diagram used once", () => {
    const ls = lessonsOf("scheduling");
    const gym = GYMS.find((g) => g.id === "scheduling")!;
    expect(ls).toHaveLength(gym.topics.length);
    expect(ls.map((l) => l.id)).toEqual(["scheduling-fcfs", "scheduling-sjf", "scheduling-priority", "scheduling-rr", "scheduling-mlfq"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : [])))).toEqual(SCHEDULING_DIAGRAMS);
    for (const l of ls) expect(l.check.move.type).toBe("scheduler");
  });

  it("diagram charts match Silberschatz ch. 5's worked examples", () => {
    const x = SCHEDULING_EXAMPLES;
    expect(x.convoy.avgWaiting).toBe(17);
    expect(x.shortFirst.avgWaiting).toBe(3);
    expect(ganttText(x.sjf.gantt)).toBe("P4 0–3 | P1 3–9 | P3 9–16 | P2 16–24");
    expect(x.sjf.avgWaiting).toBe(7);
    expect(ganttText(x.srtf.gantt)).toBe("P1 0–1 | P2 1–5 | P4 5–10 | P1 10–17 | P3 17–26");
    expect(x.srtf.avgWaiting).toBe(6.5);
    expect(ganttText(x.priority.gantt)).toBe("P2 0–1 | P5 1–6 | P1 6–16 | P3 16–18 | P4 18–19");
    expect(x.priority.avgWaiting).toBeCloseTo(8.2);
    expect(x.starve.waiting[1]).toBe(12);
    expect(x.aged.waiting[1]).toBe(4);
    expect(ganttText(x.rr4.gantt)).toBe("P1 0–4 | P2 4–7 | P3 7–10 | P1 10–30");
    expect(x.rr4.avgWaiting).toBeCloseTo(17 / 3);
    // a quantum bigger than every burst is FCFS
    expect(ganttText(x.rrBig.gantt)).toBe(ganttText(x.convoy.gantt));
    expect(switches(x.rr4)).toBe(3);
    expect(switches(x.rrBig)).toBe(2);
    expect(ganttText(x.mlfq.gantt)).toBe("A 0–10 | B 10–14 | C 14–22 | A 22–38 | C 38–50 | A 50–54");
  });

  it("the lesson text quotes the simulators' numbers", () => {
    const text = (id: string) => lessonById(id)!.pages.flatMap((p) => p.body).join(" ");
    const fc = fcfs(SCHEDULING_EXAMPLES.sjf.gantt.map((b) => ({ name: b.name!, arrival: 0, burst: b.end - b.start })).sort((a, b) => a.name.localeCompare(b.name)));
    expect(fc.avgWaiting).toBe(10.25);
    expect(text("scheduling-sjf")).toContain("FCFS would give 10.25");
    const srtfSet = [
      { name: "P1", arrival: 0, burst: 8 },
      { name: "P2", arrival: 1, burst: 4 },
      { name: "P3", arrival: 2, burst: 9 },
      { name: "P4", arrival: 3, burst: 5 },
    ];
    expect(sjf(srtfSet).avgWaiting).toBe(7.75);
    expect(text("scheduling-sjf")).toContain("7.75 for non-preemptive SJF");
    expect(text("scheduling-fcfs")).toContain("an average of 17 ms");
    expect(text("scheduling-rr")).toContain("17/3 ≈ 5.67");
  });

  it("FCFS check: maximise utilisation and throughput, minimise the times", () => {
    const q = lessonById("scheduling-fcfs")!.check;
    if (q.kind !== "multi") throw new Error("expected select-all");
    expect(q.answers.map((i) => q.options[i]).sort()).toEqual(["CPU utilisation", "Throughput"]);
    expect(grade(q, { kind: "multi", choices: [1, 0] })).toBe(true);
    expect(grade(q, { kind: "multi", choices: [0, 1, 4] })).toBe(false);
  });

  it("SJF check: P3, P2, P4, P1 gives an average wait of 15/4 = 3.75", () => {
    const q = lessonById("scheduling-sjf")!.check;
    if (q.kind !== "numeric") throw new Error("expected numeric");
    const s = sjf(SJF_CHECK_JOBS);
    expect(ganttText(s.gantt)).toBe("P3 0–1 | P2 1–5 | P4 5–9 | P1 9–16");
    expect(s.waiting).toEqual([9, 1, 0, 5]);
    expect(q.answer).toBe(3.75);
    expect(q.gantt).toEqual(s.gantt);
    expect(q.code).toBe("Proc  Burst\nP1    7\nP2    4\nP3    1\nP4    4");
    expect(q.explain).toContain("15/4 = 3.75");
    expect(grade(q, { kind: "numeric", value: "3.75" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "15/4" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "4" })).toBe(false);
  });

  it("priority check: aging fixes starvation (and the simulator shows it)", () => {
    const q = mcq("scheduling-priority");
    expect(q.options[q.answer]).toBe("Aging");
    expect(SCHEDULING_EXAMPLES.aged.waiting[1]).toBeLessThan(SCHEDULING_EXAMPLES.starve.waiting[1]);
  });

  it("RR check: with q = 2, P1 (5), P2 (3), P3 (1) — P1 finishes at 9", () => {
    const q = lessonById("scheduling-rr")!.check;
    if (q.kind !== "numeric") throw new Error("expected numeric");
    const s = roundRobin(RR_CHECK_JOBS, 2);
    expect(ganttText(s.gantt)).toBe("P1 0–2 | P2 2–4 | P3 4–5 | P1 5–7 | P2 7–8 | P1 8–9");
    expect(q.answer).toBe(9);
    expect(q.gantt).toEqual(s.gantt);
    expect(grade(q, { kind: "numeric", value: "9" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "8" })).toBe(false);
  });

  it("MLFQ check: short and I/O-bound jobs stay on top", () => {
    const q = mcq("scheduling-mlfq");
    expect(q.options[q.answer]).toMatch(/Short or I\/O-bound/);
    // in the diagram's MLFQ the short job B never waits, while long A waits most
    const s = mlfq([{ name: "A", arrival: 0, burst: 30 }, { name: "B", arrival: 10, burst: 4 }, { name: "C", arrival: 12, burst: 20 }], [8, 16, Infinity]);
    expect(s.waiting[1]).toBe(0);
    expect(s.waiting[0]).toBe(Math.max(...s.waiting));
  });
});

describe("synchronization lessons", () => {
  it("cover every Mutex Marsh topic in order, with each diagram used once", () => {
    const sync = lessonsOf("sync");
    const gym = GYMS.find((g) => g.id === "sync")!;
    expect(sync).toHaveLength(gym.topics.length);
    expect(sync.map((l) => l.id)).toEqual(["sync-race", "sync-peterson", "sync-semaphores", "sync-monitors", "sync-classic"]);
    expect(sync.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...SYNC_DIAGRAMS].sort());
    for (const l of sync) expect(l.check.move.type).toBe("sync");
  });

  it("race diagram: Silberschatz's T0–T5 interleaving loses the producer's update (5 → 4)", () => {
    expect(SYNC_EXAMPLES.race.steps.map((s) => s.value)).toEqual([5, 6, 5, 4, 6, 4]);
    expect(SYNC_EXAMPLES.race.shared.counter).toBe(4);
  });

  it("race check: schedule counter++ against counter-- from 5 so it ends at 6", () => {
    const q = lessonById("sync-race")!.check;
    if (q.kind !== "interleave") throw new Error("expected interleave");
    expect(finalValues({ counter: 5 }, RACE_THREADS, "counter")).toEqual([4, 5, 6]);
    expect(RACE_VALUES).toEqual([4, 5, 6]);
    expect(questionProblems(q)).toEqual([]);
    expect(q.threads).toBe(RACE_THREADS);
    expect(grade(q, { kind: "interleave", schedule: q.answer })).toBe(true);
    // the consumer's 4 is overwritten by the producer's 6
    expect(lostUpdates({ counter: 5 }, RACE_THREADS, q.answer)).toEqual([1]);
    expect(grade(q, { kind: "interleave", schedule: [0, 0, 0, 1, 1, 1] })).toBe(false);
    expect(grade(q, { kind: "interleave", schedule: [0, 0, 1, 1, 0, 1] })).toBe(false);
  });

  it("race lesson has a free-play scheduler page", () => {
    expect(lessonById("sync-race")!.pages.filter((p) => p.play === "race")).toHaveLength(1);
  });

  it("Peterson check: P1 wrote turn last, so P0 enters (checked on the protocol model)", () => {
    const q = lessonById("sync-peterson")!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    // flag[0], flag[1], turn = 1 (P0), turn = 0 (P1), then both try to pass the loop
    const s = trace(PETERSON, [0, 1, 0, 1, 0, 1]).at(-1)!;
    expect(s.pc[0]).toBe(PETERSON.cs);
    expect(s.pc[1]).not.toBe(PETERSON.cs);
    expect(q.options[q.answer]).toBe("P0");
  });

  it("semaphore check: S = 2 and five wait()s block three (S ends at −3)", () => {
    const q = lessonById("sync-semaphores")!.check;
    if (q.kind !== "numeric") throw new Error("expected numeric");
    expect(SEM_CHECK.value).toBe(-3);
    expect(q.answer).toBe(3);
    expect(grade(q, { kind: "numeric", value: "3" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "2" })).toBe(false);
    // the diagram: S = 3 and five wait()s leave two queued
    expect(SYNC_EXAMPLES.semaphore).toEqual(runSemaphore(3, ["T1", "T2", "T3", "T4", "T5"].map((who) => ({ op: "wait" as const, who }))));
    expect(SYNC_EXAMPLES.semaphore.blocked).toEqual(["T4", "T5"]);
  });

  it("monitor check: a signal with no waiter has no effect (Silberschatz §6.7.2)", () => {
    const q = lessonById("sync-monitors")!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toMatch(/^Nothing/);
  });

  it("bounded-buffer check: wait(empty) → wait(mutex) → add → signal(mutex) → signal(full) (Silberschatz Fig. 7.1)", () => {
    const q = lessonById("sync-classic")!.check as OrderQ;
    expect(q.kind).toBe("order");
    expect(q.steps).toEqual(["wait(empty)", "wait(mutex)", "Add the item to the buffer", "signal(mutex)", "signal(full)"]);
    expect(grade(q, { kind: "order", order: [0, 1, 2, 3, 4] })).toBe(true);
    expect(grade(q, { kind: "order", order: [1, 0, 2, 3, 4] })).toBe(false);
  });
});

describe("deadlock lessons", () => {
  const mcq = (id: string) => {
    const q = lessonById(id)!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    return q;
  };

  it("cover every Gridlock Gym topic in order; the graph diagram is on two pages", () => {
    const ls = lessonsOf("deadlocks");
    expect(ls).toHaveLength(GYMS.find((g) => g.id === "deadlocks")!.topics.length);
    expect(ls.map((l) => l.id)).toEqual(["deadlocks-coffman", "deadlocks-rag", "deadlocks-prevention", "deadlocks-banker", "deadlocks-recovery"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual(["banker", "rag", "rag"]);
    for (const l of ls) expect(l.check.move.type).toBe("sync");
  });

  it("graph check: P1 → R1 → P2 → R2 with R2 free has no cycle; the diagram's graph does", () => {
    expect(findCycle(RAG_CHECK_EDGES)).toBeNull();
    expect(mcq("deadlocks-rag").options[mcq("deadlocks-rag").answer]).toMatch(/^No/);
    expect(findCycle([["P1", "R1"], ["R1", "P2"], ["P2", "R2"], ["R2", "P1"]])).not.toBeNull();
  });

  it("Banker's check: tap a safe sequence; the textbook's passes, orders that start with P0 or P2 fail", () => {
    const q = lessonById("deadlocks-banker")!.check;
    if (q.kind !== "banker") throw new Error("expected banker");
    expect(questionProblems(q)).toEqual([]);
    expect(q.answer).toEqual([1, 3, 4, 0, 2]);
    expect(grade(q, { kind: "banker", sequence: [1, 3, 4, 0, 2] })).toBe(true);
    expect(grade(q, { kind: "banker", sequence: [3, 1, 4, 0, 2] })).toBe(true); // other safe orders count
    expect(grade(q, { kind: "banker", sequence: [0, 1, 2, 3, 4] })).toBe(false);
    expect(grade(q, { kind: "banker", sequence: [2, 0, 4, 3, 1] })).toBe(false);
    expect(grade(q, { kind: "banker", sequence: [1, 3, 4, 0] })).toBe(false);
  });

  it("the RAG lesson has a free-play cycle page whose graph has a four-node cycle", () => {
    expect(lessonById("deadlocks-rag")!.pages.filter((p) => p.play === "rag")).toHaveLength(1);
    expect(isCycleNodes(RAG_PLAY.edges, ["P1", "R1", "P2", "R2"])).toBe(true);
  });

  it("the Banker's lesson has a free-play safe-sequence page", () => {
    expect(lessonById("deadlocks-banker")!.pages.filter((p) => p.play === "banker")).toHaveLength(1);
  });

  it("recovery check: P2 asking for one more C deadlocks four processes", () => {
    const q = lessonById("deadlocks-recovery")!.check;
    if (q.kind !== "numeric") throw new Error("expected numeric");
    expect(detect(DETECT_EXAMPLE.available, DETECT_EXAMPLE.allocation, DETECT_CHECK_REQUESTS)).toEqual([1, 2, 3, 4]);
    expect(grade(q, { kind: "numeric", value: "4" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "5" })).toBe(false);
  });

  it("Coffman and prevention checks name circular wait", () => {
    expect(mcq("deadlocks-coffman").options[0]).toBe("Circular wait");
    expect(mcq("deadlocks-prevention").options[0]).toBe("Circular wait");
  });
});

describe("lesson progress in the save", () => {
  it("defaults to none", () => {
    expect(DEFAULT_SAVE.lessons).toEqual([]);
    expect(parseSave(JSON.stringify({ badges: [] })).lessons).toEqual([]);
  });

  it("keeps known lesson ids once and drops the rest", () => {
    const s = parseSave(JSON.stringify({ lessons: ["basics-boot", "nope", 3, "basics-boot", "basics-modes"] }));
    expect(s.lessons).toEqual(["basics-boot", "basics-modes"]);
    expect(parseSave(JSON.stringify({ lessons: "basics-boot" })).lessons).toEqual([]);
  });
});

describe("memory lessons", () => {
  const check = (id: string) => lessonById(id)!.check;
  const numeric = (id: string) => {
    const q = check(id);
    if (q.kind !== "numeric") throw new Error("expected numeric");
    return q;
  };

  it("cover the five Heap Harbor topics in order, each diagram used once, with the memory move", () => {
    const ls = lessonsOf("memory");
    expect(ls.map((l) => l.id)).toEqual(["memory-contiguous", "memory-paging", "memory-tables", "memory-tlb", "memory-segments"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...MEMORY_DIAGRAMS].sort());
    for (const l of ls) expect(l.check.move.type).toBe("memory");
  });

  it("contiguous check: best fit puts 212K in the 300K hole, leaving 88K (Silberschatz exercise 9.x)", () => {
    const q = numeric("memory-contiguous");
    expect(q.answer).toBe(88);
    expect(BEST_LEFT).toBe(88);
    expect(allocate(FIT_EXAMPLE.holes, [212], "first").holes.map((h) => h.size)).toEqual([100, 288, 200, 300, 600]);
    expect(allocate(FIT_EXAMPLE.holes, [212], "worst").holes.map((h) => h.size)).toEqual([100, 500, 200, 300, 388]);
    expect(grade(q, { kind: "numeric", value: "88" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "288" })).toBe(false);
  });

  it("fragmentation diagram: 60K free but the largest hole is 26K, and 72,766 B in 2,048 B pages wastes 962 B", () => {
    expect(FRAG_EXAMPLE.external).toMatchObject({ free: 60, largest: 26, fits: false });
    expect(FRAG_EXAMPLE.internal).toEqual({ pages: 36, lastUsed: 1086, internalFragmentation: 962 });
  });

  it("paging check: logical 6 is page 1, offset 2 → frame 6 → physical 26; the diagram shows 13 → 9", () => {
    const q = numeric("memory-paging");
    expect(PAGING_CHECK).toMatchObject({ page: 1, offset: 2, frame: 6, physical: 26 });
    expect(q.answer).toBe(26);
    expect(PAGING_EXAMPLE).toMatchObject({ page: 3, offset: 1, frame: 2, physical: 9 });
  });

  it("page-table check: 2^20 four-byte entries are 4 MB; the split is 10 + 10 + 12; inverted lookup of (1, 3) finds frame 2 in 3 probes", () => {
    expect(numeric("memory-tables").answer).toBe(4);
    expect(FLAT_TABLE_MB).toBe(4);
    expect(PTABLE_EXAMPLE.split.levels).toEqual([10, 10]);
    expect(PTABLE_EXAMPLE.split.offset).toBe(12);
    expect(PTABLE_EXAMPLE.inverted).toEqual({ frame: 2, probes: 3 });
  });

  it("TLB check: 90% hits at 10 ns TLB, 100 ns memory is 120 ns; the diagram's 80% and 98% give 140 and 122 ns", () => {
    expect(numeric("memory-tlb").answer).toBe(120);
    expect(TLB_CHECK).toBe(120);
    expect(TLB_EXAMPLE.slow).toBeCloseTo(140, 9);
    expect(TLB_EXAMPLE.fast).toBeCloseTo(122, 9);
  });

  it("segments check: offset 400 of a 400-byte segment traps; the diagram's three translations are 4353, 4052 and a trap", () => {
    const q = check("memory-segments");
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toMatch(/^A trap/);
    expect(SEGMENT_TRACES.map((t) => (t.r.ok ? t.r.physical : "trap"))).toEqual([4353, 4052, "trap"]);
  });
});

describe("virtual-memory lessons", () => {
  const check = (id: string) => lessonById(id)!.check;
  const numeric = (id: string) => {
    const q = check(id);
    if (q.kind !== "numeric") throw new Error("expected numeric");
    return q;
  };

  it("cover the five Swapwood topics in order, each diagram used once, with the memory move", () => {
    const ls = lessonsOf("virtual");
    expect(ls.map((l) => l.id)).toEqual(["virtual-demand", "virtual-replace", "virtual-belady", "virtual-thrash", "virtual-wss"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...VIRTUAL_DIAGRAMS].sort());
    for (const l of ls) expect(l.check.move.type).toBe("memory");
  });

  it("demand check: p = 0.0005 gives 4199.9 ns; the diagram's p = 0.001 gives 8199.8 ns", () => {
    const q = numeric("virtual-demand");
    expect(DEMAND_CHECK).toBe(4199.9);
    expect(q.answer).toBe(4199.9);
    expect(grade(q, { kind: "numeric", value: "4199.9" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "8199.8" })).toBe(false);
    expect(DEMAND_EXAMPLE.eat).toBeCloseTo(8199.8, 6);
  });

  it("replace check: LRU on 1 2 3 1 4 2 1 5 faults 6 times; the diagram shows 15, 12 and 9 faults", () => {
    expect(numeric("virtual-replace").answer).toBe(6);
    expect(LRU_CHECK).toBe(6);
    expect(REPLACE_EXAMPLE.faults).toEqual({ fifo: 15, lru: 12, opt: 9 });
  });

  it("Belady check: only FIFO is anomalous; the diagram's FIFO curve rises 9 → 10 at 4 frames and LRU's never rises", () => {
    const q = check("virtual-belady");
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toBe("FIFO");
    expect(ANOMALY).toEqual({ fifo: 4, lru: null, opt: null });
    expect(BELADY_CURVES.fifo.slice(2, 4)).toEqual([9, 10]);
    expect(BELADY_CURVES.lru.every((n, i, a) => i === 0 || n <= a[i - 1])).toBe(true);
  });

  it("thrash check: suspend processes", () => {
    const q = check("virtual-thrash");
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toMatch(/^Suspend/);
  });

  it("working-set check: size 5; Figure 10.16 gives {1,2,5,6,7} at t1 and {3,4} at t2", () => {
    expect(numeric("virtual-wss").answer).toBe(5);
    expect(WSS_CHECK).toBe(5);
    expect(WSS_EXAMPLE).toEqual({ t1: [1, 2, 5, 6, 7], t2: [3, 4] });
  });
});

describe("storage lessons", () => {
  const check = (id: string) => lessonById(id)!.check;
  const numeric = (id: string) => {
    const q = check(id);
    if (q.kind !== "numeric") throw new Error("expected numeric");
    return q;
  };

  it("cover the five Disk Docks topics in order, each diagram used once, with the storage move", () => {
    const ls = lessonsOf("storage");
    expect(ls.map((l) => l.id)).toEqual(["storage-alloc", "storage-inode", "storage-journal", "storage-raid", "storage-disk"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : []))).sort()).toEqual([...STORAGE_DIAGRAMS].sort());
    for (const l of ls) expect(l.check.move.type).toBe("storage");
  });

  it("alloc check: linked allocation needs 10 reads for block 9; the diagram says 1, 10 and 2", () => {
    expect(numeric("storage-alloc").answer).toBe(10);
    expect(ALLOC_CHECK).toBe(10);
    expect(ALLOC_ROWS.map((r) => r.reads)).toEqual([1, 10, 2]);
  });

  it("inode check: 12 + 256 + 65,536 + 16,777,216 = 16,843,020 blocks", () => {
    expect(numeric("storage-inode").answer).toBe(16_843_020);
    expect(INODE_CHECK).toBe(12 + 256 + 65_536 + 16_777_216);
    expect(INODE_EXAMPLE.blocks).toBe(INODE_CHECK);
    expect(grade(numeric("storage-inode"), { kind: "numeric", value: "16843020" })).toBe(true);
  });

  it("journal check: replay the committed transaction", () => {
    const q = check("storage-journal");
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toBe("Replay the logged transaction");
  });

  it("RAID check: RAID 5 on six 2 TB disks leaves 10 TB; the diagram's four-disk rows are textbook", () => {
    expect(numeric("storage-raid").answer).toBe(10);
    expect(RAID_CHECK).toBe(10);
    expect(RAID_EXAMPLE).toEqual([
      { level: 0, usable: 4, survives: 0 },
      { level: 1, usable: 2, survives: 1 },
      { level: 5, usable: 3, survives: 1 },
      { level: 6, usable: 2, survives: 2 },
      { level: 10, usable: 2, survives: 1 },
    ]);
  });

  it("disk check: LOOK moves 299; the diagram shows Silberschatz's 640, 236, 331, 382, 299 and 322", () => {
    expect(numeric("storage-disk").answer).toBe(299);
    expect(LOOK_CHECK).toBe(299);
    expect(DISK_BARS).toEqual({ fcfs: 640, sstf: 236, scan: 331, cscan: 382, look: 299, clook: 322 });
  });
});

describe("container lessons (Kernel Summit)", () => {
  const ls = lessonsOf("interview");
  it("run namespaces, cgroups, overlayfs, containers vs VMs, then docker run, each with its own diagram", () => {
    const own = ls.filter((l) => l.id.startsWith("containers-"));
    expect(own.map((l) => l.id)).toEqual(["containers-namespaces", "containers-cgroups", "containers-overlayfs", "containers-vms", "containers-run"]);
    expect(own.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : [])))).toEqual(CONTAINER_DIAGRAMS);
  });

  it("namespaces check: a PID namespace (pid_namespaces(7)); the other options are wrong", () => {
    const q = lessonById("containers-namespaces")!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toMatch(/PID namespace/);
    for (let i = 0; i < q.options.length; i++) expect(grade(q, { kind: "mcq", choice: i })).toBe(i === q.answer);
  });

  it("namespaces diagram: PID 1 inside, a larger PID on the host", () => {
    const { a, b, aId, bId } = NAMESPACE_EXAMPLE;
    expect(a.map((p) => p.get(aId))).toEqual([1, 2]);
    expect(a.map((p) => p.get(0))).toEqual([3, 4]);
    expect(b[0].get(bId)).toBe(1);
    expect(b[0].get(0)).toBe(5);
  });

  it("cgroups check: 25 ms of quota over 8 busy CPUs is 3.125 ms of wall clock", () => {
    expect(CPU_MAX_CHECK).toBe(3.125);
    const q = lessonById("containers-cgroups")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "3.125" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "25" })).toBe(false);
    expect(grade(q, { kind: "numeric", value: "12.5" })).toBe(false);
  });

  it("cgroups diagram: half a CPU takes 12.5 ms with four threads, and the OOM killer shoots the leak", () => {
    expect(CGROUP_EXAMPLE.throttle.map((t) => t.runUs)).toEqual([12500, 50000]);
    expect(CGROUP_EXAMPLE.mem.fits.killed).toEqual([]);
    expect(CGROUP_EXAMPLE.mem.over.killed).toEqual(["leak"]);
  });

  it("overlayfs check: one byte written to a 100 MB lower file copies up all 100 MB", () => {
    expect(COPY_UP_CHECK).toBe(100);
    const q = lessonById("containers-overlayfs")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "100" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "1" })).toBe(false);
    expect(grade(q, { kind: "numeric", value: "0" })).toBe(false);
  });

  it("overlayfs diagram: the write copied up 100 MB, the delete hid the app binary but kept the rest", () => {
    const { overlay, merged } = OVERLAY_EXAMPLE;
    expect(overlay.copiedUpMB).toBe(100);
    expect(merged).toEqual(["/bin/sh", "/db/data", "/etc/motd"]);
  });

  it("VM and docker-run checks: the keyed option is the only right one", () => {
    for (const id of ["containers-vms", "containers-run"]) {
      const q = lessonById(id)!.check;
      if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
      for (let i = 0; i < q.options.length; i++) expect(grade(q, { kind: "mcq", choice: i })).toBe(i === q.answer);
    }
    const run = lessonById("containers-run")!.check;
    if (run.kind !== undefined && run.kind !== "mcq") throw new Error("expected mcq");
    expect(run.options[run.answer]).toBe("pivot_root");
    expect(DOCKER_RUN_STEPS.map((s) => s[0].split(" ")[0])).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(DOCKER_RUN_STEPS[3][0]).toMatch(/PIVOT_ROOT/);
    expect(DOCKER_RUN_STEPS[5][0]).toMatch(/EXECVE/);
  });
});

describe("virtualization lessons (Kernel Summit)", () => {
  const ls = lessonsOf("interview").filter((l) => l.id.startsWith("virt-"));
  it("follow the containers: trap-and-emulate, paging, hypervisors, each diagram once", () => {
    expect(ls.map((l) => l.id)).toEqual(["virt-trap", "virt-paging", "virt-hypervisors"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : [])))).toEqual(VIRT_DIAGRAMS);
  });

  it("trap check: only the POPF option is right", () => {
    const q = lessonById("virt-trap")!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toMatch(/POPF/);
    for (let i = 0; i < q.options.length; i++) expect(grade(q, { kind: "mcq", choice: i })).toBe(i === q.answer);
  });

  it("trap diagram: the same program leaks once before VT-x and never with it", () => {
    expect(TRAP_EXAMPLE.old.filter((r) => r.outcome === "leak").map((r) => r.name)).toEqual(["POPF"]);
    expect(TRAP_EXAMPLE.hw.some((r) => r.outcome === "leak")).toBe(false);
  });

  it("paging check: 24 reads (Bhargava et al.)", () => {
    expect(NESTED_CHECK).toBe(24);
    expect(NESTED_WALK).toBe(24);
    const q = lessonById("virt-paging")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "24" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "16" })).toBe(false);
    expect(grade(q, { kind: "numeric", value: "4" })).toBe(false);
  });

  it("migration check: rounds 8192, 2048, 512, 128 MB, then a 32 ms pause", () => {
    expect(MIGRATION_EXAMPLE.rounds.map((r) => r.sentMB)).toEqual([8192, 2048, 512, 128]);
    expect(MIGRATE_CHECK).toBe(32);
    const q = lessonById("virt-hypervisors")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "32" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "128" })).toBe(false);
  });
});

describe("atomics lessons (Kernel Summit)", () => {
  const ls = lessonsOf("interview").filter((l) => l.id.startsWith("atomics-"));
  it("cover CAS/ABA, ordering, false sharing and futexes, each diagram once", () => {
    expect(ls.map((l) => l.id)).toEqual(["atomics-cas", "atomics-order", "atomics-false-sharing", "atomics-futex"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : [])))).toEqual(ATOMIC_DIAGRAMS);
  });

  it("CAS check: only the pop-pop-push-back interleaving is right", () => {
    const q = lessonById("atomics-cas")!.check;
    if (q.kind !== undefined && q.kind !== "mcq") throw new Error("expected mcq");
    expect(q.options[q.answer]).toMatch(/pushes A back/);
    for (let i = 0; i < q.options.length; i++) expect(grade(q, { kind: "mcq", choice: i })).toBe(i === q.answer);
  });

  it("ABA diagram data: untagged corrupts, tagged fails safely", () => {
    expect(ABA_EXAMPLE.untagged.corrupt).toBe(true);
    expect(ABA_EXAMPLE.tagged.stack).toEqual(["A", "C"]);
  });

  it("ordering check: 4 outcomes on TSO, 3 sequentially consistent", () => {
    expect(SB_EXAMPLE.sc).toHaveLength(3);
    expect(SB_EXAMPLE.tso).toHaveLength(4);
    const q = lessonById("atomics-order")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "4" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "3" })).toBe(false);
  });

  it("false sharing check: 1000 misses shared, 2 padded", () => {
    expect(FALSE_SHARING_EXAMPLE.shared).toBe(1000);
    expect(FALSE_SHARING_EXAMPLE.padded).toBe(2);
    const q = lessonById("atomics-false-sharing")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "1000" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "2" })).toBe(false);
  });

  it("futex check: one wait plus one wake", () => {
    expect(FUTEX_EXAMPLE.fastLocks).toBe(1);
    const q = lessonById("atomics-futex")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "2" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "0" })).toBe(false);
  });
});

describe("allocator lessons (Kernel Summit)", () => {
  const ls = lessonsOf("interview").filter((l) => l.id.startsWith("alloc-"));
  it("cover free lists, buddy, slab and huge pages, each diagram once", () => {
    expect(ls.map((l) => l.id)).toEqual(["alloc-freelist", "alloc-buddy", "alloc-slab", "alloc-hugepages"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : [])))).toEqual(ALLOCATOR_DIAGRAMS);
  });

  it("free-list check: a 40-byte hole is the largest although 70 are free", () => {
    expect(HEAP_EXAMPLE.free).toBe(70);
    expect(HEAP_EXAMPLE.largest).toBe(40);
    expect(HEAP_EXAMPLE.fits50).toBe(false);
    const q = lessonById("alloc-freelist")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "40" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "70" })).toBe(false);
  });

  it("buddy check: 21 KB gets a 32 KB block, 11 KB wasted", () => {
    expect(BUDDY_EXAMPLE.grant).toMatchObject({ block: 32, splits: 3, wasted: 11 });
    expect(BUDDY_EXAMPLE.free).toEqual([[32, 32], [64, 64], [128, 128]]);
    const q = lessonById("alloc-buddy")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "11" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "32" })).toBe(false);
  });

  it("slab check: 21 objects of 192 B fit a 4 KB slab with 64 B left", () => {
    expect(SLAB_EXAMPLE.leftover192).toBe(64);
    expect(SLAB_EXAMPLE.slabs).toEqual([2, 2]);
    expect(SLAB_EXAMPLE.states).toEqual({ full: 0, partial: 2, empty: 0 });
    expect(SLAB_EXAMPLE.ctor).toBe(8);
    expect(SLAB_EXAMPLE.locks).toEqual([1000, 32]);
    const q = lessonById("alloc-slab")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "21" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "22" })).toBe(false);
  });

  it("huge-page check: 64 entries reach 128 MB with 2 MB pages", () => {
    expect(HUGE_EXAMPLE).toMatchObject({ reachSmall: 262144, reachHuge: 134217728, pagesSmall: 262144, pagesHuge: 512, tableSmall: 2097152, tableHuge: 4096 });
    const q = lessonById("alloc-hugepages")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "128" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "256" })).toBe(false);
  });
});

describe("I/O lessons (Kernel Summit)", () => {
  const ls = lessonsOf("interview").filter((l) => l.id.startsWith("io-"));
  it("cover the I/O models and select/poll/epoll, each diagram once", () => {
    expect(ls.map((l) => l.id)).toEqual(["io-models", "io-epoll"]);
    expect(ls.flatMap((l) => l.pages.flatMap((p) => (p.diagram ? [p.diagram] : [])))).toEqual(IO_DIAGRAMS);
  });

  it("I/O model check: only async I/O avoids blocking in both phases", () => {
    const q = lessonById("io-models")!.check;
    expect(q.kind ?? "mcq").toBe("mcq");
    expect(grade(q, { kind: "mcq", choice: 3 })).toBe(true);
    expect(grade(q, { kind: "mcq", choice: 2 })).toBe(false);
    expect(grade(q, { kind: "mcq", choice: 1 })).toBe(false);
  });

  it("epoll check: poll scans 10000 entries, epoll_wait returns 10", () => {
    expect(IO_EXAMPLE.poll.callerScan).toBe(10000);
    expect(IO_EXAMPLE.epoll.callerScan).toBe(10);
    const q = lessonById("io-epoll")!.check;
    expect(q.kind).toBe("numeric");
    expect(grade(q, { kind: "numeric", value: "1000" })).toBe(true);
    expect(grade(q, { kind: "numeric", value: "10" })).toBe(false);
  });
});
