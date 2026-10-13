import type { MultiQ, OrderQ } from "@/game/engine/question";

/**
 * The first select-all and order-the-steps questions (OS basics and
 * processes). Each answer is checked in tests/question.test.ts.
 */
export const PCB_CONTENTS: MultiQ = {
  kind: "multi",
  id: "multi-pcb",
  prompt: "Which of these does a process's PCB hold? Select all that apply.",
  options: ["Program counter", "Saved CPU registers", "Process state", "Contents of the CPU caches", "Other processes' page tables", "List of open files"],
  answers: [0, 1, 2, 5],
  explain: "The PCB holds what the OS needs to stop and resume a process: state, PC, registers, scheduling and memory-management info, and open files. Cache contents belong to the hardware, and each process's own PCB points only to its own page table.",
  move: { name: "Context Swap", type: "scheduler", power: 36 },
};

export const SYSCALL_STEPS: OrderQ = {
  kind: "order",
  id: "order-syscall",
  prompt: "Put the steps of a system call such as read() in order.",
  steps: [
    "The program puts the system-call number and arguments in registers",
    "It executes the trap (syscall) instruction",
    "The CPU switches to kernel mode and jumps to the trap handler",
    "The kernel looks up the number in the system-call table and runs the handler",
    "Return-from-trap switches back to user mode after the call",
  ],
  explain: "The trap is the only door into the kernel: the hardware switches mode and jumps to a fixed handler, which dispatches through the system-call table, then returns to user mode with the result in a register.",
  move: { name: "Syscall Surge", type: "io", power: 32 },
};

export const SAMPLE_QUESTIONS = [PCB_CONTENTS, SYSCALL_STEPS];
