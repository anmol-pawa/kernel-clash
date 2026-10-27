/**
 * Facts behind the Linux toolkit questions: signal numbers (x86-64 `kill -l`),
 * nice weights (shared by CFS and EEVDF; the kernel's `sched_prio_to_weight` table), `taskset`
 * affinity masks, `ulimit -n` semantics and which tool answers which question.
 */

/** x86-64 Linux signal numbers that interviews ask about. */
export const SIGNALS: Readonly<Record<string, number>> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGILL: 4,
  SIGABRT: 6,
  SIGBUS: 7,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGSEGV: 11,
  SIGUSR2: 12,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
  SIGCHLD: 17,
  SIGCONT: 18,
  SIGSTOP: 19,
  SIGTSTP: 20,
};

/** Signals a process can neither catch, block nor ignore. */
export const UNCATCHABLE: readonly string[] = ["SIGKILL", "SIGSTOP"];

/** `sched_prio_to_weight`, indexed by nice + 20 (nice -20 first). */
export const NICE_WEIGHTS: readonly number[] = [
  88761, 71755, 56483, 46273, 36291, 29154, 23254, 18705, 14949, 11916, 9548, 7620, 6100, 4904, 3906, 3121, 2501, 1991, 1586, 1277, 1024, 820,
  655, 526, 423, 335, 272, 215, 172, 137, 110, 87, 70, 56, 45, 36, 29, 23, 18, 15,
];

export const niceWeight = (nice: number): number => {
  if (!Number.isInteger(nice) || nice < -20 || nice > 19) throw new Error("nice must be an integer in [-20, 19]");
  return NICE_WEIGHTS[nice + 20];
};

/** CPU share (0..1) of each always-runnable task sharing one core under CFS or EEVDF (same weights). */
export const cfsShares = (nices: readonly number[]): number[] => {
  const weights = nices.map(niceWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / total);
};

/** CPUs allowed by a `taskset` hex mask, lowest CPU first. */
export const cpusInMask = (mask: string): number[] => {
  const m = mask.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(m)) throw new Error("mask must be hexadecimal");
  const cpus: number[] = [];
  // the last hex digit holds CPUs 0-3, the one before it CPUs 4-7, and so on
  [...m].reverse().forEach((digit, i) => {
    const v = parseInt(digit, 16);
    for (let bit = 0; bit < 4; bit++) if (v & (1 << bit)) cpus.push(i * 4 + bit);
  });
  return cpus;
};

/** The hex mask (no 0x prefix) that allows exactly `cpus`. */
export const maskOf = (cpus: readonly number[]): string => {
  const digits: number[] = [];
  for (const c of cpus) {
    const i = Math.floor(c / 4);
    while (digits.length <= i) digits.push(0);
    digits[i] |= 1 << c % 4;
  }
  const hex = digits.reverse().map((d) => d.toString(16)).join("");
  return hex.replace(/^0+(?=.)/, "") || "0";
};

/** Whether `accept()`/`open()`/`socket()` can still succeed under `ulimit -n`: fds are numbered from 0, so the limit counts 0..limit-1. */
export const canOpenFd = (openFds: number, limit: number): boolean => openFds < limit;

export interface ToolFact {
  tool: string;
  /** the question the tool answers */
  answers: string;
}

/** The "which tool answers this question" table. */
export const TOOL_FACTS: readonly ToolFact[] = [
  { tool: "vmstat 1", answers: "Is the box swapping or blocked on I/O? (si/so, b, wa columns)" },
  { tool: "iostat -x 1", answers: "Which disk is saturated? (await, aqu-sz, %util per device)" },
  { tool: "lsof -p PID", answers: "Which files and sockets does this process hold open?" },
  { tool: "strace -c -p PID", answers: "Which system calls does the process make, how often and how slowly?" },
  { tool: "ltrace", answers: "Which shared-library calls (malloc, strlen...) does the program make?" },
  { tool: "perf top", answers: "Which functions burn the CPU cycles?" },
  { tool: "cat /proc/PID/maps", answers: "What does the process's virtual address space look like (heap, stack, libraries, mmaps)?" },
  { tool: "cat /proc/PID/status", answers: "What are the process's state, threads, VmRSS and context-switch counts?" },
  { tool: "free -m", answers: "How much memory is truly available (free + reclaimable cache)?" },
  { tool: "ps -eo state,pid,comm", answers: "Which processes are in D (uninterruptible) or Z (zombie) state?" },
];
