import { dueFirst, type Deck } from "@/game/engine/leitner";
import type { Generator, Question } from "@/game/engine/question";
import { rng } from "@/lib/rng";
import { BASICS_GENERATORS } from "./basicsGenerators";
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

export const POOLS: Record<string, Pool> = {
  basics: { authored: [...GYM_QUESTIONS.basics, ...BASICS_EXTRA], generators: BASICS_GENERATORS },
};

/** How many questions a boss battle asks (the balance tests assume six). */
export const BATTLE_TURNS = 6;

/**
 * A gym battle's questions. With a pool: the authored questions plus one
 * problem per generator (seeded from `seed`), shuffled by `seed`, due
 * Leitner cards first, the first BATTLE_TURNS of them. Without one: the six
 * boss questions, due cards first.
 */
export function gymBattleQuestions(gymId: string, seed: number, deck: Deck, now: number): Question[] {
  const pool = POOLS[gymId];
  if (!pool) return dueFirst(GYM_QUESTIONS[gymId] ?? [], deck, now);
  const all = [...pool.authored, ...pool.generators.map((g) => g.make(seed))];
  return dueFirst(rng(seed).shuffle(all), deck, now).slice(0, BATTLE_TURNS);
}
