import type { Question } from "@/game/engine/question";
import { roundRobin, sjf } from "@/game/sim/scheduling";
import { BANKER_EXAMPLE, DETECT_EXAMPLE, detect, safety } from "@/game/sim/deadlock";
import { FIT_EXAMPLE, SEGMENT_EXAMPLE, allocate, effectiveAccessTime, pageTableBytes, translate, translateSegment } from "@/game/sim/memory";
import { BELADY_EXAMPLE, beladyAt, demandPagingEat, faultCount, faultCurve, workingSet } from "@/game/sim/paging";
import { DISK_EXAMPLE, blockReads, inodeMaxBlocks, raidUsableDisks, scheduleDisk } from "@/game/sim/storage";
import { cpuMax } from "@/game/sim/containers";
import { finalValues, increment, runSemaphore, type SyncThread } from "@/game/sim/sync";

/**
 * Concept lessons, read before a gym's battles (ROADMAP §2: lessons →
 * generated battles → boss). A lesson is a few short pages, some with an
 * illustrated diagram, and ends with one quick-check question of any kind.
 * Facts follow Silberschatz, Operating System Concepts (10th ed.), ch. 1–7;
 * every quick check is tested in tests/lessons.test.ts.
 */
export type DiagramId = "modes" | "syscall" | "interrupt" | "kernels" | "boot" | "pstates" | "context" | "fork" | "threads" | "ipc" | "fcfs" | "sjf" | "priority" | "rr" | "mlfq" | "race" | "peterson" | "semaphore" | "monitor" | "philosophers" | "rag" | "banker" | "fit" | "frag" | "paging" | "ptable" | "tlb" | "segments" | "demand" | "replace" | "belady" | "thrash" | "wss" | "alloc" | "inode" | "journal" | "raid" | "disk" | "namespaces" | "cgroups";

export interface LessonPage {
  heading: string;
  /** paragraphs; `backticks` render as code */
  body: string[];
  diagram?: DiagramId;
  /** an interactive board shown in place of a diagram */
  play?: "race" | "banker" | "rag";
}

export interface Lesson {
  id: string;
  gym: string;
  title: string;
  pages: LessonPage[];
  check: Question;
}

const MOVE = { name: "Recall", type: "io", power: 30 } as const;
const PMOVE = { name: "Recall", type: "process", power: 30 } as const;
const SMOVE = { name: "Recall", type: "scheduler", power: 30 } as const;

/** The quick checks' workloads; their answers and charts come from the simulators. */
export const SJF_CHECK_JOBS = [
  { name: "P1", arrival: 0, burst: 7 },
  { name: "P2", arrival: 0, burst: 4 },
  { name: "P3", arrival: 0, burst: 1 },
  { name: "P4", arrival: 0, burst: 4 },
];
const SJF_CHECK = sjf(SJF_CHECK_JOBS);
export const RR_CHECK_JOBS = [
  { name: "P1", arrival: 0, burst: 5 },
  { name: "P2", arrival: 0, burst: 3 },
  { name: "P3", arrival: 0, burst: 1 },
];
const RR_CHECK = roundRobin(RR_CHECK_JOBS, 2);
/** Silberschatz §6.1: a producer's counter++ racing a consumer's counter-- from 5. */
export const RACE_THREADS: SyncThread[] = [
  { name: "PRODUCER", code: increment("counter", "r1", 1) },
  { name: "CONSUMER", code: increment("counter", "r2", -1) },
];
export const RACE_VALUES = finalValues({ counter: 5 }, RACE_THREADS, "counter");
/** The race check's schedule: the producer loads first and stores last, so the consumer's update is lost. */
const RACE_CHECK_ANSWER = [0, 1, 1, 1, 0, 0];
/** five processes wait() on a semaphore that starts at 2 */
export const SEM_CHECK = runSemaphore(2, ["A", "B", "C", "D", "E"].map((who) => ({ op: "wait" as const, who })));
const YMOVE = { name: "Recall", type: "sync", power: 30 } as const;
/** the recovery check: P2 asks for one more C in the detection example */
export const DETECT_CHECK_REQUESTS = DETECT_EXAMPLE.requests.map((r, i) => (i === 2 ? [0, 0, 1] : r));
export const DETECT_CHECK = detect(DETECT_EXAMPLE.available, DETECT_EXAMPLE.allocation, DETECT_CHECK_REQUESTS);
/** the graph check: P1 → R1, R1 → P2 and P2 → R2, where R2 is free */
export const RAG_CHECK_EDGES = [["P1", "R1"], ["R1", "P2"], ["P2", "R2"]] as const;
const VMOVE = { name: "Recall", type: "memory", power: 30 } as const;
const STMOVE = { name: "Defrag", type: "storage", power: 30 } as const;
const CMOVE = { name: "Recall", type: "process", power: 30 } as const;
/** The cgroup quick check: cpu.max "25000 100000" with 8 busy threads on 8 CPUs. */
export const CPU_MAX_CHECK = cpuMax(25000, 100000, 8, 8).runUs / 1000;
const MMOVE = { name: "Recall", type: "memory", power: 30 } as const;

/** The memory quick checks' answers, computed by the simulators. */
const BEST_FIT = allocate(FIT_EXAMPLE.holes, [FIT_EXAMPLE.requests[0]], "best");
export const BEST_LEFT = BEST_FIT.holes.find((h) => h.start === 4000 + FIT_EXAMPLE.requests[0])!.size;
export const PAGING_TABLE = [5, 6, 1, 2];
export const PAGING_CHECK = translate(6, 4, PAGING_TABLE);
export const FLAT_TABLE_MB = pageTableBytes(32, 4096, 4) / 2 ** 20;
export const TLB_CHECK = Math.round(effectiveAccessTime(0.9, 10, 100) * 100) / 100;
export const SEGMENT_CHECK = !translateSegment(SEGMENT_EXAMPLE, 1, 400).ok;

/** The virtual-memory quick checks' answers, computed by the simulators. */
export const DEMAND_CHECK = Math.round(demandPagingEat(0.0005, 200, 8_000_000) * 10) / 10;
export const LRU_CHECK_REFS = [1, 2, 3, 1, 4, 2, 1, 5];
export const LRU_CHECK = faultCount(LRU_CHECK_REFS, 3, "lru");
export const ANOMALY = { fifo: beladyAt(faultCurve(BELADY_EXAMPLE, "fifo", 7)), lru: beladyAt(faultCurve(BELADY_EXAMPLE, "lru", 7)), opt: beladyAt(faultCurve(BELADY_EXAMPLE, "opt", 7)) };
export const WSS_CHECK_REFS = [2, 6, 1, 5, 7, 7, 7, 7, 5, 1];
export const WSS_CHECK = workingSet(WSS_CHECK_REFS, WSS_CHECK_REFS.length - 1, 10).length;

/** The storage quick checks' answers, computed by the simulators. */
export const ALLOC_CHECK = blockReads("linked", 9);
export const INODE_CHECK = inodeMaxBlocks(1024, 4);
export const RAID_CHECK = raidUsableDisks(5, 6) * 2;
export const LOOK_CHECK = scheduleDisk(DISK_EXAMPLE.queue, DISK_EXAMPLE.head, "look", DISK_EXAMPLE.cylinders, "up").movement;
const table = (js: { name: string; burst: number }[]) => ["Proc  Burst", ...js.map((j) => `${j.name.padEnd(6)}${j.burst}`)].join("\n");

export const LESSONS: Lesson[] = [
  {
    id: "basics-modes",
    gym: "basics",
    title: "Kernel mode and user mode",
    pages: [
      {
        heading: "Two modes",
        body: [
          "The CPU keeps a mode bit in hardware. Kernel mode (also called supervisor or privileged mode) is bit 0, user mode is bit 1.",
          "The OS runs in kernel mode. Your programs run in user mode. Every switch between them goes through the hardware.",
        ],
        diagram: "modes",
      },
      {
        heading: "Privileged instructions",
        body: [
          "Some instructions could wreck the system, so the hardware only runs them in kernel mode: I/O control, setting the timer, turning interrupts on or off, and changing the mode bit itself.",
          "If user code tries one, the CPU does not run it. It traps to the OS, which treats it as illegal and usually terminates the program.",
        ],
      },
      {
        heading: "Keeping control",
        body: [
          "Before handing the CPU to a user program, the OS sets a timer. When it fires, an interrupt returns control to the kernel, so a program stuck in a loop cannot hold the CPU forever.",
          "x86 has four privilege rings: the kernel runs in ring 0 and applications in ring 3. Rings 1 and 2 are rarely used.",
        ],
      },
    ],
    check: {
      id: "lesson-modes",
      prompt: "Which of these is safe to run in user mode?",
      options: ["Turn off interrupts", "Set the timer", "Issue a trap (system call) instruction", "Directly access an I/O device"],
      answer: 2,
      explain: "A trap instruction is how user code asks for the kernel, so it must be allowed in user mode. The other three are privileged.",
      move: MOVE,
    },
  },
  {
    id: "basics-syscalls",
    gym: "basics",
    title: "System calls",
    pages: [
      {
        heading: "Asking the kernel",
        body: [
          "A system call is how a program asks the kernel to do something it can't do itself: open a file, read from it, create a process, exit.",
          "Programs rarely make them directly. They call an API such as POSIX (through the C library) or the Windows API, and the library makes the system call.",
        ],
      },
      {
        heading: "The trip into the kernel",
        body: [
          "The library puts the system-call number and the arguments in registers and runs a trap instruction (`syscall` on x86-64). The CPU switches to kernel mode.",
          "The kernel looks the number up in its system-call table, runs the handler, puts the result in a register and returns from the trap, back to user mode.",
        ],
        diagram: "syscall",
      },
      {
        heading: "Passing parameters",
        body: [
          "There are three ways to pass arguments: in registers; in a block in memory whose address goes in a register; or pushed on the stack.",
          "System calls fall into six groups: process control, file management, device management, information maintenance, communications and protection.",
        ],
      },
    ],
    check: {
      id: "lesson-syscalls",
      kind: "order",
      prompt: "Put a read() system call in order.",
      steps: [
        "The program calls read() in the C library",
        "The library puts the call number and arguments in registers",
        "A trap instruction switches the CPU to kernel mode",
        "The kernel finds the handler in the system-call table and runs it",
        "Return from trap: back to user mode with the result",
      ],
      explain: "Library wrapper → registers → trap into kernel mode → table lookup and handler → return to user mode.",
      move: MOVE,
    },
  },
  {
    id: "basics-interrupts",
    gym: "basics",
    title: "Interrupts and traps",
    pages: [
      {
        heading: "Interrupts",
        body: [
          "An interrupt is a hardware signal that arrives at any time: a disk finished a read, a key was pressed, the timer ticked. It is asynchronous: it has nothing to do with the instruction that is running.",
          "The CPU finishes its current instruction, saves its state, and jumps through the interrupt vector (a table of handler addresses, indexed by interrupt number) to the right handler.",
        ],
        diagram: "interrupt",
      },
      {
        heading: "Traps",
        body: [
          "A trap (or exception) is caused by the running instruction itself, so it is synchronous: divide by zero, an invalid memory access, a page fault, or a system-call instruction on purpose.",
          "A trap is often called a software-generated interrupt. It is handled the same way: save state, run the kernel's handler, then resume or terminate the program.",
        ],
      },
      {
        heading: "Masking and priorities",
        body: [
          "Maskable interrupts can be turned off while the kernel does critical work. Non-maskable ones (NMI) can't: they report errors such as unrecoverable memory faults.",
          "Interrupts beat polling: instead of the CPU checking a device over and over, the device speaks up when it is ready.",
        ],
      },
    ],
    check: {
      id: "lesson-interrupts",
      kind: "multi",
      prompt: "Which of these are traps (synchronous, caused by the running instruction)? Select all.",
      options: ["Divide by zero", "The disk finishes a read", "A page fault", "The timer fires", "A system-call instruction"],
      answers: [0, 2, 4],
      explain: "Divide by zero, page faults and system-call instructions come from the instruction being run. The disk and the timer raise hardware interrupts at any time.",
      move: MOVE,
    },
  },
  {
    id: "basics-kernels",
    gym: "basics",
    title: "Kernel designs",
    pages: [
      {
        heading: "Monolithic",
        body: [
          "A monolithic kernel puts every service (scheduling, memory, file systems, drivers, networking) in one program in kernel mode. Calls between them are plain function calls, so it is fast.",
          "The catch: a bug in any driver can crash the whole system. Traditional UNIX and Linux are monolithic. Linux can also load and unload modules while running.",
        ],
        diagram: "kernels",
      },
      {
        heading: "Microkernel",
        body: [
          "A microkernel keeps only the minimum in kernel mode: message passing (IPC), scheduling and basic memory management. File systems and drivers run as user-space servers.",
          "It is easier to extend and more reliable (a crashed server can be restarted), but every request costs messages and mode switches. Mach and QNX are microkernels.",
        ],
      },
      {
        heading: "Hybrid",
        body: [
          "Most real systems mix the two. Windows and macOS (whose XNU kernel combines Mach with BSD) are called hybrid: microkernel ideas, with most services in kernel space for speed.",
        ],
      },
    ],
    check: {
      id: "lesson-kernels",
      prompt: "A buggy disk driver crashes. In which design is the rest of the OS most likely to keep running?",
      options: ["Monolithic kernel", "Microkernel", "It makes no difference", "A kernel with no drivers"],
      answer: 1,
      explain: "In a microkernel the driver is a user-space server: it crashes alone and can be restarted. In a monolithic kernel it shares the kernel's address space.",
      move: MOVE,
    },
  },
  {
    id: "basics-boot",
    gym: "basics",
    title: "Booting",
    pages: [
      {
        heading: "Power on",
        body: [
          "At power-on the CPU starts running firmware stored in non-volatile memory: the BIOS on older PCs, UEFI on modern ones. It runs diagnostics (the power-on self-test) and finds a boot device.",
        ],
        diagram: "boot",
      },
      {
        heading: "The boot loader",
        body: [
          "A BIOS reads the first sector of the disk (the boot block) and runs it; that small program loads a larger boot loader. UEFI loads the boot loader straight from a file on the EFI system partition.",
          "The boot loader (GRUB on most Linux systems) loads the kernel image (and an initial RAM file system) into memory and jumps to its entry point.",
        ],
      },
      {
        heading: "Up and running",
        body: [
          "The kernel initialises the hardware and its data structures, mounts the root file system and starts the first user process, init (PID 1, often systemd).",
          "init starts the system services and the login screen. The system is running, and from now on the kernel only runs when an interrupt or a trap brings it in.",
        ],
      },
    ],
    check: {
      id: "lesson-boot",
      kind: "order",
      prompt: "Put the boot sequence in order.",
      steps: ["Power on: the CPU runs the firmware (BIOS / UEFI)", "Power-on self-test", "The boot loader is loaded and run", "The boot loader loads the kernel into memory", "The kernel starts init (PID 1)"],
      explain: "Firmware → POST → boot loader → kernel → init. Each stage loads the next, larger one.",
      move: MOVE,
    },
  },
  {
    id: "processes-states",
    gym: "processes",
    title: "Processes and their states",
    pages: [
      {
        heading: "A program in action",
        body: [
          "A program is a passive file on disk. A process is a program in execution: it has a program counter, registers and memory, and it changes as it runs. Two processes can run the same program.",
          "A process's memory has four parts: the text section (the code), the data section (global variables), the heap (memory allocated at run time, growing up) and the stack (function frames, growing down).",
        ],
      },
      {
        heading: "Five states",
        body: [
          "A process is new while it is being created, ready while it waits for a CPU, running while its instructions execute, waiting while it waits for an event such as I/O, and terminated when it has finished.",
          "Only one process can be running on a CPU core at a time, but many can be ready or waiting. A waiting process never goes straight back to running: when its event happens it becomes ready and waits for the scheduler.",
        ],
        diagram: "pstates",
      },
      {
        heading: "The PCB",
        body: [
          "The kernel keeps a process control block (PCB) for each process: its state, program counter, CPU registers, scheduling information (priority, queue pointers), memory-management information (such as page tables), accounting information and I/O status (open files).",
          "On Linux the PCB is a `task_struct`. The kernel keeps them in a list and in its ready and wait queues.",
        ],
      },
    ],
    check: {
      id: "lesson-pstates",
      prompt: "Which transition does NOT exist in the five-state process model?",
      options: ["Ready → Running", "Running → Waiting", "Waiting → Running", "Running → Ready"],
      answer: 2,
      explain: "When a waiting process's I/O or event completes, it moves to Ready. Only the scheduler's dispatch moves a process from Ready to Running.",
      move: PMOVE,
    },
  },
  {
    id: "processes-context",
    gym: "processes",
    title: "Context switch",
    pages: [
      {
        heading: "Saving and restoring",
        body: [
          "A process's context is its CPU state: the program counter, the registers and its memory-management state, all kept in its PCB.",
          "To switch the CPU to another process, the kernel saves the context of the old process in its PCB and loads the saved context of the new one. This is a context switch.",
        ],
        diagram: "context",
      },
      {
        heading: "When it happens",
        body: [
          "A switch can follow an interrupt (the timer ends a process's time slice), a system call that blocks (such as a disk read), or a process exiting.",
          "The scheduler chooses who runs next. The dispatcher does the switch: it loads the context, switches to user mode and jumps to the right place in the program. The time it takes is the dispatch latency.",
          "A system call alone is a mode switch, not a context switch: the same process keeps running, now in kernel mode.",
        ],
      },
      {
        heading: "Pure overhead",
        body: [
          "No useful work is done while switching, so it is overhead. It typically takes a few microseconds, depending on memory speed, the number of registers and special instructions. Some CPUs keep several register sets, so a switch only changes a pointer.",
          "There is a hidden cost too: the new process starts with caches and TLB entries full of the old process's data.",
        ],
      },
    ],
    check: {
      id: "lesson-context",
      kind: "order",
      prompt: "Put a context switch from P0 to P1 in order.",
      steps: [
        "P0 is running in user mode",
        "A timer interrupt switches the CPU to kernel mode",
        "The kernel saves P0's state in PCB0",
        "The kernel reloads P1's state from PCB1",
        "P1 resumes in user mode",
      ],
      explain: "Interrupt into the kernel → save the old state into its PCB → reload the new state from its PCB → back to user mode in the new process.",
      move: PMOVE,
    },
  },
  {
    id: "processes-fork",
    gym: "processes",
    title: "fork(), exec() and wait()",
    pages: [
      {
        heading: "fork()",
        body: [
          "On UNIX, `fork()` creates a new process: the child, a copy of the parent's address space. Both go on running from the instruction after the call.",
          "`fork()` returns 0 in the child and the child's PID in the parent (or -1 if it fails), so the code can tell them apart. Modern systems use copy-on-write: pages are shared until one side writes to them.",
        ],
      },
      {
        heading: "exec() and wait()",
        body: [
          "The child usually calls one of the `exec()` family to replace its memory image with a new program. On success `exec()` never returns: the old code is gone.",
          "The parent can call `wait()` to block until a child terminates. It gets back the child's PID and its exit status.",
        ],
        diagram: "fork",
      },
      {
        heading: "Zombies and orphans",
        body: [
          "A child that has exited but whose parent has not yet called `wait()` is a zombie: its process-table entry stays to hold the exit status.",
          "If a parent exits without waiting, its children are orphans. On Linux, init (or systemd) adopts them and calls `wait()` for them.",
          "Every process alive at a `fork()` splits in two, so n `fork()` calls in a row make 2^n processes.",
        ],
      },
    ],
    check: {
      id: "lesson-fork",
      kind: "numeric",
      prompt: "How many times does this program print \"hi\"?",
      code: 'int main() {\n  fork();\n  fork();\n  printf("hi\\n");\n}',
      answer: 4,
      explain: "The first fork() makes 2 processes and the second fork() runs in both, making 4. Each of the 4 prints once.",
      move: PMOVE,
    },
  },
  {
    id: "processes-threads",
    gym: "processes",
    title: "Threads",
    pages: [
      {
        heading: "Threads in a process",
        body: [
          "A thread is a basic unit of CPU use. Each thread has its own thread ID, program counter, registers and stack.",
          "Threads of the same process share its code, data (globals), heap and open files, so they can work on the same data without any IPC.",
        ],
        diagram: "threads",
      },
      {
        heading: "Why threads",
        body: [
          "Threads keep an app responsive (one thread blocks while another serves the user), share resources for free, are cheaper to create and switch than processes, and can run in parallel on a multicore CPU.",
          "Concurrency means more than one task makes progress; parallelism means more than one task runs at the same instant, which needs more than one core.",
        ],
      },
      {
        heading: "User and kernel threads",
        body: [
          "User threads are managed by a library in user space; kernel threads are managed by the OS. A model maps one onto the other.",
          "Many-to-one: all user threads share one kernel thread, so one blocking call blocks them all and they can't run in parallel. One-to-one: each user thread gets a kernel thread (Linux, Windows). Many-to-many: many user threads share a smaller or equal number of kernel threads.",
        ],
      },
    ],
    check: {
      id: "lesson-threads",
      kind: "multi",
      prompt: "Which of these does each thread have its own copy of? Select all.",
      options: ["Registers", "Stack", "Heap", "Global variables", "Program counter", "Open files"],
      answers: [0, 1, 4],
      explain: "Each thread has its own registers, stack and program counter. The heap, globals and open files belong to the process and are shared by its threads.",
      move: PMOVE,
    },
  },
  {
    id: "processes-ipc",
    gym: "processes",
    title: "Interprocess communication",
    pages: [
      {
        heading: "Two models",
        body: [
          "Cooperating processes exchange data through interprocess communication (IPC). There are two models.",
          "Shared memory: system calls set up a region both processes map, then they read and write it at memory speed with no kernel help, but they must synchronise themselves. Message passing: `send()` and `receive()` go through the kernel; it is simpler and works across machines, but every message is a system call.",
        ],
        diagram: "ipc",
      },
      {
        heading: "Message passing choices",
        body: [
          "Communication is direct (name the other process) or indirect (through a mailbox or port).",
          "Send and receive can each be blocking (synchronous) or non-blocking (asynchronous). When both block, it is a rendezvous. The link's buffer has zero, bounded or unbounded capacity.",
        ],
      },
      {
        heading: "Pipes",
        body: [
          "An ordinary pipe, `pipe(fd)`, is one-way: write to `fd[1]`, read from `fd[0]`. It only links related processes, such as a parent and a child that inherits it, and is gone when they are. The shell's `ls | wc` is one.",
          "A named pipe (a FIFO, made with `mkfifo`) has a name in the file system, so unrelated processes can use it, and it lasts until it is deleted.",
        ],
      },
    ],
    check: {
      id: "lesson-ipc",
      prompt: "Two processes on one machine exchange large amounts of data many times a second. Which IPC model is usually faster?",
      options: ["Message passing through the kernel", "Shared memory", "A file on disk", "They are always equally fast"],
      answer: 1,
      explain: "Once the region is set up, shared-memory reads and writes need no system calls. Message passing pays a trip into the kernel for every message.",
      move: PMOVE,
    },
  },
  {
    id: "scheduling-fcfs",
    gym: "scheduling",
    title: "Criteria and FCFS",
    pages: [
      {
        heading: "Who runs next?",
        body: [
          "Processes alternate CPU bursts with I/O bursts. Whenever the CPU goes idle, the CPU scheduler picks a process from the ready queue, and the dispatcher hands it the CPU.",
          "A scheduling decision can happen when a process (1) switches from running to waiting, (2) is interrupted from running back to ready, (3) finishes I/O and becomes ready, or (4) terminates. A non-preemptive (cooperative) scheduler only decides at 1 and 4; a preemptive one can also take the CPU away at 2 and 3.",
        ],
      },
      {
        heading: "Criteria",
        body: [
          "Schedulers are judged on CPU utilisation (keep it busy) and throughput (processes finished per unit of time), which we want high, and on turnaround, waiting and response time, which we want low.",
          "Turnaround = completion − arrival. Waiting = turnaround − burst: the time spent in the ready queue. Response = first run − arrival: how long before a process first gets the CPU.",
        ],
      },
      {
        heading: "First come, first served",
        body: [
          "FCFS runs processes in arrival order, each to the end of its burst. It is a simple FIFO queue and non-preemptive.",
          "Its average waiting time depends on the order. With bursts 24, 3 and 3, running the 24 first makes the others wait 24 and 27: an average of 17 ms. Running it last gives 3 ms. Short jobs stuck behind a long one is the convoy effect.",
        ],
        diagram: "fcfs",
      },
    ],
    check: {
      id: "lesson-fcfs",
      kind: "multi",
      prompt: "Which scheduling criteria should be as HIGH as possible? Select all.",
      options: ["CPU utilisation", "Throughput", "Turnaround time", "Waiting time", "Response time"],
      answers: [0, 1],
      explain: "We want to maximise CPU utilisation and throughput, and minimise turnaround, waiting and response time.",
      move: SMOVE,
    },
  },
  {
    id: "scheduling-sjf",
    gym: "scheduling",
    title: "SJF and SRTF",
    pages: [
      {
        heading: "Shortest job first",
        body: [
          "SJF gives the CPU to the process with the shortest next CPU burst; ties go first come, first served. Moving a short job ahead of a long one cuts the short job's wait by more than it adds to the long one's.",
          "For a given set of processes, SJF gives the minimum average waiting time. With bursts 6, 8, 7 and 3 all at time 0 it runs 3, 6, 7, 8 for an average wait of 7 ms (FCFS would give 10.25).",
        ],
        diagram: "sjf",
      },
      {
        heading: "Preemptive SJF: SRTF",
        body: [
          "Shortest-remaining-time-first is the preemptive version: when a new process arrives with a shorter burst than what the running process has left, it takes the CPU.",
          "With P1 (8) at 0, P2 (4) at 1, P3 (9) at 2 and P4 (5) at 3, P2 preempts P1 at time 1. The chart is P1, P2, P4, P1, P3 and the average wait is 6.5 ms, against 7.75 for non-preemptive SJF.",
        ],
      },
      {
        heading: "The catch",
        body: [
          "The scheduler can't know the next CPU burst. It predicts one with an exponential average of past bursts: τₙ₊₁ = α·tₙ + (1 − α)·τₙ, often with α = 1/2.",
          "Long jobs can also starve if short ones keep arriving.",
        ],
      },
    ],
    check: {
      id: "lesson-sjf",
      kind: "numeric",
      prompt: "All four arrive at time 0. What is the average waiting time under SJF (ms)?",
      code: table(SJF_CHECK_JOBS),
      answer: SJF_CHECK.avgWaiting,
      unit: "ms",
      explain: `SJF runs P3, P2, P4, P1 (P2 and P4 tie at 4, so FCFS order puts P2 first). Waits: ${SJF_CHECK_JOBS.map((j, i) => `${j.name} ${SJF_CHECK.waiting[i]}`).join(", ")}. Average = ${SJF_CHECK.waiting.reduce((a, b) => a + b, 0)}/4 = ${SJF_CHECK.avgWaiting} ms.`,
      gantt: SJF_CHECK.gantt,
      move: SMOVE,
    },
  },
  {
    id: "scheduling-priority",
    gym: "scheduling",
    title: "Priority and aging",
    pages: [
      {
        heading: "Priority scheduling",
        body: [
          "Each process gets a priority and the CPU goes to the highest. Here, as in Silberschatz, a lower number means a higher priority (some systems use the opposite). Equal priorities are FCFS.",
          "SJF is a special case: the priority is the predicted next burst. Priority scheduling can be preemptive (a higher-priority arrival takes the CPU) or non-preemptive (it goes to the head of the queue).",
        ],
        diagram: "priority",
      },
      {
        heading: "Starvation",
        body: [
          "A low-priority process can wait forever while higher-priority work keeps arriving. This is starvation, or indefinite blocking. Legend has it that when MIT shut down its IBM 7094 in 1973 they found a low-priority job submitted in 1967 that had never run.",
        ],
      },
      {
        heading: "Aging",
        body: [
          "The fix is aging: a process's priority rises the longer it waits. In the diagram, L's priority number drops by 1 each tick it waits, so after 4 ticks it can run instead of waiting behind H2.",
          "Another fix combines priority with Round Robin: processes of equal priority take turns.",
        ],
      },
    ],
    check: {
      id: "lesson-priority",
      prompt: "Low-priority processes never get the CPU because higher-priority ones keep arriving. Which technique fixes this?",
      options: ["The convoy effect", "Aging", "A bigger time quantum", "Shortest job first"],
      answer: 1,
      explain: "Aging gradually raises the priority of processes that wait a long time, so they eventually run. SJF and the convoy effect don't help: SJF can starve long jobs too.",
      move: SMOVE,
    },
  },
  {
    id: "scheduling-rr",
    gym: "scheduling",
    title: "Round Robin and the quantum",
    pages: [
      {
        heading: "Taking turns",
        body: [
          "Round Robin is FCFS with preemption: each process runs for at most one time quantum (typically 10 to 100 ms), then a timer interrupt sends it to the back of the ready queue. A process with less left than a quantum gives up the CPU when it finishes.",
          "With n processes and quantum q, no process waits more than (n − 1)·q before its next turn, so response time is good.",
        ],
      },
      {
        heading: "Choosing the quantum",
        body: [
          "With bursts 24, 3 and 3 and q = 4 the chart is P1, P2, P3, then P1 to the end: average wait 17/3 ≈ 5.67 ms. The average wait under RR is often long, but no one waits long for a first turn.",
          "If q is huge, RR becomes FCFS. If q is tiny, the CPU spends its time on context switches. A rule of thumb: about 80% of CPU bursts should be shorter than q, and q should be large next to the context-switch time.",
        ],
        diagram: "rr",
      },
    ],
    check: {
      id: "lesson-rr",
      kind: "numeric",
      prompt: "Round Robin with a 2 ms quantum; all arrive at 0 in the order P1, P2, P3. At what time does P1 finish?",
      code: table(RR_CHECK_JOBS),
      answer: RR_CHECK.completion[0],
      unit: "ms",
      explain: `The chart is ${RR_CHECK.gantt.map((b) => `${b.name} ${b.start}–${b.end}`).join(", ")}. P3 finishes in its first turn and P2 in its second, so P1 runs its last 1 ms from 8 to 9.`,
      gantt: RR_CHECK.gantt,
      move: SMOVE,
    },
  },
  {
    id: "scheduling-mlfq",
    gym: "scheduling",
    title: "Multilevel feedback queues",
    pages: [
      {
        heading: "Several queues",
        body: [
          "A multilevel queue splits the ready queue by kind, such as real-time, system, interactive and batch, each with its own algorithm. Higher queues always go first.",
          "In a plain multilevel queue a process stays in its queue. A multilevel feedback queue (MLFQ) lets processes move between queues according to how they behave.",
        ],
      },
      {
        heading: "Feedback",
        body: [
          "In the classic example, a new process enters Q0 (quantum 8). If it uses its whole quantum it drops to Q1 (quantum 16), and then to Q2, which is FCFS. A process arriving in a higher queue preempts a lower one.",
          "Short and I/O-bound (interactive) processes finish or block inside their small quantum and stay on top. CPU-bound ones sink. Aging can move a process that waits too long back up, so nothing starves.",
        ],
        diagram: "mlfq",
      },
      {
        heading: "The most general scheduler",
        body: [
          "An MLFQ is defined by the number of queues, each queue's algorithm, when to promote and when to demote a process, and which queue a new process enters. Tuning it can make it fit almost any system, which makes it the most general and the most complex scheme.",
        ],
      },
    ],
    check: {
      id: "lesson-mlfq",
      prompt: "Which processes does a multilevel feedback queue favour by keeping them in the top queues?",
      options: ["Long CPU-bound processes", "Short or I/O-bound processes", "Whichever process arrived first", "Processes with the most memory"],
      answer: 1,
      explain: "A process that uses up its quantum is CPU-bound and gets demoted. Short and I/O-bound processes give up the CPU before their quantum ends, so they stay in the high-priority queues and get quick response.",
      move: SMOVE,
    },
  },
  {
    id: "sync-race",
    gym: "sync",
    title: "Race conditions",
    pages: [
      {
        heading: "counter++ is three steps",
        body: [
          "`counter++` looks like one step, but the machine does it as three: load counter into a register, add 1 to the register, store the register back. `counter--` is the same with a subtract.",
          "A producer and a consumer share `counter`, which is 5. Each changes it once, so it should end at 5. If the scheduler switches between them halfway through, one update overwrites the other and counter ends at 4 or 6.",
        ],
        diagram: "race",
      },
      {
        heading: "You are the scheduler",
        body: [
          "Tap ▶ STEP under a thread to run its next step. Its register changes on a load or an add; `counter` only changes when a thread stores.",
          "Find all three endings: 5 (one thread finishes before the other starts), 4 and 6. Whenever both load before either stores, the store that lands last overwrites the other: a lost update.",
        ],
        play: "race",
      },
      {
        heading: "Race conditions",
        body: [
          "A race condition is when several threads use shared data at the same time and the result depends on the order their steps happen to run in. The bug shows up rarely, is hard to reproduce, and can vanish when you add a print or a debugger.",
          "The kernel has races too. If two processes call `fork()` at the same moment, both could be given the same next free pid unless the kernel protects that variable.",
        ],
      },
      {
        heading: "The critical-section problem",
        body: [
          "The code that uses shared data is a critical section. A process asks to enter it in an entry section, leaves through an exit section, and the rest of its code is the remainder section.",
          "A solution must give mutual exclusion (at most one process in its critical section at a time), progress (when none is inside, only the processes trying to enter decide who goes next, and they can't put it off forever) and bounded waiting (others can only go ahead of a waiting process a limited number of times).",
        ],
      },
    ],
    check: {
      id: "lesson-race",
      kind: "interleave",
      prompt: "counter is 5. The producer runs counter++ and the consumer runs counter--. You are the scheduler: pick an order of their steps that leaves counter at 6.",
      threads: RACE_THREADS,
      init: { counter: 5 },
      goal: { v: "counter", value: 6 },
      answer: RACE_CHECK_ANSWER,
      explain: "To end at 6 the consumer's update must be lost: the producer loads 5 before the consumer stores 4, then stores its 6 last, overwriting the 4. Running one thread after the other always gives 5.",
      move: YMOVE,
    },
  },
  {
    id: "sync-peterson",
    gym: "sync",
    title: "Peterson's solution",
    pages: [
      {
        heading: "Two flags and a turn",
        body: [
          "Peterson's solution handles two processes, P0 and P1. They share `flag[2]`, where `flag[i] = true` means Pi wants to enter, and `turn`, which says who goes first if both want in.",
          "To enter, Pi raises its flag, then gives the turn to the other (`turn = j`), and waits while the other wants in and it is the other's turn. On the way out it lowers its flag.",
        ],
        diagram: "peterson",
      },
      {
        heading: "Why it works",
        body: [
          "If both want in, both flags are up and `turn` decides. It holds whichever value was written last, so the process that wrote it last is the one that waits. Only one gets through: mutual exclusion.",
          "If the other process doesn't want in, its flag is down and Pi goes straight in (progress). If both want in, Pi waits for at most one entry by the other (bounded waiting).",
        ],
      },
      {
        heading: "Hardware help",
        body: [
          "Modern processors and compilers can reorder reads and writes that don't depend on each other, which can let both processes in, so Peterson's solution isn't guaranteed to work on modern hardware.",
          "Real systems use hardware support instead: memory barriers, and atomic instructions such as `test_and_set()` and `compare_and_swap()`, which read and change a word in one step that can't be interrupted.",
        ],
      },
    ],
    check: {
      id: "lesson-peterson",
      prompt: "In Peterson's solution both processes want to enter. P0 sets turn = 1, and then P1 sets turn = 0. Which process enters its critical section first?",
      options: ["P0", "P1", "Both at once", "Neither: they wait forever"],
      answer: 0,
      explain: "P1 wrote turn last, so turn = 0. P1 waits while flag[0] is up and turn is 0; P0's loop condition (turn == 1) is false, so P0 enters. When P0 lowers its flag, P1 goes in.",
      move: YMOVE,
    },
  },
  {
    id: "sync-semaphores",
    gym: "sync",
    title: "Mutex locks and semaphores",
    pages: [
      {
        heading: "Mutex locks",
        body: [
          "A mutex lock protects a critical section: call `acquire()` before it and `release()` after. A thread that calls acquire() while the lock is held has to wait.",
          "If it waits by looping, the lock is a spinlock (busy waiting). Spinning wastes CPU time but avoids a context switch, so spinlocks suit short critical sections on multicore systems.",
        ],
      },
      {
        heading: "Semaphores",
        body: [
          "A semaphore S is an integer used only through two atomic operations, `wait()` (P) and `signal()` (V). In the blocking version, wait() takes 1 off S and, if S is now negative, puts the caller to sleep on S's queue. signal() adds 1 and, if anyone is waiting, wakes one of them.",
          "A counting semaphore starts at the number of free resources. When it is negative, its size is the number of waiting processes. A binary semaphore (0 or 1) works like a mutex.",
        ],
        diagram: "semaphore",
      },
      {
        heading: "Mutex or semaphore?",
        body: [
          "A mutex has an owner: the thread that locked it must unlock it. A semaphore has no owner, so one thread can signal() a semaphore another thread waits on.",
          "That makes semaphores good for ordering. Start `synch` at 0. P1 runs S1 then `signal(synch)`; P2 runs `wait(synch)` then S2. S2 can only run after S1.",
        ],
      },
    ],
    check: {
      id: "lesson-semaphores",
      kind: "numeric",
      prompt: "Semaphore S starts at 2. Five processes call wait(S) one after another and nobody calls signal(S). How many of them are blocked?",
      answer: SEM_CHECK.blocked.length,
      explain: `Each wait() takes 1 off S: 1, 0, −1, −2, −3. The first two find S still ≥ 0 and go on; the other ${SEM_CHECK.blocked.length} block. S ends at ${SEM_CHECK.value}, and its size is the number waiting.`,
      move: YMOVE,
    },
  },
  {
    id: "sync-monitors",
    gym: "sync",
    title: "Monitors",
    pages: [
      {
        heading: "Monitors",
        body: [
          "Semaphores are easy to misuse. Swap a wait() and a signal() and two processes can be in the critical section together; leave one out and processes can block forever.",
          "A monitor is a language construct that bundles shared data with the procedures that use it, and only one thread can be active inside it at a time. Java's `synchronized` methods work this way.",
        ],
        diagram: "monitor",
      },
      {
        heading: "Condition variables",
        body: [
          "Inside a monitor a thread can wait for a condition: `x.wait()` suspends it and lets another thread in, and `x.signal()` resumes exactly one thread waiting on x. If none is waiting, signal() does nothing, unlike a semaphore's signal(), which always changes its value.",
          "When P signals Q, one of them must wait: signal-and-wait (P waits for Q to leave) or signal-and-continue (Q waits for P to leave). Java and Pthreads use signal-and-continue, so a woken thread re-checks its condition in a `while` loop.",
        ],
      },
      {
        heading: "Liveness",
        body: [
          "Deadlock: every process in a set waits for something only another process in the set can do. Starvation: a process waits forever while others keep going.",
          "Priority inversion: a low-priority task holds a lock a high-priority task needs, and medium-priority tasks keep preempting it. Priority inheritance fixes it by running the lock holder at the waiter's priority until it releases the lock. The Mars Pathfinder lander hit this bug in 1997.",
        ],
      },
    ],
    check: {
      id: "lesson-monitors",
      prompt: "A thread calls x.signal() on a monitor condition variable when no thread is waiting on x. What happens?",
      options: ["Nothing: the signal has no effect", "x's count goes up by 1, like a semaphore", "The calling thread blocks", "The next x.wait() returns at once"],
      answer: 0,
      explain: "A condition variable has no value to remember a signal in. With no waiter, x.signal() has no effect, and a later x.wait() still blocks. A semaphore's signal() would add 1 and be remembered.",
      move: YMOVE,
    },
  },
  {
    id: "sync-classic",
    gym: "sync",
    title: "Classic problems",
    pages: [
      {
        heading: "The bounded buffer",
        body: [
          "Producers and consumers share a buffer of n slots, guarded by three semaphores: `mutex` = 1 protects the buffer, `empty` = n counts free slots, and `full` = 0 counts filled ones.",
          "The producer runs wait(empty), wait(mutex), adds its item, signal(mutex), signal(full). The consumer does the reverse: wait(full), wait(mutex), takes an item, signal(mutex), signal(empty). If the producer's two waits are swapped, it can sleep on a full buffer while holding mutex, so no consumer can get in: deadlock.",
        ],
      },
      {
        heading: "Readers and writers",
        body: [
          "Any number of readers may read shared data at once, but a writer needs it to itself.",
          "In the first readers–writers problem, no reader waits unless a writer already has the data, so writers can starve. The second gives a waiting writer priority, so readers can starve. Reader–writer locks offer both a read mode and a write mode.",
        ],
      },
      {
        heading: "Dining philosophers",
        body: [
          "Five philosophers sit round a table with one chopstick between each pair. To eat, a philosopher needs both neighbouring chopsticks. If all five pick up their left chopstick at once, nobody can get a right one: deadlock.",
          "Fixes: let at most four sit at the table, pick up both chopsticks only when both are free, or have odd philosophers pick up the left first and even ones the right first. A deadlock-free solution can still starve someone.",
        ],
        diagram: "philosophers",
      },
    ],
    check: {
      id: "lesson-classic",
      kind: "order",
      prompt: "Put a producer's steps for adding one item to the bounded buffer in order.",
      steps: ["wait(empty)", "wait(mutex)", "Add the item to the buffer", "signal(mutex)", "signal(full)"],
      explain: "Wait for a free slot first, then lock the buffer, add the item, unlock, and signal that a slot is full. Locking before waiting for a slot can deadlock.",
      move: YMOVE,
    },
  },
  {
    id: "deadlocks-coffman",
    gym: "deadlocks",
    title: "Coffman conditions",
    pages: [
      {
        heading: "What a deadlock is",
        body: [
          "A deadlock is a set of processes in which every process waits for a resource held by another process in the set. None can run, so none will ever release anything.",
          "Example: thread 1 locks mutex A then asks for B, while thread 2 locks B then asks for A. If each gets its first lock before the other asks for a second, both sleep forever.",
        ],
      },
      {
        heading: "Four conditions, all at once",
        body: [
          "A deadlock can happen only if all four Coffman conditions hold together: mutual exclusion (a resource is used by one process at a time), hold and wait (a process holds some resources while waiting for more), no preemption (a resource is released only by the process holding it) and circular wait (P0 waits for P1, P1 for P2, ... Pn for P0).",
          "The four are necessary, not sufficient: having all of them doesn't guarantee a deadlock, but breaking any one makes a deadlock impossible. That is the idea behind prevention.",
        ],
        diagram: "rag",
      },
    ],
    check: {
      id: "lesson-coffman",
      prompt: "P1 holds the printer and waits for the scanner. P2 holds the scanner and waits for the printer. Which Coffman condition does this pattern show best?",
      options: ["Circular wait", "Mutual exclusion", "Preemption", "Starvation"],
      answer: 0,
      explain: "P1 waits for P2 and P2 waits for P1: a circular chain of waits. (Hold and wait and mutual exclusion are also true here, but the circle is what the pattern shows. Preemption would break the deadlock, not show it.)",
      move: YMOVE,
    },
  },
  {
    id: "deadlocks-rag",
    gym: "deadlocks",
    title: "Resource-allocation graphs",
    pages: [
      {
        heading: "Drawing the system",
        body: [
          "A resource-allocation graph has a node for each process (a circle) and each resource type (a box, with a dot per instance). A request edge P → R means P waits for an instance of R. An assignment edge R → P means an instance of R is held by P.",
          "A request edge turns into an assignment edge when the instance is granted, and back again when it is released.",
        ],
        diagram: "rag",
      },
      {
        heading: "Try it: spot the cycle",
        body: [
          "Follow the arrows: red ones are requests, green ones are assignments. Tap the nodes that form a cycle. P3 waits for R1 too, but it isn't in the cycle, so it is blocked by the deadlock without being part of it.",
        ],
        play: "rag",
      },
      {
        heading: "Cycles",
        body: [
          "If the graph has no cycle, nothing is deadlocked. If every resource has a single instance, a cycle means deadlock: it is necessary and sufficient.",
          "If resources have several instances, a cycle is necessary but not sufficient: a process outside the cycle may hold a spare instance and release it, breaking the wait. So with several instances a cycle only means a deadlock is possible.",
        ],
      },
    ],
    check: {
      id: "lesson-rag",
      prompt: "A graph has edges P1 → R1, R1 → P2 and P2 → R2. R1 and R2 have one instance each, and R2 is held by nobody. Is there a deadlock?",
      options: ["No: there is no cycle, and P2 will get R2", "Yes: P1, P2 and R1 form a cycle", "Yes: P1 is starved", "Only if R2 has two instances"],
      answer: 0,
      explain: "Following the edges P1 → R1 → P2 → R2 ends at R2, which is free, so there is no cycle. P2 gets R2, finishes and releases R1, and then P1 gets it.",
      move: YMOVE,
    },
  },
  {
    id: "deadlocks-prevention",
    gym: "deadlocks",
    title: "Prevention and avoidance",
    pages: [
      {
        heading: "Prevention: break one condition",
        body: [
          "Mutual exclusion can't usually be broken (a mutex or a printer is non-sharable by nature), but read-only files can be shared. Hold and wait is broken by requesting every resource at the start, or by releasing what you hold before asking for more; it costs utilization and can cause starvation.",
          "No preemption is broken by taking resources from a waiting process, which suits resources whose state can be saved, such as CPU registers and memory, but not locks. Circular wait is broken by numbering the resources and requiring requests in increasing order. This is the lock-ordering rule used in real code, and the easiest one to apply.",
        ],
      },
      {
        heading: "Avoidance: stay in safe states",
        body: [
          "Avoidance needs advance information, usually each process's maximum demand. The system grants a request only if the state afterwards is safe: there is some order in which every process can finish even if each asks for its full maximum.",
          "A safe state is never deadlocked. An unsafe state isn't a deadlock yet, but it may lead to one, so avoidance keeps the system out of unsafe states. For single-instance resources a graph with claim edges does the job; with several instances the Banker's algorithm is used.",
        ],
      },
    ],
    check: {
      id: "lesson-prevention",
      prompt: "Every thread must take locks in increasing order of lock number. Which Coffman condition does this rule break?",
      options: ["Circular wait", "Hold and wait", "Mutual exclusion", "No preemption"],
      answer: 0,
      explain: "A cycle of waits would need some thread holding a higher-numbered lock while waiting for a lower-numbered one, which the rule forbids. Threads still hold locks while waiting, and the locks are still exclusive.",
      move: YMOVE,
    },
  },
  {
    id: "deadlocks-banker",
    gym: "deadlocks",
    title: "The Banker's algorithm",
    pages: [
      {
        heading: "The tables",
        body: [
          "For n processes and m resource types the banker keeps Available (free instances of each type), Max (the most each process may ask for), Allocation (what each holds now) and Need = Max − Allocation.",
          "In Silberschatz's example, A, B and C have 10, 5 and 7 instances, Available is (3, 3, 2), and P0's Need is (7, 4, 3).",
        ],
        diagram: "banker",
      },
      {
        heading: "Try it: find a safe sequence",
        body: [
          "Tap the processes in the order they could finish. Work starts at Available; a process can go when its Need fits in Work, and it hands back its Allocation when it's done. Tap one too early and the board turns it red.",
          "Many orders work. The book's circular scan happens to find <P1, P3, P4, P0, P2>.",
        ],
        play: "banker",
      },
      {
        heading: "Safety and requests",
        body: [
          "Safety algorithm: start with Work = Available. Find a process that isn't finished and whose Need ≤ Work; pretend it runs to the end and returns its Allocation (Work += Allocation). Repeat. If everyone can finish, the order is a safe sequence and the state is safe.",
          "Request algorithm: if the request exceeds the process's Need, that is an error; if it exceeds Available, the process waits. Otherwise pretend to grant it, and run the safety algorithm. Grant the request only if the new state is safe. In the example P1's request (1, 0, 2) is granted, but P0's (0, 2, 0) afterwards would be unsafe.",
        ],
      },
    ],
    check: {
      id: "lesson-banker",
      kind: "banker",
      prompt: "Using the example tables (Available = 3 3 2), tap the processes in an order that is a safe sequence.",
      resources: ["A", "B", "C"],
      state: BANKER_EXAMPLE,
      answer: safety(BANKER_EXAMPLE).sequence,
      explain: `Work starts at 3 3 2. P1 needs 1 2 2, so it can finish and Work becomes 5 3 2. Then P3 (needs 0 1 1) finishes, giving 7 4 3; P4 (4 3 1) gives 7 4 5; P0 (7 4 3) gives 7 5 5; and finally P2 (6 0 0) gives 10 5 7. Other safe orders exist, but an order that starts with P0 or P2 fails: their Need doesn't fit in the free resources.`,
      move: YMOVE,
    },
  },
  {
    id: "deadlocks-recovery",
    gym: "deadlocks",
    title: "Detection and recovery",
    pages: [
      {
        heading: "Detect it",
        body: [
          "If a system neither prevents nor avoids deadlock, it needs a detection algorithm and a way to recover. With single-instance resources, keep a wait-for graph (the allocation graph with the resource nodes removed) and look for a cycle, which costs O(n²).",
          "With several instances use a version of the Banker's algorithm that uses each process's current Request instead of its Need. A process that can't finish with the free resources is deadlocked. The cost is O(m × n²).",
        ],
      },
      {
        heading: "Recover",
        body: [
          "Terminate processes: abort all the deadlocked processes (certain, but expensive), or abort them one at a time until the cycle breaks, choosing by priority, run time so far, resources held and how many more it needs.",
          "Or preempt resources: pick a victim, roll it back to a safe state and restart it, and make sure the same process isn't always the victim, or it starves. Real systems, such as Unix and Windows, mostly leave deadlock to the programmer, since it is rare and the detection is costly. The ostrich algorithm is ignoring the problem.",
        ],
      },
    ],
    check: {
      id: "lesson-recovery",
      kind: "numeric",
      prompt: "Five processes share A = 7, B = 2, C = 6 and nothing is free. Silberschatz's detection example is safe, but now P2 requests one more instance of C. How many processes are deadlocked?",
      answer: DETECT_CHECK.length,
      explain: `P0 requests nothing, so it finishes and returns (0, 1, 0). That satisfies nobody: P1 wants (2, 0, 2), P2 (0, 0, 1), P3 (1, 0, 0) and P4 (0, 0, 2), and none of that is free. So ${DETECT_CHECK.length} processes (P1 to P4) are deadlocked and P0 isn't.`,
      move: YMOVE,
    },
  },
  {
    id: "memory-contiguous",
    gym: "memory",
    title: "Contiguous allocation and fragmentation",
    pages: [
      {
        heading: "One block per process",
        body: [
          "With contiguous allocation each process gets one unbroken block of memory. A relocation (base) register holds its first physical address and a limit register its length. The MMU checks every logical address against the limit, then adds the base, so one process can't touch another's memory.",
          "As processes come and go the free memory breaks into holes. The kernel keeps a list of them, and when a process of n bytes arrives it picks a hole by one of three rules: first fit (the first hole that is big enough), best fit (the smallest hole that is big enough) and worst fit (the largest hole). Whatever is left of the hole stays on the list.",
        ],
        diagram: "fit",
      },
      {
        heading: "Fragmentation",
        body: [
          "External fragmentation: enough memory is free in total, but it is scattered in holes that are each too small. First fit and best fit both suffer. Silberschatz's 50-percent rule says that for N allocated blocks about 0.5 N more are lost to fragmentation, so about a third of memory is unusable.",
          "The cure is compaction (slide every process together to make one big hole, only possible if addresses are relocated at run time) or non-contiguous allocation, which is why systems use paging. Internal fragmentation is the opposite waste: memory that is allocated but unused inside the block, such as the tail of a process's last page.",
        ],
        diagram: "frag",
      },
    ],
    check: {
      id: "lesson-contiguous",
      kind: "numeric",
      prompt: "Free holes, in address order: 100K, 500K, 200K, 300K and 600K. A process of 212K arrives and the system uses best fit. How big, in K, is the hole left over?",
      answer: BEST_LEFT,
      explain: `Best fit picks the smallest hole that is big enough: 300K (100K and 200K are too small). 300 − 212 = ${BEST_LEFT}K stays on the free list. First fit would take the 500K hole (leaving 288K) and worst fit the 600K one (leaving 388K).`,
      move: MMOVE,
    },
  },
  {
    id: "memory-paging",
    gym: "memory",
    title: "Paging and address translation",
    pages: [
      {
        heading: "Pages and frames",
        body: [
          "Paging cuts the logical address space into fixed-size pages and physical memory into frames of the same size, so any page can sit in any frame and external fragmentation disappears. A page table, one per process, maps each page number to a frame number.",
          "The page size is a power of two, so the hardware splits an address without dividing: the high bits are the page number p and the low bits the offset d. Physical address = frame × page size + offset.",
        ],
        diagram: "paging",
      },
      {
        heading: "Working a translation",
        body: [
          "Silberschatz's Figure 9.10 has 4-byte pages and a page table of 5, 6, 1, 2. Logical address 13 is page 13 ÷ 4 = 3 with offset 13 mod 4 = 1. Page 3 lives in frame 2, so the physical address is 2 × 4 + 1 = 9.",
          "Paging has internal fragmentation, but only in a process's last page: a 72,766-byte process with 2,048-byte pages needs 36 pages and wastes 962 bytes, half a page on average. Bigger pages waste more but need smaller page tables. If a page's entry is marked invalid the access traps to the kernel.",
        ],
      },
    ],
    check: {
      id: "lesson-paging",
      kind: "numeric",
      prompt: "Pages are 4 bytes and the page table maps pages 0, 1, 2, 3 to frames 5, 6, 1, 2. Which physical address does logical address 6 map to?",
      answer: PAGING_CHECK.physical!,
      explain: `Address 6 is page ${PAGING_CHECK.page} (6 ÷ 4) with offset ${PAGING_CHECK.offset} (6 mod 4). Page 1 is in frame ${PAGING_CHECK.frame}, so the physical address is ${PAGING_CHECK.frame} × 4 + ${PAGING_CHECK.offset} = ${PAGING_CHECK.physical}.`,
      move: MMOVE,
    },
  },
  {
    id: "memory-tables",
    gym: "memory",
    title: "Page-table structures",
    pages: [
      {
        heading: "Tables that fit in memory",
        body: [
          "A 32-bit address space with 4 KB pages has 2²⁰ pages. With 4-byte entries a flat page table is 4 MB per process, too big to keep in one contiguous run. Hierarchical paging pages the page table itself: a two-level scheme splits the address 10 + 10 + 12 bits, an outer index, an inner index and the offset, and only the inner tables that are in use need to exist.",
          "For 64-bit addresses even that is too deep, so hashed page tables (the page number hashes to a chain of entries) and inverted page tables are used.",
        ],
        diagram: "ptable",
      },
      {
        heading: "Inverted page tables",
        body: [
          "An inverted page table has one entry per physical frame, holding the (process id, page number) that occupies it. The table's size follows physical memory, not the number of processes, so memory is saved.",
          "The price is lookup time. The entry's index is the frame number, but you have to search for the (pid, page) pair, so a hash table sits in front of it. Shared pages are also harder, because each frame names only one owner.",
        ],
      },
    ],
    check: {
      id: "lesson-tables",
      kind: "numeric",
      prompt: "A system has 32-bit logical addresses, 4 KB pages and 4-byte page-table entries. How many MB is a single-level page table for one process?",
      answer: FLAT_TABLE_MB,
      explain: `There are 2³² ÷ 2¹² = 2²⁰ pages, and at 4 bytes each that is 2²² bytes = ${FLAT_TABLE_MB} MB. A two-level table avoids keeping all of it: the outer table has 2¹⁰ entries and each inner table fills exactly one 4 KB page.`,
      move: MMOVE,
    },
  },
  {
    id: "memory-tlb",
    gym: "memory",
    title: "The TLB and effective access time",
    pages: [
      {
        heading: "Caching translations",
        body: [
          "Every memory reference would need two accesses with a one-level table: one for the page-table entry and one for the data. The translation look-aside buffer (TLB) is a small, fast associative cache of page → frame entries, searched in parallel.",
          "On a TLB hit the frame number is available at once. On a miss the hardware or the OS walks the page table in memory (one access per level), then loads the entry into the TLB. A context switch flushes the TLB unless its entries carry an address-space id (ASID).",
        ],
        diagram: "tlb",
      },
      {
        heading: "Effective access time",
        body: [
          "EAT = hit ratio × (TLB time + memory time) + (1 − hit ratio) × (TLB time + memory time × (levels + 1)). In Silberschatz's example a TLB search takes 20 ns, memory 100 ns and the hit ratio is 80%: EAT = 0.80 × 120 + 0.20 × 220 = 140 ns, a 40% slowdown. At 98% it is 122 ns.",
          "Some books ignore the TLB search time, or count a miss as just one extra memory access; read the exam's assumptions. The hit ratio is high in practice because programs are local: they reuse the same few pages.",
        ],
      },
    ],
    check: {
      id: "lesson-tlb",
      kind: "numeric",
      prompt: "A TLB lookup takes 10 ns, a memory access 100 ns, the page table has one level and the hit ratio is 90%. What is the effective access time in ns?",
      answer: TLB_CHECK,
      explain: `A hit costs 10 + 100 = 110 ns and a miss costs 10 + 100 + 100 = 210 ns. EAT = 0.9 × 110 + 0.1 × 210 = 99 + 21 = ${TLB_CHECK} ns.`,
      move: MMOVE,
    },
  },
  {
    id: "memory-segments",
    gym: "memory",
    title: "Segmentation",
    pages: [
      {
        heading: "The programmer's view",
        body: [
          "Segmentation divides a program into logical units: the code, the heap, the stack, each library. A logical address is a pair (segment, offset). The segment table has a base (where the segment starts in physical memory) and a limit (its length) for each segment.",
          "The hardware compares the offset with the limit. If offset ≥ limit it traps to the OS; otherwise the physical address is base + offset. Segments vary in size, so segmentation brings back external fragmentation, while paging avoids it.",
        ],
        diagram: "segments",
      },
      {
        heading: "Paging against segmentation",
        body: [
          "Paging is invisible to the programmer, uses fixed-size units and has no external fragmentation, only a little internal. Segmentation is visible, with variable-size units that match what the program means, so sharing and protecting a whole code or library segment is natural.",
          "Real systems combine them. Intel IA-32 translated a (selector, offset) logical address through a segment table into a linear address, which was then paged. Most 64-bit systems now use paging almost alone.",
        ],
      },
    ],
    check: {
      id: "lesson-segments",
      prompt: "Segment 1 has base 6300 and limit 400. What happens when a program references segment 1, offset 400?",
      options: ["A trap: the offset is beyond the limit", "It reads physical address 6700", "It reads physical address 6699", "It wraps round to offset 0"],
      answer: SEGMENT_CHECK ? 0 : 1,
      explain: "Valid offsets are 0 to 399, because the offset must be less than the limit. Offset 399 maps to 6300 + 399 = 6699, but offset 400 would be 6700, which lies outside the segment, so the hardware traps to the OS.",
      move: MMOVE,
    },
  },
  {
    id: "virtual-demand",
    gym: "virtual",
    title: "Demand paging and page faults",
    pages: [
      {
        heading: "Load only what is used",
        body: [
          "Virtual memory lets a process run without all of it in RAM. With demand paging a page is brought in only when it is first touched. Each page-table entry has a valid bit: 1 means the page is in a frame, 0 means it is on disk (or not mapped at all).",
          "Touching a page whose bit is 0 raises a page-fault trap. This is not an error, just a request for service: the OS checks the access was legal, finds a free frame, reads the page from the swap area on disk, sets the entry valid and restarts the instruction that faulted.",
        ],
        diagram: "demand",
      },
      {
        heading: "The cost of a fault",
        body: [
          "A fault is slow because of the disk: about 8 ms, against 200 ns for a memory access. With fault rate p, EAT = (1 − p) × memory time + p × fault service time. In Silberschatz's example, p = 1/1000 gives 8,199.8 ns, a slowdown by a factor of 40.",
          "To keep the slowdown under 10% (220 ns) the fault rate must be below about 1 in 399,990. Demand paging only works because of locality of reference: programs keep reusing a few pages, so faults are rare. Copy-on-write uses the same trap after fork(): parent and child share pages marked read-only, and a write faults to copy that one page.",
        ],
      },
    ],
    check: {
      id: "lesson-demand",
      kind: "numeric",
      prompt: "A memory access takes 200 ns and servicing a page fault takes 8 ms (8,000,000 ns). One access in 2,000 faults (p = 0.0005). What is the effective access time in ns?",
      answer: DEMAND_CHECK,
      tolerance: 0.1,
      explain: `EAT = (1 − 0.0005) × 200 + 0.0005 × 8,000,000 = 199.9 + 4,000 = ${DEMAND_CHECK} ns. The rare faults cost twenty times more than all the hits.`,
      move: VMOVE,
    },
  },
  {
    id: "virtual-replace",
    gym: "virtual",
    title: "Page replacement",
    pages: [
      {
        heading: "Choosing a victim",
        body: [
          "When a fault finds no free frame the OS must evict a page: the victim. If it was modified (the dirty bit is set) it is written back to disk first; a clean page is simply dropped. The aim is the fewest faults over a reference string.",
          "FIFO evicts the oldest page, which is easy but may throw out a page in constant use. Optimal evicts the page that will be used furthest in the future: the best possible, but it needs to know the future, so it is only a yardstick. LRU evicts the page unused for longest, a good guess at Optimal.",
        ],
        diagram: "replace",
      },
      {
        heading: "Approximating LRU",
        body: [
          "True LRU needs a timestamp or a stack updated on every reference, which is too slow in hardware, so systems use a reference bit that the hardware sets whenever a page is used.",
          "The second-chance (clock) algorithm keeps the frames in a circle with a hand. The hand looks at the next page: if its reference bit is 1 it clears the bit and moves on; if it is 0 that page is the victim. Pages in use keep getting their second chance. On Silberschatz's 20-reference string with 3 frames, FIFO has 15 faults, LRU 12 and Optimal 9.",
        ],
      },
    ],
    check: {
      id: "lesson-replace",
      kind: "numeric",
      prompt: "Reference string 1, 2, 3, 1, 4, 2, 1, 5 with 3 empty frames and LRU replacement. How many page faults?",
      answer: LRU_CHECK,
      explain: "Faults on 1, 2 and 3 fill the frames; the second 1 hits. 4 faults and evicts 2 (least recently used). 2 faults and evicts 3. 1 hits. 5 faults and evicts 4. That is faults on 1, 2, 3, 4, 2 and 5.",
      move: VMOVE,
    },
  },
  {
    id: "virtual-belady",
    gym: "virtual",
    title: "Belady's anomaly and stack algorithms",
    pages: [
      {
        heading: "More frames, more faults?",
        body: [
          "Intuition says that giving a process more frames can only reduce its faults. For FIFO that is false. On the reference string 1 2 3 4 1 2 5 1 2 3 4 5, FIFO takes 9 faults with 3 frames and 10 faults with 4. This is Belady's anomaly.",
          "It happens because FIFO's set of resident pages with 4 frames need not contain its set with 3 frames: it can keep the wrong pages around.",
        ],
        diagram: "belady",
      },
      {
        heading: "Stack algorithms",
        body: [
          "A stack algorithm has the inclusion property: the pages in memory with n frames are always a subset of those with n + 1 frames. Such algorithms can never show the anomaly.",
          "LRU and Optimal are stack algorithms; FIFO is not. Real systems still use approximations such as clock rather than exact LRU, because exact LRU is expensive, but second-chance behaves like LRU, not like FIFO, for the pages in active use.",
        ],
      },
    ],
    check: {
      id: "lesson-belady",
      prompt: "Which of these page-replacement algorithms can suffer Belady's anomaly?",
      options: ["FIFO", "LRU", "Optimal", "All three"],
      answer: ANOMALY.fifo !== null && ANOMALY.lru === null && ANOMALY.opt === null ? 0 : 3,
      explain: "LRU and Optimal are stack algorithms: the pages resident with n frames are always among those resident with n + 1, so more frames never hurt. FIFO has no such property, and the string 1 2 3 4 1 2 5 1 2 3 4 5 takes 9 faults with 3 frames and 10 with 4.",
      move: VMOVE,
    },
  },
  {
    id: "virtual-thrash",
    gym: "virtual",
    title: "Frame allocation and thrashing",
    pages: [
      {
        heading: "Sharing the frames",
        body: [
          "Each process needs a minimum number of frames, set by the architecture: one instruction may touch several pages. Beyond that, equal allocation gives every process m ÷ n frames, and proportional allocation gives each a share by its size: a process of size s_i out of a total S gets s_i ÷ S × m.",
          "Replacement can be global (a process may evict any process's frame, which is flexible but lets one process hurt another) or local (only its own frames, which is predictable but may leave frames unused).",
        ],
      },
      {
        heading: "Thrashing",
        body: [
          "A process without enough frames for the pages it is actively using faults, evicts a page it needs again at once, and faults again. It spends more time paging than executing: thrashing.",
          "The vicious circle: CPU utilisation drops, so the OS sees idle time and starts more processes, which take frames from the others, which fault more. Local replacement limits the spread; the real cures are to give each process the frames it needs (see working sets) or to suspend some processes and swap them out.",
        ],
        diagram: "thrash",
      },
    ],
    check: {
      id: "lesson-thrash",
      prompt: "CPU utilisation is 5% and the paging disk is almost always busy. What should the OS do?",
      options: ["Suspend some processes to free frames", "Start more processes to use the idle CPU", "Install a faster CPU", "Lengthen the time quantum"],
      answer: 0,
      explain: "This is thrashing: the CPU is idle because every process is waiting for a page. More processes would take frames from the others and make it worse; a faster CPU just waits faster. Reduce the degree of multiprogramming so each remaining process has enough frames.",
      move: VMOVE,
    },
  },
  {
    id: "virtual-wss",
    gym: "virtual",
    title: "Working sets",
    pages: [
      {
        heading: "The locality window",
        body: [
          "Programs run in localities: for a while they use one group of pages (a function, its data), then move to another. The working-set model captures this with a window of the last Δ references. The working set WS is the set of distinct pages in that window, and its size WSS is how many frames the process needs right now.",
          "If Δ is too small the window misses part of the locality; too large and it spans several. In Silberschatz's Figure 10.16 with Δ = 10 the working set at t1 is {1, 2, 5, 6, 7} (size 5) and later at t2 it is {3, 4} (size 2).",
        ],
        diagram: "wss",
      },
      {
        heading: "Using it",
        body: [
          "Let D be the sum of every process's WSS. If D is more than the number of frames m, some process cannot have its working set resident, so the system thrashes: the OS suspends a process and gives its frames to the others. If D is below m it may start another process.",
          "The model prevents thrashing while keeping multiprogramming as high as it can safely be. Tracking it exactly is costly, so real systems approximate it with reference bits and a timer, or control the page-fault frequency directly: too high a rate means give the process more frames, too low means take some away.",
        ],
      },
    ],
    check: {
      id: "lesson-wss",
      kind: "numeric",
      prompt: "A process's last 10 references were 2, 6, 1, 5, 7, 7, 7, 7, 5, 1. With a window of 10 references, what is its working-set size?",
      answer: WSS_CHECK,
      explain: "The distinct pages in the window are 1, 2, 5, 6 and 7, so the working set is {1, 2, 5, 6, 7} and its size is 5. The repeated 7s and the second 5 and 1 add nothing.",
      move: VMOVE,
    },
  },
  {
    id: "storage-alloc",
    gym: "storage",
    title: "File allocation",
    pages: [
      {
        heading: "Three ways to lay out a file",
        body: [
          "A disk is an array of fixed-size blocks, and the file system decides which blocks belong to a file. Contiguous allocation gives a file one run of adjacent blocks: the directory stores only the start and the length, and both sequential and direct access are fast. But free space fragments externally, and a file that grows may have nowhere to go.",
          "Linked allocation chains the blocks: each block holds a pointer to the next, so there is no external fragmentation and a file can grow freely. The price is that direct access is slow (reaching block n means following n links) and a damaged pointer loses the rest of the file. FAT keeps all the links in one table at the start of the disk to speed this up.",
        ],
        diagram: "alloc",
      },
      {
        heading: "Indexed allocation",
        body: [
          "Indexed allocation gives each file an index block, an array of pointers to its data blocks. Direct access costs one read for the index block and one for the data block, and there is no external fragmentation. The cost is the index block itself, wasteful for tiny files, and a limit on file size when one index block is not enough.",
          "That limit is what the Unix inode answers with multilevel indexing. Almost every modern file system is a variation on indexed allocation.",
        ],
      },
    ],
    check: {
      id: "lesson-alloc",
      kind: "numeric",
      prompt: "A file uses linked allocation and only its directory entry (the first block's address) is in memory. How many disk reads does it take to read the file's block 9 (counting from block 0)?",
      answer: ALLOC_CHECK,
      explain: "Block 0 is read from the address in the directory entry, and each block holds the address of the next. To reach block 9 you read blocks 0, 1, 2, ... 9 in turn: 10 reads. Contiguous allocation would need 1 and indexed allocation 2.",
      move: STMOVE,
    },
  },
  {
    id: "storage-inode",
    gym: "storage",
    title: "Inodes and maximum file size",
    pages: [
      {
        heading: "One inode per file",
        body: [
          "A Unix file is described by an inode that holds its owner, permissions, timestamps and size, and the addresses of its blocks, but not its name (names live in directories). The inode has a few direct pointers (12 is typical) that point straight at data blocks, so small files, the vast majority, need no extra reads.",
          "Past that come a single indirect pointer (to a block of pointers), a double indirect pointer (to a block of blocks of pointers) and a triple indirect pointer. Each level multiplies the reach by the number of pointers that fit in a block.",
        ],
        diagram: "inode",
      },
      {
        heading: "Counting the maximum",
        body: [
          "With block size B and pointer size P, one block holds B / P pointers. The largest file is (12 + B/P + (B/P)² + (B/P)³) blocks. With 1 KB blocks and 4-byte pointers that is 12 + 256 + 65,536 + 16,777,216 = 16,843,020 blocks, a little over 16 GiB.",
          "Opening a file also costs a chain of reads: the inode, then up to three index blocks for a deep offset. Disk caches keep the hot ones in RAM. Hard links are extra directory names for one inode, which is why the inode, not the directory entry, holds the link count.",
        ],
      },
    ],
    check: {
      id: "lesson-inode",
      kind: "numeric",
      prompt: "An inode has 12 direct pointers plus single, double and triple indirect pointers. Blocks are 1 KB and each pointer is 4 bytes. How many data blocks can a file have at most?",
      answer: INODE_CHECK,
      explain: "A block holds 1024 / 4 = 256 pointers. Blocks reached: 12 direct + 256 (single) + 256² = 65,536 (double) + 256³ = 16,777,216 (triple) = 16,843,020.",
      move: STMOVE,
    },
  },
  {
    id: "storage-journal",
    gym: "storage",
    title: "Directories and journaling",
    pages: [
      {
        heading: "Directories",
        body: [
          "A directory is a file whose contents map names to inode numbers. A linear list is simple but slow to search; a hash table or a B-tree makes lookups fast in big directories. Resolving /home/ana/a.txt reads the root directory's inode and data, finds home, reads that, and so on down the path.",
          "A hard link is another name for the same inode. A symbolic link is a small file that stores a path, so it can cross file systems and dangle if its target is deleted.",
        ],
      },
      {
        heading: "Surviving a crash",
        body: [
          "Creating a file touches several blocks: the bitmap, the inode, the directory and the data. A crash between those writes leaves the file system inconsistent, and checking it with fsck means scanning the whole disk.",
          "A journaling file system first writes the intended changes to a log (the journal), then writes a commit record, and only then performs the real updates (the checkpoint) and frees the log entry. After a crash the OS replays the committed transactions and discards the ones with no commit record. Recovery takes seconds, not a full scan.",
        ],
        diagram: "journal",
      },
    ],
    check: {
      id: "lesson-journal",
      prompt: "A journaling file system crashes after a transaction's commit record reached the log but before its changes were checkpointed to their final blocks. What does recovery do?",
      options: ["Replay the logged transaction", "Throw the transaction away", "Run fsck over the whole disk", "Delete the file"],
      answer: 0,
      explain: "The commit record means the whole transaction is safely in the log, so recovery redoes it. A transaction with no commit record would be discarded instead, and no full scan is needed.",
      move: STMOVE,
    },
  },
  {
    id: "storage-raid",
    gym: "storage",
    title: "RAID levels",
    pages: [
      {
        heading: "Many disks, one volume",
        body: [
          "RAID combines several disks for speed, reliability or both. Striping spreads consecutive blocks across the disks so they are read in parallel; mirroring keeps copies; parity stores enough redundancy to rebuild a lost disk.",
          "RAID 0 is striping only: n disks of capacity, but any failure loses everything. RAID 1 mirrors: half the capacity, survives one failure (more if they are on different pairs). RAID 10 stripes across mirrored pairs.",
        ],
        diagram: "raid",
      },
      {
        heading: "Parity",
        body: [
          "RAID 5 stripes data with one block of parity per stripe, spread over all the disks. Parity is the XOR of the data blocks, so any one lost block is the XOR of the survivors. Usable capacity is n − 1 disks, and one disk can fail. Small writes are slow: read the old data and parity, write the new ones.",
          "RAID 6 keeps two independent parities, so n − 2 disks are usable and two failures are survived: valuable on big arrays, where a second disk often fails during the long rebuild of the first. RAID is not a backup: it does not protect against deletion or corruption.",
        ],
      },
    ],
    check: {
      id: "lesson-raid",
      kind: "numeric",
      prompt: "A RAID 5 array has 6 disks of 2 TB each. How many TB are usable?",
      answer: RAID_CHECK,
      explain: "One disk's worth of space holds parity, so usable capacity is (6 − 1) × 2 TB = 10 TB.",
      move: STMOVE,
    },
  },
  {
    id: "storage-disk",
    gym: "storage",
    title: "Disk scheduling",
    pages: [
      {
        heading: "Seeking is the cost",
        body: [
          "On a magnetic disk the slow part is the seek: moving the head to the right cylinder. A scheduler orders the pending requests to cut the total head movement. Take Silberschatz's queue 98, 183, 37, 122, 14, 124, 65, 67 with the head at cylinder 53 on a 200-cylinder disk.",
          "FCFS serves them in arrival order and moves 640 cylinders. SSTF always picks the closest request: 236 cylinders, but it can starve far-away requests. SCAN (the elevator) sweeps one way to the end of the disk and then back: 331 cylinders when heading up first.",
        ],
        diagram: "disk",
      },
      {
        heading: "Circular and look variants",
        body: [
          "C-SCAN sweeps one way only: at the end it jumps straight back to cylinder 0 and sweeps again, which gives more uniform waiting times (382 cylinders counting the return jump). LOOK and C-LOOK are the practical versions, turning at the last request instead of the disk edge: LOOK moves 299 and C-LOOK 322 on this queue.",
          "Seek time matters less on SSDs, which have no moving head, and Linux's I/O schedulers (deadline, BFQ, none for NVMe) are built around fairness and latency instead. Disk scheduling is still a classic interview computation: draw the head's path and add up the gaps.",
        ],
      },
    ],
    check: {
      id: "lesson-disk",
      kind: "numeric",
      prompt: "Queue 98, 183, 37, 122, 14, 124, 65, 67 with the head at cylinder 53, heading towards higher cylinders. How many cylinders does LOOK move in total?",
      answer: LOOK_CHECK,
      explain: "LOOK goes up from 53 to the highest request, 183 (130 cylinders), then turns round and goes down to the lowest, 14 (169 cylinders): 130 + 169 = 299. SCAN would go on to cylinder 199 first, adding 16 and 16 cylinders: 331.",
      move: STMOVE,
    },
  },
  {
    id: "containers-namespaces",
    gym: "interview",
    title: "Containers: namespaces",
    pages: [
      {
        heading: "A container is a process",
        body: [
          "A container is not a small virtual machine. It is an ordinary Linux process (or a group of them) that the kernel has been told to isolate. There is one kernel, shared by the host and every container; Docker and containerd only set up the isolation and start the process.",
          "The first tool is the namespace. A namespace wraps one global resource so that the processes inside see a private copy of it. You get one with `clone(CLONE_NEWPID)`, `unshare(2)` or `setns(2)`.",
        ],
      },
      {
        heading: "The namespace kinds",
        body: [
          "`mnt` gives a private mount table, so the container sees its own root file system. `pid` gives a private process tree. `net` gives its own network interfaces, routes and ports. `uts` gives its own hostname. `ipc` isolates System V and POSIX message queues and shared memory. `user` maps UIDs, so root inside can be an ordinary user outside. `cgroup` and `time` exist too.",
          "In a new PID namespace the first process is PID 1 and sees only its descendants. The host still sees the same process, with a larger PID of its own, and can kill it. PID 1 inside is special: if it exits, the kernel kills the whole namespace.",
        ],
        diagram: "namespaces",
      },
    ],
    check: {
      id: "lesson-namespaces",
      prompt: "Inside a container, `ps` lists only the container's own processes and its main process is PID 1. Which kernel feature does that?",
      options: ["A PID namespace", "A cgroup", "A virtual machine monitor", "chroot"],
      answer: 0,
      explain: "A PID namespace gives its processes a private PID numbering that starts at 1. A cgroup limits resources but hides nothing, chroot only changes the root directory, and containers have no hypervisor.",
      move: CMOVE,
    },
  },
  {
    id: "containers-cgroups",
    gym: "interview",
    title: "Containers: cgroups",
    pages: [
      {
        heading: "Limits and accounting",
        body: [
          "Namespaces decide what a process can see; control groups (cgroups) decide how much it can use. In cgroup v2 there is one tree under `/sys/fs/cgroup`. You put processes in a group and write limits to its files; the kernel counts their CPU, memory and I/O together.",
          "`cpu.max` holds `quota period` in microseconds. `50000 100000` means 50 ms of CPU time in every 100 ms, which is half a CPU, however many CPUs the machine has. `cpu.weight` is a relative share used only when CPUs are contended: weights 100 and 300 split the CPU 1 : 3.",
        ],
      },
      {
        heading: "Throttled or killed",
        body: [
          "The quota is spent across all threads. With four busy threads and `cpu.max = 50000 100000`, they burn 50 ms of CPU in 12.5 ms of wall-clock time and are then throttled until the next period: latency spikes, but nothing dies.",
          "`memory.max` is a hard limit. When the group goes over it, the kernel first reclaims page cache, which is cheap to drop. If anonymous memory alone still exceeds the limit, the group's OOM killer shoots the biggest process and the container sees exit code 137 (SIGKILL). That is the OOMKilled you see in Kubernetes.",
        ],
        diagram: "cgroups",
      },
    ],
    check: {
      id: "lesson-cgroups",
      kind: "numeric",
      prompt: "A container has `cpu.max = 25000 100000` and 8 busy threads on an 8-CPU host. For how many milliseconds of each 100 ms period do its threads run before they are throttled?",
      answer: CPU_MAX_CHECK,
      unit: "ms",
      explain: "The quota is 25 ms of CPU time per period, and 8 threads on 8 CPUs spend it 8 ms per ms: 25 / 8 = 3.125 ms of wall-clock time. The threads then wait for the rest of the 100 ms.",
      move: CMOVE,
    },
  },
];

export const lessonsOf = (gym: string) => LESSONS.filter((l) => l.gym === gym);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const LESSON_IDS = new Set(LESSONS.map((l) => l.id));
