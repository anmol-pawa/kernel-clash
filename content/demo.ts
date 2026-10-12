import type { MoveType } from "@/game/engine/types";

/** A multiple-choice question that powers one move. `answer` indexes `options`. */
export interface Mcq {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  answer: number;
  explain: string;
  move: { name: string; type: MoveType; power: number };
}

/** The demo battle's questions (OS basics + processes). Each has a test. */
export const DEMO_QUESTIONS: Mcq[] = [
  {
    id: "demo-mode",
    prompt: "Which CPU mode may execute privileged instructions?",
    options: ["User mode", "Kernel mode", "Any mode", "Idle mode"],
    answer: 1,
    explain: "Privileged instructions (I/O, interrupt control, page-table changes) run only in kernel (supervisor) mode; user code must ask via a system call.",
    move: { name: "Trap Strike", type: "process", power: 30 },
  },
  {
    id: "demo-fork",
    prompt: "What does fork() return in the newly created child process?",
    options: ["The parent's PID", "The child's PID", "0", "-1"],
    answer: 2,
    explain: "fork() returns 0 in the child and the child's PID in the parent; -1 means the fork failed.",
    move: { name: "Fork Bomb", type: "process", power: 34 },
  },
  {
    id: "demo-state",
    prompt: "A process waiting for a disk read to finish is in which state?",
    options: ["Running", "Ready", "Waiting (blocked)", "Terminated"],
    answer: 2,
    explain: "It cannot run until the I/O completes, so it is waiting (blocked). When the read finishes it moves to ready, not straight to running.",
    move: { name: "Block Bash", type: "io", power: 32 },
  },
  {
    id: "demo-pcb",
    prompt: "During a context switch, where does the OS save a process's registers and program counter?",
    options: ["In its PCB", "On the disk swap area", "In the TLB", "In the ready queue"],
    answer: 0,
    explain: "The process control block (PCB) holds the saved CPU context, so the process can resume exactly where it stopped.",
    move: { name: "Context Swap", type: "scheduler", power: 36 },
  },
  {
    id: "demo-syscall",
    prompt: "How does a user program request a service from the kernel, such as reading a file?",
    options: ["A function call into kernel memory", "A system call (trap)", "Writing to the PCB", "A context switch"],
    answer: 1,
    explain: "A system call executes a trap instruction that switches the CPU to kernel mode and jumps to a kernel handler.",
    move: { name: "Syscall Surge", type: "io", power: 30 },
  },
];
