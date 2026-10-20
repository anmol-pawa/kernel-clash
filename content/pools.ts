import { dueFirst, type Deck } from "@/game/engine/leitner";
import type { Generator, Question } from "@/game/engine/question";
import { rng } from "@/lib/rng";
import { BASICS_GENERATORS } from "./basicsGenerators";
import { PROCESS_GENERATORS } from "./processGenerators";
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

export const POOLS: Record<string, Pool> = {
  basics: { authored: [...GYM_QUESTIONS.basics, ...BASICS_EXTRA], generators: BASICS_GENERATORS },
  processes: { authored: [...GYM_QUESTIONS.processes, ...PROCESSES_EXTRA], generators: PROCESS_GENERATORS },
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
