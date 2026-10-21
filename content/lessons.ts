import type { Question } from "@/game/engine/question";
import { roundRobin, sjf } from "@/game/sim/scheduling";
import { finalValues, increment, runSemaphore, type SyncThread } from "@/game/sim/sync";

/**
 * Concept lessons, read before a gym's battles (ROADMAP §2: lessons →
 * generated battles → boss). A lesson is a few short pages, some with an
 * illustrated diagram, and ends with one quick-check question of any kind.
 * Facts follow Silberschatz, Operating System Concepts (10th ed.), ch. 1–7;
 * every quick check is tested in tests/lessons.test.ts.
 */
export type DiagramId = "modes" | "syscall" | "interrupt" | "kernels" | "boot" | "pstates" | "context" | "fork" | "threads" | "ipc" | "fcfs" | "sjf" | "priority" | "rr" | "mlfq" | "race" | "peterson" | "semaphore" | "monitor" | "philosophers";

export interface LessonPage {
  heading: string;
  /** paragraphs; `backticks` render as code */
  body: string[];
  diagram?: DiagramId;
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
const RACE_VALUES = finalValues({ counter: 5 }, RACE_THREADS, "counter");
const RACE_OPTIONS = [3, 4, 5, 6, 7];
/** five processes wait() on a semaphore that starts at 2 */
export const SEM_CHECK = runSemaphore(2, ["A", "B", "C", "D", "E"].map((who) => ({ op: "wait" as const, who })));
const YMOVE = { name: "Recall", type: "sync", power: 30 } as const;
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
      kind: "multi",
      prompt: "counter is 5. A producer runs counter++ while a consumer runs counter-- (each is load, add, store). Which final values of counter are possible? Select all.",
      options: RACE_OPTIONS.map(String),
      answers: RACE_OPTIONS.flatMap((v, i) => (RACE_VALUES.includes(v) ? [i] : [])),
      explain: "If one thread runs all three steps before the other starts, counter ends at 5. If both load 5 before either stores, the store that lands last wins: 6 if it is the producer's, 4 if it is the consumer's. 3 and 7 would need a change to happen twice.",
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
];

export const lessonsOf = (gym: string) => LESSONS.filter((l) => l.gym === gym);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const LESSON_IDS = new Set(LESSONS.map((l) => l.id));
