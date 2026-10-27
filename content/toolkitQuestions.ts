import { cfsShares, cpusInMask, SIGNALS, UNCATCHABLE } from "@/game/sim/linuxtools";
import type { Question } from "@/game/engine/question";
import type { MoveType } from "@/game/engine/types";

/**
 * The Linux toolkit round: "which tool answers this question" matching, what
 * the /proc files hold, signals, nice, taskset and ulimit. Facts come from
 * `game/sim/linuxtools.ts`, which tests check against the kernel's tables.
 */
const mv = (name: string, type: MoveType, power: number) => ({ name, type, power });

const shareOfNice0 = Math.round(cfsShares([0, 5])[0] * 1000) / 10;

export const TOOLKIT_QUESTIONS: Question[] = [
  {
    id: "tk-which-swap",
    prompt: "Latency spiked and you suspect the host is swapping and its tasks are blocked on I/O. Which one command shows si/so, the blocked count (b) and wa in one view?",
    options: ["lsof -p PID", "vmstat 1", "ltrace -p PID", "cat /proc/PID/maps"],
    answer: 1,
    explain: "vmstat prints one line per interval: r and b (runnable and blocked tasks), swpd/free, si/so (swap in and out), bi/bo (block I/O), cs and the us/sy/id/wa CPU split. lsof lists open files, ltrace traces library calls and /proc/PID/maps shows one process's address space.",
    move: mv("Vital Scan", "io", 34),
  },
  {
    id: "tk-which-disk",
    prompt: "vmstat shows wa at 80%. Which tool tells you which disk is saturated, with per-request latency (await) and %util?",
    options: ["iostat -x 1", "free -m", "taskset -p PID", "strace -c"],
    answer: 0,
    explain: "iostat -x reports each block device separately: reads and writes per second, queue size, await (average time a request spends queued plus served) and %util. free only counts memory, taskset reads CPU affinity and strace -c counts system calls.",
    move: mv("Disk Probe", "io", 34),
  },
  {
    id: "tk-which-syscalls",
    prompt: "A process is slow but not CPU-bound. Which command attaches to it and summarises which system calls it makes, how many and how long each takes?",
    options: ["perf top", "ps -eo state,pid,comm", "ulimit -a", "strace -c -p PID"],
    answer: 3,
    explain: "strace -c counts every system call with time and errors, so a flood of futex or slow read calls stands out. perf top samples CPU functions instead, ps shows process states and ulimit -a prints the shell's resource limits.",
    move: mv("Syscall Trace", "io", 36),
  },
  {
    id: "tk-which-hotfn",
    prompt: "A service pegs a core at 100% user time. Which tool samples the CPU and shows which functions burn the cycles?",
    options: ["perf top", "lsof", "iostat", "vmstat"],
    answer: 0,
    explain: "perf top (or perf record then perf report) samples where the CPU is executing and ranks functions by their share, which finds a hot loop or a spin lock. vmstat and iostat only show that the CPU is busy, and lsof lists files.",
    move: mv("Hot Spot", "scheduler", 36),
  },
  {
    id: "tk-fd-leak",
    kind: "multi",
    prompt: "You suspect a process leaks file descriptors. Which commands let you count or list its open descriptors? Pick all that apply.",
    options: ["ls /proc/PID/fd | wc -l", "lsof -p PID", "vmstat 1", "cat /proc/PID/limits"],
    answers: [0, 1],
    explain: "/proc/PID/fd has one symlink per open descriptor, and lsof -p PID lists them with the file or socket each one points to. vmstat is system-wide and /proc/PID/limits shows the limit (Max open files) rather than how many are used.",
    move: mv("Handle Count", "io", 34),
  },
  {
    id: "tk-proc-files",
    prompt: "Which /proc file shows a process's VmRSS, its thread count and its voluntary and involuntary context switches?",
    options: ["/proc/PID/maps", "/proc/PID/fd", "/proc/PID/status", "/proc/meminfo"],
    answer: 2,
    explain: "/proc/PID/status is the human-readable summary: State, Threads, VmSize, VmRSS and voluntary_ctxt_switches / nonvoluntary_ctxt_switches. maps lists the mapped regions, fd the open descriptors and /proc/meminfo is system-wide.",
    move: mv("Process Sheet", "process", 34),
  },
  {
    id: "tk-signals",
    kind: "multi",
    prompt: "Which of these signals can a process neither catch, block nor ignore? Pick all that apply.",
    options: ["SIGKILL (9)", "SIGTERM (15)", "SIGSTOP (19)", "SIGINT (2)"],
    answers: [0, 2],
    explain: `${UNCATCHABLE.join(" and ")} are handled by the kernel itself so an administrator can always stop or kill a runaway process (on x86-64, SIGKILL is ${SIGNALS.SIGKILL} and SIGSTOP is ${SIGNALS.SIGSTOP}). SIGTERM (${SIGNALS.SIGTERM}) and SIGINT (${SIGNALS.SIGINT}) can be handled, which is why you try SIGTERM first so the process can clean up.`,
    move: mv("Signal Cut", "process", 36),
  },
  {
    id: "tk-nice-share",
    kind: "numeric",
    prompt: "Two CPU-bound processes share one core under CFS, one at nice 0 (weight 1024) and one at nice 5 (weight 335). What percentage of the CPU does the nice 0 process get?",
    answer: shareOfNice0,
    tolerance: 0.2,
    unit: "%",
    explain: "CFS gives each runnable task a share proportional to its weight: 1024 / (1024 + 335) = 75.4%. Each nice step changes the weight by about 1.25x, so five steps give roughly a 3:1 ratio. Nice only matters while tasks compete for the CPU.",
    move: mv("Weighted Slice", "scheduler", 36),
  },
  {
    id: "tk-taskset",
    prompt: "`taskset 0x5 ./worker` runs a program with which CPU affinity?",
    options: ["CPUs 0 and 5", "CPU 5 only", "CPUs 0 and 2", "CPUs 1 and 3"],
    answer: 2,
    explain: `The mask is a bit set with bit n meaning CPU n. 0x5 is binary 101, so bits 0 and 2 are set: CPUs ${cpusInMask("0x5").join(" and ")}. The same affinity is written taskset -c 0,2.`,
    move: mv("Core Pin", "scheduler", 34),
  },
  {
    id: "tk-ulimit",
    kind: "numeric",
    prompt: "A server runs with `ulimit -n 1024`. Descriptors are numbered from 0 (0, 1, 2 are stdin, stdout, stderr). What is the highest descriptor number it can ever hold?",
    answer: 1023,
    tolerance: 0,
    explain: "The limit is the number of descriptors, so numbers run 0 to 1023. The next open(), socket() or accept() fails with EMFILE (Too many open files). Raise the soft limit with ulimit -n or LimitNOFILE in systemd, but first make sure the process is not leaking.",
    move: mv("Handle Cap", "io", 34),
  },
  {
    id: "tk-free-avail",
    prompt: "`free -m` shows 200 MB in the free column but 6 GB in available, with 6 GB in buff/cache. Is the machine short of memory?",
    options: ["Yes: only 200 MB is free, so the OOM killer is close", "No: available counts cache the kernel can drop, so about 6 GB can be handed to programs", "Yes: cache cannot be reclaimed once it is used", "No: available is swap that is still unused"],
    answer: 1,
    explain: "Linux uses spare RAM as page cache, so free is usually small. available estimates what new programs can get without swapping: free memory plus the reclaimable part of the cache. Worry when available is small, not free.",
    move: mv("Cache Read", "memory", 34),
  },
  {
    id: "tk-triage",
    kind: "order",
    prompt: "Put these steps of a first-pass triage of a slow Linux server in a sensible order.",
    steps: ["uptime / top: look at load average and the CPU split", "vmstat 1: is it swapping, or are tasks blocked on I/O?", "iostat -x 1: which disk is saturated?", "pidstat or ps: which process is responsible?", "strace -p or perf top on that process: what is it doing?"],
    explain: "Work from the whole system down to a single process: load and CPU split first, then memory and I/O for the system, then the device, then the offending process, and last a system-call or CPU profile of that process. Each step narrows what the next tool needs to answer.",
    move: mv("Triage Sweep", "scheduler", 38),
  },
];
