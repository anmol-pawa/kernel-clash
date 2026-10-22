import { dueFirst, type Deck } from "@/game/engine/leitner";
import type { Generator, Question } from "@/game/engine/question";
import { rng } from "@/lib/rng";
import { BASICS_GENERATORS } from "./basicsGenerators";
import { PROCESS_GENERATORS } from "./processGenerators";
import { SCHEDULING_GENERATORS } from "./schedulingGenerators";
import { DEADLOCK_GENERATORS } from "./deadlockGenerators";
import { SYNC_GENERATORS } from "./syncGenerators";
import { safety, type BankerState } from "@/game/sim/deadlock";
import { increment } from "@/game/sim/sync";
import { GYM_QUESTIONS } from "./gymQuestions";

/**
 * Each gym's question pool: its six boss questions, more authored questions
 * of every kind, and generators. A gym battle draws six turns from the pool
 * (see `gymBattleQuestions`). Every answer is checked in tests/pools.test.ts.
 */
export interface Pool {
  authored: Question[];
  generators: Generator[];
}

const io = (name: string, power: number) => ({ name, type: "io" as const, power });

/** OS basics (Silberschatz ch. 1–2), beyond the six boss questions. */
export const BASICS_EXTRA: Question[] = [
  {
    id: "basics-modebit",
    prompt: "What does the CPU's mode bit record?",
    options: ["Whether the CPU is running in kernel mode or user mode", "Which process is running", "Whether interrupts are pending", "Whether the cache is enabled"],
    answer: 0,
    explain: "One hardware bit says kernel (0) or user (1) mode. A trap or interrupt sets kernel mode, and the kernel sets user mode again before returning to a program.",
    move: io("Mode Flip", 30),
  },
  {
    id: "basics-timer",
    prompt: "Why does the OS set a hardware timer before handing the CPU to a user program?",
    options: ["To measure the program's speed for the user", "To slow the program down", "So it gets control back even if the program loops forever", "To keep the clock on screen right"],
    answer: 2,
    explain: "When the timer runs out it raises an interrupt, which forces the CPU back into the kernel. Setting the timer is privileged, so the program can't switch it off.",
    move: io("Timer Snap", 32),
  },
  {
    id: "basics-vector",
    prompt: "What does the interrupt vector hold?",
    options: ["The saved registers of the interrupted program", "The addresses of the interrupt handlers, indexed by interrupt number", "A queue of pending I/O requests", "The list of system-call names"],
    answer: 1,
    explain: "The interrupt vector is a table of handler addresses. The interrupt number indexes it, so the CPU jumps straight to the right handler without searching.",
    move: io("Vector Lash", 32),
  },
  {
    id: "basics-api",
    prompt: "Why do programs call library wrappers such as read() in libc rather than issuing the trap themselves?",
    options: ["The wrappers skip kernel mode, so they are faster", "Programs aren't allowed to call the kernel at all", "The trap instruction only works inside libc", "The API is portable and hides system-call numbers and register conventions"],
    answer: 3,
    explain: "An API such as POSIX stays the same across machines and kernels. The wrapper puts the system-call number and arguments where this kernel expects them and then traps.",
    move: io("Wrapper Wrap", 30),
  },
  {
    id: "basics-params",
    prompt: "A system call has more parameters than there are free registers. What does the OS usually do?",
    options: ["Store them in a block in memory and pass the block's address in a register", "Refuse the call", "Split it into one system call per parameter", "Send them over the interrupt bus"],
    answer: 0,
    explain: "Parameters go in registers, in a block or table in memory whose address is passed in a register (Linux does this), or pushed on the stack and popped by the kernel.",
    move: io("Param Pack", 32),
  },
  {
    id: "basics-uefi",
    prompt: "Where does UEFI firmware find the boot loader?",
    options: ["In the 512-byte MBR boot block", "In the CPU's microcode", "As a file on the EFI System Partition", "On the first network server it finds"],
    answer: 2,
    explain: "UEFI reads a FAT-formatted EFI System Partition and runs a boot-loader file from it. The 512-byte MBR boot block is the older BIOS way.",
    move: io("EFI Burst", 34),
  },
  {
    id: "basics-pid1",
    prompt: "Which process does the Linux kernel start first in user space?",
    options: ["The shell, as PID 0", "init (often systemd), as PID 1", "The boot loader, as PID 1", "The idle task, as PID 2"],
    answer: 1,
    explain: "After it initializes, the kernel runs init (systemd on most distributions) as PID 1. Every other user process descends from it.",
    move: io("First Spark", 34),
  },
  {
    kind: "multi",
    id: "multi-basics-micro",
    prompt: "Which are advantages of a microkernel over a monolithic kernel? Select all that apply.",
    options: ["A crashed driver doesn't bring down the kernel", "New services can be added as user-space servers", "Less code runs in kernel mode", "System calls are faster", "It needs no mode switches"],
    answers: [0, 1, 2],
    explain: "Moving services into user-space servers makes the kernel small, sturdier and easier to extend. The price is speed: a request becomes messages between servers, with extra mode switches.",
    move: io("Micro Pulse", 34),
  },
  {
    kind: "multi",
    id: "multi-basics-syscalls",
    prompt: "Which of these are UNIX system calls (not just library functions)? Select all that apply.",
    options: ["fork()", "open()", "printf()", "read()", "strlen()", "mmap()"],
    answers: [0, 1, 3, 5],
    explain: "fork, open, read and mmap trap into the kernel. printf() is a libc function that formats text and then calls the write() system call, and strlen() never leaves user mode.",
    move: io("Syscall Surge", 32),
  },
  {
    kind: "multi",
    id: "multi-basics-irq",
    prompt: "What happens when a hardware interrupt arrives? Select all that apply.",
    options: ["The CPU saves the program counter and state", "The CPU jumps to the handler through the interrupt vector", "The interrupted program is killed", "The handler runs in kernel mode", "The interrupted program restarts from its beginning"],
    answers: [0, 1, 3],
    explain: "The CPU saves where it was, switches to kernel mode and jumps through the vector to the handler. When the handler finishes, the saved state is restored and the program carries on as if nothing happened.",
    move: io("IRQ Jolt", 32),
  },
  {
    kind: "order",
    id: "order-basics-irq",
    prompt: "Put the steps of handling a hardware interrupt in order.",
    steps: [
      "A device raises a signal on its interrupt-request line",
      "The CPU finishes its current instruction and notices the request",
      "The CPU saves the program counter and state and switches to kernel mode",
      "It jumps to the handler through the interrupt vector",
      "The handler services the device",
      "Return-from-interrupt restores the state and the program resumes",
    ],
    explain: "The CPU checks the interrupt line after every instruction. It saves its state, enters kernel mode, and dispatches through the vector to the handler, then restores the state and returns.",
    move: io("Vector Lash", 34),
  },
  {
    kind: "order",
    id: "order-basics-fault",
    prompt: "A user program runs a privileged instruction. Put what happens in order.",
    steps: [
      "The program executes the privileged instruction in user mode",
      "The hardware sees the mode bit is user and raises an exception",
      "The CPU switches to kernel mode and jumps to the exception handler",
      "The OS handles it, usually by terminating the process",
    ],
    explain: "The hardware checks the mode bit itself, so the instruction never runs. It traps into the kernel, which treats it as an illegal operation and usually kills the process.",
    move: io("Trap Strike", 32),
  },
  {
    kind: "numeric",
    id: "num-basics-rings",
    prompt: "How many protection rings does the x86 architecture define?",
    answer: 4,
    explain: "x86 has rings 0 to 3. The kernel runs in ring 0 and user programs in ring 3; most OSes leave rings 1 and 2 unused.",
    move: io("Ring Zero", 30),
  },
  {
    kind: "numeric",
    id: "num-basics-mbr",
    prompt: "How many bytes is the boot sector (MBR) that a BIOS loads?",
    answer: 512,
    unit: "bytes",
    explain: "The BIOS loads the disk's first 512-byte sector. It holds a 446-byte first-stage loader, the 64-byte partition table and the 2-byte 0x55AA signature, so that loader only has room to load a bigger second stage.",
    move: io("Boot Block", 34),
  },
];

const proc = (name: string, power: number) => ({ name, type: "process" as const, power });

/** Processes and threads (Silberschatz ch. 3–4), beyond the six boss questions. */
export const PROCESSES_EXTRA: Question[] = [
  {
    id: "proc-pcb",
    prompt: "Which of these is NOT kept in a process control block (PCB)?",
    options: ["The saved program counter and registers", "The process state and PID", "The list of open files", "The program's source code"],
    answer: 3,
    explain: "The PCB holds what the kernel needs to manage and resume the process: state, PID, saved PC and registers, scheduling info, memory-management info and open files. Source code is never loaded at all; the process runs compiled machine code.",
    move: proc("PCB Press", 30),
  },
  {
    id: "proc-ctx-save",
    prompt: "During a context switch, where does the kernel save the outgoing process's registers?",
    options: ["On the user's stack", "In that process's PCB", "In the interrupt vector", "Nowhere: they are recomputed later"],
    answer: 1,
    explain: "The kernel stores the CPU state (PC, registers) in the old process's PCB and reloads the new process's state from its PCB. That save and reload is pure overhead: no useful work runs meanwhile.",
    move: proc("Context Swap", 32),
  },
  {
    id: "proc-fork-ret",
    prompt: "What does fork() return in the newly created child?",
    options: ["The child's own PID", "The parent's PID", "0", "-1"],
    answer: 2,
    explain: "fork() returns twice: 0 in the child and the child's PID in the parent (or -1 in the parent if it fails). That is how `if (fork() == 0)` tells them apart.",
    move: proc("Fork Strike", 32),
  },
  {
    id: "proc-orphan",
    prompt: "A parent exits while its child is still running. On Linux, what happens to the child?",
    options: ["It is adopted by init (PID 1) or a subreaper, which reaps it when it exits", "It is killed at once", "It becomes a zombie immediately", "It takes over its parent's PID"],
    answer: 0,
    explain: "The child becomes an orphan and is re-parented to init/systemd (or a designated subreaper), which calls wait() for it when it exits, so it doesn't stay a zombie forever.",
    move: proc("Adopt", 32),
  },
  {
    id: "proc-cow",
    prompt: "Why is fork() fast on modern systems even when the parent uses gigabytes of memory?",
    options: ["Parent and child really share one address space for good", "The child gets an empty address space", "Only the stack is copied", "Copy-on-write: pages are shared until one of them writes to a page"],
    answer: 3,
    explain: "With copy-on-write the child's page table points at the parent's pages, marked read-only. A page is copied only when either side writes to it, and since the child usually calls exec() soon, most pages are never copied.",
    move: proc("Cow Clone", 34),
  },
  {
    id: "proc-m2o",
    prompt: "In the many-to-one threading model, one user thread makes a blocking system call. What happens?",
    options: ["Only that thread blocks", "The whole process blocks", "The kernel creates a new kernel thread", "The call fails at once"],
    answer: 1,
    explain: "All the user threads map to one kernel thread, so when it blocks in the kernel no other thread of the process can run. They can't run in parallel on several cores either. One-to-one (Linux, Windows) avoids both problems.",
    move: proc("Thread Knot", 32),
  },
  {
    id: "proc-pipe-eof",
    prompt: "A process reads from an empty pipe whose write ends have all been closed. What does read() do?",
    options: ["Blocks forever", "Returns an error and kills the process", "Returns 0, meaning end of file", "Returns the last byte again"],
    answer: 2,
    explain: "With no writer left, no data can ever arrive, so read() returns 0 (EOF). While any write end is still open, read() on an empty pipe blocks instead. That's why each process must close the pipe ends it doesn't use.",
    move: proc("Pipe Drain", 34),
  },
  {
    id: "proc-mode-switch",
    prompt: "Which is usually cheaper: a mode switch (entering the kernel for a system call and returning) or a context switch?",
    options: ["A mode switch: the same process keeps running, with no PCB swap or cache/TLB disruption", "A context switch: it never enters the kernel", "They always cost exactly the same", "Neither has any cost"],
    answer: 0,
    explain: "A system call only switches the CPU between user and kernel mode for the same process. A context switch also saves one process's state to its PCB, loads another's and often changes address space, which disturbs caches and the TLB.",
    move: proc("Mode Flip", 30),
  },
  {
    kind: "multi",
    id: "multi-proc-off-cpu",
    prompt: "Which of these take a running process off the CPU? Select all that apply.",
    options: ["A timer interrupt ends its time slice", "It requests disk I/O and must wait", "It calls exit()", "It adds two numbers", "It reads one of its own variables"],
    answers: [0, 1, 2],
    explain: "A process leaves Running when it is preempted (back to Ready), waits for I/O or an event (to Waiting) or terminates. Ordinary instructions on its own memory never involve the kernel.",
    move: proc("Preempt", 32),
  },
  {
    kind: "multi",
    id: "multi-proc-inherit",
    prompt: "Right after fork(), which of these does the child get from its parent? Select all that apply.",
    options: ["A copy of the parent's address space (data, heap, stack)", "Copies of the parent's open file descriptors", "The parent's PID as its own", "Execution continuing just after the fork() call", "The parent's used CPU time"],
    answers: [0, 1, 3],
    explain: "The child is a copy: same memory contents (copy-on-write), duplicated file descriptors pointing at the same open files, and it resumes right after fork(). It gets a new PID, and its CPU-time counters start at zero.",
    move: proc("Fork Strike", 34),
  },
  {
    kind: "multi",
    id: "multi-proc-pipe",
    prompt: "Which are true of an ordinary (anonymous) UNIX pipe? Select all that apply.",
    options: ["Data flows in one direction only", "It is normally shared between a parent and its child", "It has a name in the file system", "It keeps existing after every process using it has exited", "Reading from it when empty blocks while a write end is still open"],
    answers: [0, 1, 4],
    explain: "pipe() gives a read end and a write end, so data flows one way; the ends are inherited across fork(), so it links related processes. It has no name and disappears with its processes; a named pipe (FIFO) is the one with a name that can outlive them.",
    move: proc("Pipe Lash", 34),
  },
  {
    kind: "order",
    id: "order-proc-shell",
    prompt: "Put the steps of a shell running the command `ls` in order.",
    steps: [
      "The shell reads and parses the command line",
      "The shell calls fork() to create a child",
      "The child calls exec() to load the ls program",
      "ls prints its output and calls exit()",
      "The shell's wait() returns and it prints the next prompt",
    ],
    explain: "This is the classic fork-exec-wait pattern: the shell forks a copy of itself, the copy replaces itself with ls through exec(), and the parent waits until the child exits before reading the next command.",
    move: proc("Exec Swap", 34),
  },
  {
    kind: "order",
    id: "order-proc-life",
    prompt: "Put this process's life in order.",
    steps: [
      "NEW: fork() creates it",
      "READY: the OS admits it to the ready queue",
      "RUNNING: the scheduler dispatches it",
      "WAITING: it requests a disk read",
      "READY: the disk read completes",
      "TERMINATED: dispatched again, it calls exit()",
    ],
    explain: "New → Ready (admitted) → Running (dispatched) → Waiting (I/O request) → Ready (I/O done; never straight back to Running) → Running → Terminated (exit).",
    move: proc("State Shift", 32),
  },
  {
    kind: "numeric",
    id: "num-proc-loop",
    prompt: "Including the original process, how many processes exist when this loop is done?",
    code: "for (int i = 0; i < 4; i++)\n  fork();",
    answer: 16,
    explain: "Every pass through the loop doubles the processes, and each child keeps looping from where its parent was: 1 → 2 → 4 → 8 → 16 (Silberschatz exercise 3.12).",
    move: proc("Hydra Split", 36),
  },
  {
    kind: "numeric",
    id: "num-proc-child",
    prompt: "Including the original process, how many processes exist at the end?",
    code: "if (fork() == 0) {\n  fork();\n  fork();\n}",
    answer: 5,
    explain: "The first fork() makes one child; only it (fork() returned 0) enters the block. Its two forks turn it into 4 processes: the parent plus 4 = 5.",
    move: proc("Fork Bomb", 34),
  },
];

const sched = (name: string, power: number) => ({ name, type: "scheduler" as const, power });

/** CPU scheduling (Silberschatz ch. 5), beyond the six boss questions. */
export const SCHEDULING_EXTRA: Question[] = [
  {
    id: "sched-dispatch-latency",
    prompt: "What is dispatch latency?",
    options: ["How long a process waits in the ready queue", "The time the dispatcher takes to stop one process and start another", "The length of one time quantum", "The time from submitting a job until it finishes"],
    answer: 1,
    explain: "The dispatcher switches context, switches to user mode and jumps to the right place in the new program. Everything it does is overhead, so it must be fast.",
    move: sched("Swift Switch", 30),
  },
  {
    id: "sched-convoy",
    prompt: "Many short I/O-bound jobs queue behind one long CPU-bound job, and the devices sit idle. Which scheduler is known for this convoy effect?",
    options: ["SRTF", "Round Robin", "FCFS", "MLFQ"],
    answer: 2,
    explain: "FCFS never takes the CPU away, so one long job holds it while every short job waits behind it. Any preemptive scheduler, or SJF, lets the short jobs through.",
    move: sched("Convoy Crush", 32),
  },
  {
    id: "sched-tiny-quantum",
    prompt: "Round Robin's time quantum is made much shorter than a context switch takes. What happens?",
    options: ["It turns into FCFS", "Long jobs start to starve", "Average waiting time drops to zero", "Most of the CPU's time goes on context switches"],
    answer: 3,
    explain: "Every quantum ends in a switch, so with a tiny quantum the CPU spends more time switching than running jobs. The textbook rule of thumb: about 80% of CPU bursts should fit in one quantum.",
    move: sched("Timer Tick", 30),
  },
  {
    id: "sched-mlfq-demote",
    prompt: "In a multilevel feedback queue, a process uses up its whole time quantum. What happens to it?",
    options: ["It moves down to a lower-priority queue", "It moves up to a higher-priority queue", "It is terminated", "It stays in the same queue forever"],
    answer: 0,
    explain: "Using the whole quantum marks it as CPU-bound, so it drops a level. Processes that block for I/O before their quantum ends stay high, which is how MLFQ favours interactive jobs.",
    move: sched("Queue Drop", 32),
  },
  {
    id: "sched-interactive",
    prompt: "For a user typing into an editor, which criterion matters most?",
    options: ["Throughput", "CPU utilization", "Turnaround time", "Response time"],
    answer: 3,
    explain: "Response time is the delay from a request until the first response appears. Interactive systems aim to keep it low and predictable; throughput and turnaround matter more for batch jobs.",
    move: sched("Quick Dispatch", 32),
  },
  {
    id: "sched-cfs",
    prompt: "Linux's Completely Fair Scheduler (CFS) runs which task next?",
    options: ["The one with the highest static priority", "The one with the smallest virtual runtime", "The one that arrived first", "The one with the shortest next CPU burst"],
    answer: 1,
    explain: "CFS keeps runnable tasks in a red-black tree ordered by virtual runtime (CPU time scaled by the nice value) and always picks the leftmost, the task that has had the least.",
    move: sched("Fair Share", 34),
  },
  {
    kind: "multi",
    id: "multi-sched-preemptive",
    prompt: "Which of these schedulers are preemptive? Select all that apply.",
    options: ["FCFS", "SRTF", "Round Robin", "Non-preemptive SJF", "MLFQ"],
    answers: [1, 2, 4],
    explain: "SRTF preempts when a shorter job arrives, Round Robin when a quantum expires, and MLFQ both on quantum expiry and when a higher queue gets a job. FCFS and plain SJF always let a job run until it blocks or ends.",
    move: sched("Preempt", 34),
  },
  {
    kind: "multi",
    id: "multi-sched-starve",
    prompt: "Without aging, which of these can starve a process forever? Select all that apply.",
    options: ["FCFS", "Round Robin", "SRTF", "Priority scheduling", "Non-preemptive SJF"],
    answers: [2, 3, 4],
    explain: "SJF and SRTF can keep choosing newly arrived short jobs, and priority scheduling higher-priority ones, so a long or low-priority job may never run. FCFS and Round Robin serve everyone in turn.",
    move: sched("Aging Strike", 32),
  },
  {
    kind: "multi",
    id: "multi-sched-decisions",
    prompt: "Under non-preemptive scheduling, which events make the scheduler choose a new process? Select all that apply.",
    options: ["The running process blocks for I/O", "A timer interrupt fires", "The running process terminates", "A higher-priority process arrives", "An I/O operation completes"],
    answers: [0, 2],
    explain: "Non-preemptive (cooperative) scheduling only switches when the running process gives up the CPU: it waits or it exits. Acting on a timer, an arrival or an I/O completion would mean preempting it.",
    move: sched("Yield", 30),
  },
  {
    kind: "numeric",
    id: "num-sched-rr2",
    prompt: "Round Robin with quantum 2. All three jobs arrive at time 0, in this order. What is the average waiting time (ms)?",
    code: "Proc  Burst\nP1    5\nP2    3\nP3    1",
    answer: 13 / 3,
    unit: "ms",
    explain: "The chart: P1 0–2, P2 2–4, P3 4–5, P1 5–7, P2 7–8, P1 8–9. They finish at 9, 8 and 5, so they wait 9 − 5 = 4, 8 − 3 = 5 and 5 − 1 = 4. Average = 13/3 ≈ 4.33 ms.",
    gantt: [
      { name: "P1", start: 0, end: 2 },
      { name: "P2", start: 2, end: 4 },
      { name: "P3", start: 4, end: 5 },
      { name: "P1", start: 5, end: 7 },
      { name: "P2", start: 7, end: 8 },
      { name: "P1", start: 8, end: 9 },
    ],
    move: sched("Time Slice", 34),
  },
  {
    kind: "numeric",
    id: "num-sched-srtf-p1",
    prompt: "SRTF scheduling. At what time does P1 finish?",
    code: "Proc  Arrival  Burst\nP1    0        8\nP2    1        4\nP3    2        9\nP4    3        5",
    answer: 17,
    explain: "P2 arrives with 4 left against P1's 7 and takes over. Then P4 (5) runs, then P1 finishes its last 7 units, then P3: P1 0–1, P2 1–5, P4 5–10, P1 10–17, P3 17–26 (Silberschatz's SRTF example).",
    gantt: [
      { name: "P1", start: 0, end: 1 },
      { name: "P2", start: 1, end: 5 },
      { name: "P4", start: 5, end: 10 },
      { name: "P1", start: 10, end: 17 },
      { name: "P3", start: 17, end: 26 },
    ],
    move: sched("Preempt", 36),
  },
  {
    kind: "numeric",
    id: "num-sched-tau",
    prompt: "SJF predicts the next CPU burst with τₙ₊₁ = α·tₙ + (1 − α)·τₙ. With α = 1/2 and τ₀ = 10, the process's first two bursts are 6 and 4. What is the prediction τ₂?",
    answer: 6,
    explain: "τ₁ = ½·6 + ½·10 = 8, then τ₂ = ½·4 + ½·8 = 6. Each prediction averages the last real burst with the previous prediction, so older history fades by half each time (Silberschatz's example).",
    move: sched("Burst Guess", 34),
  },
  {
    kind: "order",
    id: "order-sched-sjf",
    prompt: "All four jobs arrive at time 0. Put them in the order non-preemptive SJF runs them.",
    steps: ["P4 (burst 3)", "P1 (burst 6)", "P3 (burst 7)", "P2 (burst 8)"],
    explain: "SJF always picks the shortest job: P4 0–3, P1 3–9, P3 9–16, P2 16–24. P1 waits 3, P2 16, P3 9 and P4 0: average 7 ms (Silberschatz's SJF example).",
    move: sched("Short Burst", 32),
  },
  {
    kind: "order",
    id: "order-sched-switch",
    prompt: "A time slice ends. Put the steps of switching to the next process in order.",
    steps: [
      "The timer interrupt traps into the kernel",
      "The kernel saves the running process's state in its PCB",
      "The scheduler picks the next process from the ready queue",
      "The dispatcher loads that process's state from its PCB",
      "It switches to user mode and jumps to the saved program counter",
    ],
    explain: "The interrupt gets the kernel control, the old state goes into the PCB, the scheduler chooses, and the dispatcher restores the new process's state and returns to user mode where it left off.",
    move: sched("Timer Tick", 30),
  },
];

const syn = (name: string, power: number) => ({ name, type: "sync" as const, power });

/** Synchronization (Silberschatz ch. 6–7), beyond the six boss questions. */
export const SYNC_EXTRA: Question[] = [
  {
    id: "sync-spinlock",
    prompt: "When is a spinlock (a lock that busy-waits) a better choice than a lock that puts the waiter to sleep?",
    options: ["On a single-core CPU, whenever the lock is busy", "When the lock is held for a long time", "On a multicore CPU, when the lock is held for less time than two context switches", "Never: busy waiting always wastes the CPU"],
    answer: 2,
    explain: "Sleeping costs a context switch to block and another to wake. If the holder, running on another core, will release the lock sooner than that, spinning is cheaper. On one core a spinner just burns the holder's time slice.",
    move: syn("Spin Coil", 32),
  },
  {
    id: "sync-tas",
    prompt: "What does the atomic test_and_set(&lock) instruction do?",
    options: ["Sets lock to true and returns its old value", "Returns true if lock is free, without changing it", "Sets lock to false and returns nothing", "Blocks the caller until lock becomes false"],
    answer: 0,
    explain: "It returns the old value and sets lock to true in one indivisible step. `while (test_and_set(&lock));` loops until the old value was false, meaning this caller is the one that took the lock.",
    move: syn("Test and Set", 32),
  },
  {
    id: "sync-cas",
    prompt: "What does compare_and_swap(&value, expected, new_value) do, atomically?",
    options: ["Swaps value and expected", "Always writes new_value and returns expected", "Compares value with new_value and returns the larger", "Writes new_value only if value equals expected, and returns the original value"],
    answer: 3,
    explain: "CAS changes the variable only if it still holds the expected value, and always returns what was there. A lock spins on `while (compare_and_swap(&lock, 0, 1) != 0);`; lock-free counters retry the CAS until no other thread got in between.",
    move: syn("Swap Strike", 34),
  },
  {
    id: "sync-cv-while",
    prompt: "Why does code usually wait on a condition variable inside a while loop, `while (!ready) x.wait();`, rather than an if?",
    options: ["A while loop is faster than an if", "With signal-and-continue, the condition can change again before the woken thread runs", "wait() only works inside loops", "It stops the signalling thread from running"],
    answer: 1,
    explain: "Under signal-and-continue (Mesa semantics, as in pthreads and Java) the signaller keeps the monitor, and another thread may slip in and use up the condition before the woken thread runs. Spurious wake-ups are allowed too, so re-check after waking.",
    move: syn("Recheck", 32),
  },
  {
    id: "sync-inversion",
    prompt: "A low-priority task holds a lock a high-priority task needs, and medium-priority tasks keep preempting the low one. What fixes this priority inversion?",
    options: ["Give the medium tasks a higher priority", "Make the high-priority task busy-wait", "Priority inheritance: the lock holder runs at the waiter's priority until it releases the lock", "Disable the lock"],
    answer: 2,
    explain: "With priority inheritance the low task temporarily borrows the high priority, so the medium tasks can no longer preempt it. It finishes its critical section quickly and the high task gets the lock (the fix for the Mars Pathfinder resets).",
    move: syn("Inherit", 34),
  },
  {
    id: "sync-bb-swap",
    prompt: "In the bounded-buffer producer, wait(mutex) is moved before wait(empty). The buffer is full when the producer runs. What happens?",
    options: ["The producer sleeps holding mutex, so no consumer can take an item: deadlock", "The producer overwrites the oldest item", "Nothing changes; the order doesn't matter", "The consumer skips the mutex"],
    answer: 0,
    explain: "empty is 0, so the producer blocks on wait(empty) while holding mutex. Every consumer then blocks on wait(mutex) and can never signal(empty). Always wait on the counting semaphore before taking the mutex.",
    move: syn("Full Buffer", 36),
  },
  {
    id: "sync-rw-starve",
    prompt: "In the first readers–writers problem (no reader waits unless a writer already holds the lock), who can starve?",
    options: ["Readers", "Writers", "Neither", "Both, in turn"],
    answer: 1,
    explain: "As long as readers keep arriving, readcount never drops to zero and rw_mutex is never released, so a waiting writer can wait forever. The second readers–writers problem favours writers instead, and then readers can starve.",
    move: syn("Read Lock", 32),
  },
  {
    id: "sync-philosophers",
    prompt: "Which rule prevents deadlock among the five dining philosophers?",
    options: ["Each philosopher picks up the left chopstick, then the right", "Each philosopher waits one second between picking up chopsticks", "Odd philosophers pick up the left chopstick first, even ones the right", "Each philosopher holds a chopstick until the neighbour finishes"],
    answer: 2,
    explain: "If everyone takes the left first, all five can hold one chopstick and wait for the next: a circular wait. Making neighbours reach in opposite orders breaks the cycle. Allowing at most four at the table, or taking both chopsticks at once, also works.",
    move: syn("Chopstick", 34),
  },
  {
    kind: "multi",
    id: "multi-sync-race-finals",
    prompt: "counter is 5. The producer runs counter++ and the consumer runs counter--, with no lock. Which final values of counter are possible? Select all that apply.",
    options: ["3", "4", "5", "6", "7"],
    answers: [1, 2, 3],
    explain: "One after the other gives 5. If the producer stores last after loading before the consumer's store, the consumer's −1 is lost: 6. The other way round, the producer's +1 is lost: 4. Each thread changes counter by 1 at most, so 3 and 7 can't happen.",
    move: syn("Race Tally", 34),
  },
  {
    kind: "multi",
    id: "multi-sync-mutex",
    prompt: "Which of these give mutual exclusion on a multicore machine? Select all that apply.",
    options: ["A spinlock built on test_and_set", "A lock built on compare_and_swap", "Disabling interrupts on the current core", "Peterson's algorithm on a CPU that reorders memory accesses, with no memory barriers", "A binary semaphore initialised to 1"],
    answers: [0, 1, 4],
    explain: "Atomic hardware instructions and semaphores built on them work across cores. Disabling interrupts only stops preemption on one core; the others keep running. Without barriers, a reordering CPU can let both Peterson processes in.",
    move: syn("Lockdown", 34),
  },
  {
    kind: "numeric",
    id: "num-sync-sem",
    prompt: "A blocking semaphore S starts at 2. These calls happen in order. What is S's value at the end?",
    code: "P1: wait(S)\nP2: wait(S)\nP3: wait(S)\nP4: wait(S)\nP1: signal(S)",
    answer: -1,
    explain: "2 → 1 → 0 → −1 (P3 blocks) → −2 (P4 blocks). P1's signal() makes it −1 and wakes P3, the longest waiter. A negative value counts the sleepers: P4 is still waiting.",
    move: syn("Count Down", 32),
  },
  {
    kind: "numeric",
    id: "num-sync-interleavings",
    prompt: "Two threads each run counter++, which is three machine steps (load, add, store). How many different interleavings of the six steps are there?",
    answer: 20,
    explain: "Each interleaving picks which 3 of the 6 time slots belong to the first thread; the order within a thread is fixed. That's C(6, 3) = 20.",
    move: syn("Shuffle", 32),
  },
  {
    kind: "numeric",
    id: "num-sync-twice",
    prompt: "x starts at 0. Two threads each run x++ twice, with no lock. What is the smallest value x can end at?",
    answer: 2,
    explain: "Every store writes at least 1, and each thread's second load comes after its own first store, so it loads at least 1 and stores at least 2. The last step is someone's second store, so x ends at 2 or more. 2 happens: T1 loads 0; T2 runs x++ (x = 1); T1 stores 1; T2 loads 1; T1 runs its second x++ (x = 2); T2 stores 2.",
    move: syn("Lost Update", 36),
  },
  {
    kind: "order",
    id: "order-sync-consumer",
    prompt: "Put the bounded-buffer consumer's steps in order.",
    steps: ["wait(full)", "wait(mutex)", "Remove an item from the buffer", "signal(mutex)", "signal(empty)", "Consume the item"],
    explain: "Wait for an item (full), then for the buffer's lock (mutex), take the item, release the lock, and signal that a slot is free (empty). Consume the item outside the critical section so the lock is held as briefly as possible.",
    move: syn("Buffer Drain", 32),
  },
  {
    kind: "order",
    id: "order-sync-sections",
    prompt: "Put the parts of a process's loop around a critical section in order.",
    steps: ["Entry section: ask permission to enter", "Critical section: use the shared data", "Exit section: release permission", "Remainder section: everything else"],
    explain: "Silberschatz's general structure: the entry section requests entry, the critical section touches the shared data, the exit section lets others in, and the remainder section runs until the loop comes round again.",
    move: syn("Guard Gate", 30),
  },
  {
    kind: "interleave",
    id: "il-sync-lose-producer",
    prompt: "counter is 5. The producer runs counter++ and the consumer runs counter--. You are the scheduler: pick an order of their steps that leaves counter at 4.",
    threads: [
      { name: "PRODUCER", code: increment("counter", "r1", 1) },
      { name: "CONSUMER", code: increment("counter", "r2", -1) },
    ],
    init: { counter: 5 },
    goal: { v: "counter", value: 4 },
    answer: [0, 0, 1, 1, 0, 1],
    explain: "To end at 4 the producer's update must be lost: the consumer loads 5 before the producer stores 6, then stores its 4 last, overwriting the 6.",
    move: syn("Lost Update", 34),
  },
];

const dl = (name: string, power: number) => ({ name, type: "sync" as const, power });

/** A small safe state for the authored Banker's question. */
export const DEADLOCK_BANKER: BankerState = {
  available: [1, 1, 2],
  allocation: [[1, 1, 0], [2, 0, 1], [0, 1, 1]],
  max: [[3, 2, 1], [3, 1, 2], [1, 2, 2]],
};

/** Deadlocks (Silberschatz ch. 8), beyond the six boss questions. */
export const DEADLOCK_EXTRA: Question[] = [
  {
    id: "dl-hold-wait",
    prompt: "A process holds a printer and waits for a scanner that another process holds. Which Coffman condition is this?",
    options: ["Mutual exclusion", "Hold and wait", "No preemption", "Circular wait"],
    answer: 1,
    explain: "Hold and wait: a process holds at least one resource while waiting to acquire more that others hold. Requesting everything at once (or releasing before asking) prevents it.",
    move: dl("Claw Clamp", 30),
  },
  {
    id: "dl-starvation",
    prompt: "A low-priority process never gets the CPU because higher-priority processes keep arriving, yet no one is waiting in a cycle. This is…",
    options: ["Deadlock", "Starvation", "A race condition", "Thrashing"],
    answer: 1,
    explain: "Starvation (indefinite blocking) has no circular wait: the process could run if the scheduler let it. Aging is the usual cure. In a deadlock, no process in the cycle can ever proceed.",
    move: dl("Starve Snap", 30),
  },
  {
    id: "dl-waitfor",
    prompt: "A wait-for graph is made from a resource-allocation graph by…",
    options: ["Adding an edge between every pair of processes", "Removing the resource nodes and joining each waiting process to the process holding what it wants", "Reversing every request edge", "Removing every process that isn't waiting"],
    answer: 1,
    explain: "If Pi waits for a resource Rj that Pk holds, draw Pi → Pk. With single-instance resources, a cycle in the wait-for graph means deadlock, and it is cheaper to search than the full graph.",
    move: dl("Cycle Snap", 32),
  },
  {
    id: "dl-advance-max",
    prompt: "Which deadlock technique needs every process to declare its maximum resource needs in advance?",
    options: ["Deadlock avoidance (the Banker's algorithm)", "Deadlock detection", "Ignoring deadlock (the ostrich approach)", "Recovery by aborting processes"],
    answer: 0,
    explain: "Avoidance must know each process's Max to decide whether granting a request keeps the state safe. Detection needs only the current requests and allocations.",
    move: dl("Vault Guard", 32),
  },
  {
    id: "dl-victim",
    prompt: "A recovery scheme always picks the same cheap process as the victim to roll back. What can go wrong?",
    options: ["That process may starve, so the number of rollbacks belongs in the victim's cost", "The deadlock cannot be broken at all", "Every other process deadlocks too", "The system must reboot"],
    answer: 0,
    explain: "Choosing the same victim again and again starves it. Include how often a process has been rolled back in the cost factor, so no one is picked forever.",
    move: dl("Rollback", 36),
  },
  {
    kind: "multi",
    id: "multi-dl-prevention",
    prompt: "Which of these prevent deadlock by breaking one of the four Coffman conditions? Select all that apply.",
    options: ["Request every resource before the process starts running", "Number the resources and always request them in increasing order", "Let the OS take a resource from a waiting process", "Run the Banker's algorithm before each request"],
    answers: [0, 1, 2],
    explain: "The first breaks hold and wait, the second circular wait, the third no preemption. The Banker's algorithm is avoidance: it breaks no condition, it keeps the system in safe states.",
    move: dl("Rank Order", 34),
  },
  {
    kind: "numeric",
    id: "num-dl-need",
    prompt: "In Silberschatz's Banker's example (Max for P0 is 7 5 3 and P0 holds 0 1 0), what is P0's Need for resource A?",
    answer: 7,
    explain: "Need = Max − Allocation. For A: 7 − 0 = 7. P0's full Need is (7, 4, 3).",
    move: dl("Vault Guard", 32),
  },
  {
    kind: "numeric",
    id: "num-dl-units",
    prompt: "Three processes each need at most 2 units of one shared resource, and ask one unit at a time. What is the smallest number of units that guarantees no deadlock?",
    answer: 4,
    explain: "The worst case is every process holding 1 unit and asking for another: with 3 units all three wait forever. With n(m − 1) + 1 = 3 × 1 + 1 = 4 units, one process can always get its second unit, finish, and free enough for the rest.",
    move: dl("Safe Passage", 34),
  },
  {
    kind: "order",
    id: "order-dl-safety",
    prompt: "Put the steps of the Banker's safety algorithm in order.",
    steps: [
      "Set Work = Available and Finish[i] = false for every process",
      "Find a process with Finish[i] = false and Need[i] ≤ Work",
      "Set Work = Work + Allocation[i] and Finish[i] = true",
      "Repeat until no such process is left",
      "The state is safe if every Finish[i] is true",
    ],
    explain: "The algorithm pretends processes finish one by one: any process whose Need fits in Work can finish and return its Allocation. If all of them can, that order is a safe sequence.",
    move: dl("Safe Passage", 34),
  },
  {
    kind: "banker",
    id: "banker-dl-small",
    prompt: "Available = 1 1 2. Tap the processes in an order that is a safe sequence.",
    resources: ["A", "B", "C"],
    state: DEADLOCK_BANKER,
    answer: safety(DEADLOCK_BANKER).sequence,
    explain: "Need = Max − Allocation: P0 (2 1 1), P1 (1 1 1), P2 (1 1 1). Work starts at 1 1 2. P0 needs 2 of A, so it cannot go first. P1 fits and returns its allocation (Work 3 1 3), then P2 fits (3 2 4), then P0 (4 3 4). P1, P2, P0 is a safe sequence; P2, P1, P0 works too.",
    move: dl("Safe Passage", 34),
  },
  {
    kind: "cycle",
    id: "cycle-dl-free",
    prompt: "Every resource has one instance. Is there a deadlock? Tap the nodes of the cycle, or NO DEADLOCK.",
    nodes: [
      { id: "P1", x: 14, y: 14 },
      { id: "P2", x: 50, y: 14 },
      { id: "R1", x: 14, y: 46 },
      { id: "R2", x: 50, y: 46 },
    ],
    edges: [["P1", "R1"], ["R1", "P2"], ["P2", "R2"]],
    answer: [],
    explain: "P1 waits for R1, held by P2, which waits for R2. R2 is free, so P2 gets it, finishes and releases R1; then P1 runs. The arrows form a chain, not a cycle: no deadlock.",
    move: dl("Cycle Snap", 32),
  },
];

export const POOLS: Record<string, Pool> = {
  basics: { authored: [...GYM_QUESTIONS.basics, ...BASICS_EXTRA], generators: BASICS_GENERATORS },
  processes: { authored: [...GYM_QUESTIONS.processes, ...PROCESSES_EXTRA], generators: PROCESS_GENERATORS },
  scheduling: { authored: [...GYM_QUESTIONS.scheduling, ...SCHEDULING_EXTRA], generators: SCHEDULING_GENERATORS },
  sync: { authored: [...GYM_QUESTIONS.sync, ...SYNC_EXTRA], generators: SYNC_GENERATORS },
  deadlocks: { authored: [...GYM_QUESTIONS.deadlocks, ...DEADLOCK_EXTRA], generators: DEADLOCK_GENERATORS },
};

/** How many questions a boss battle asks (the balance tests assume six). */
export const BATTLE_TURNS = 6;

/**
 * A gym battle's questions. With a pool: the authored questions plus one
 * problem per generator (seeded from `seed`), shuffled by `seed`, due
 * Leitner cards first, the first `turns` of them (six for a boss, fewer for
 * a trainer). Without one: the six boss questions, due cards first.
 */
export function gymBattleQuestions(gymId: string, seed: number, deck: Deck, now: number, turns = BATTLE_TURNS): Question[] {
  const pool = POOLS[gymId];
  if (!pool) return dueFirst(GYM_QUESTIONS[gymId] ?? [], deck, now).slice(0, turns);
  const all = [...pool.authored, ...pool.generators.map((g) => g.make(seed))];
  return dueFirst(rng(seed).shuffle(all), deck, now).slice(0, turns);
}
