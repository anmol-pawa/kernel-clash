import type { Question } from "@/game/engine/question";
import type { MoveType } from "@/game/engine/types";

/**
 * Modern Linux internals, checked as of October 2026: sched_ext (6.12),
 * PSI (4.20), eBPF verifier, MGLRU (6.1), folios (5.16) and transparent huge
 * pages. See docs/FRESHNESS.md.
 */
const mv = (name: string, type: MoveType, power: number) => ({ name, type, power });

export const MODERN_LINUX_QUESTIONS: Question[] = [
  {
    id: "ml-sched-ext",
    prompt: "What is sched_ext (mainline since Linux 6.12)?",
    options: ["A scheduling class whose policy is written as a BPF program loaded at run time, with the kernel falling back to the fair scheduler if that program misbehaves", "A replacement for the EEVDF fair scheduler that is compiled in by default", "A real-time class for hard deadlines", "A user-space library that pins threads to CPUs"],
    answer: 0,
    explain: "sched_ext lets you implement a scheduler as BPF code and swap it in without rebuilding the kernel, which makes scheduler experiments much cheaper. It is opt-in per task (a separate scheduling policy), and a watchdog ejects a BPF scheduler that stalls runnable tasks, returning them to the fair class. It extends EEVDF's world; it does not replace it. (As of October 2026.)",
    move: mv("Pluggable Policy", "scheduler", 38),
  },
  {
    id: "ml-psi-meaning",
    prompt: "/proc/pressure/memory shows `some avg10=30.00`. What does that say?",
    options: ["Over the last 10 seconds, at least one runnable task was stalled waiting for memory about 30% of the time", "30% of RAM is free", "30% of page faults needed disk I/O", "The system swapped 30 pages per second"],
    answer: 0,
    explain: "Pressure stall information (PSI, Linux 4.20) measures lost time, not usage. `some` is the share of time at least one task was stalled on the resource; `full` is the share of time all non-idle tasks were stalled at once, so the CPU did no useful work. Because it is time-based it flags a thrashing system long before free-memory numbers look alarming.",
    move: mv("Pressure Gauge", "memory", 36),
  },
  {
    id: "ml-ebpf-verifier",
    prompt: "Why can an unprivileged-looking eBPF program be loaded into the kernel without being able to crash it?",
    options: ["The kernel interprets it in a separate process", "The verifier statically checks it before load: bounded execution, in-range memory access and only allowed helper calls", "It runs only in user space", "Every instruction is signed by the hardware"],
    answer: 1,
    explain: "Before an eBPF program runs, the in-kernel verifier walks every path and rejects code that might loop without bound, read or write out of range, or call something not permitted for its program type. Accepted programs are then JIT-compiled to native code. (Loading still needs privileges such as CAP_BPF; the verifier is about safety, not permission.)",
    move: mv("Verified Probe", "process", 36),
  },
  {
    id: "ml-mglru",
    prompt: "What did the multi-generational LRU (MGLRU, mainline since Linux 6.1) change about page reclaim?",
    options: ["It removed swapping", "It sorts pages into several age generations instead of only an active and an inactive list, to choose better victims at lower CPU cost", "It made every page 2 MB", "It reclaims only file pages"],
    answer: 1,
    explain: "The classic two-list scheme (active/inactive) had to scan a lot to find cold pages. MGLRU tracks multiple generations by age and uses page-table access bits more efficiently, which cut reclaim CPU and bad evictions on large-memory machines. It is controlled via /sys/kernel/mm/lru_gen/enabled. The textbook LRU and clock ideas still describe the goal. (As of October 2026.)",
    move: mv("Generation Sweep", "memory", 38),
  },
  {
    id: "ml-folio",
    prompt: "In modern Linux memory management, what is a folio?",
    options: ["A page-table level between PMD and PUD", "A swap slot", "A handle for one or more physically contiguous pages managed as a single unit, so the page cache and reclaim need not guess whether they hold a head or tail page", "A cgroup memory limit"],
    answer: 2,
    explain: "Folios (introduced in Linux 5.16) make 'a power-of-two group of contiguous pages' a first-class type. Page cache, readahead and file systems are being converted to folios, which cuts per-page overhead for large I/O and allows large folios in the page cache. A single 4 KB page is just a folio of order 0.",
    move: mv("Page Bundle", "memory", 34),
  },
  {
    id: "ml-thp-madvise",
    prompt: "A latency-sensitive database sees occasional multi-millisecond stalls. /sys/kernel/mm/transparent_hugepage/enabled is `always`. What is a common mitigation?",
    options: ["Set it to `madvise` (or `never`) so only regions that ask for huge pages get them", "Disable the TLB", "Increase the page size to 1 GB for everything", "Turn on swap"],
    answer: 0,
    explain: "With `always`, the kernel tries to back anonymous memory with 2 MB pages, and allocating or compacting a contiguous 2 MB block (or khugepaged collapsing pages) can stall the application. `madvise` limits huge pages to regions that opt in with madvise(MADV_HUGEPAGE). Huge pages still help TLB reach for large heaps, so the choice is a trade-off to measure, not a rule. (As of October 2026.)",
    move: mv("Huge Page Toggle", "memory", 36),
  },
];
