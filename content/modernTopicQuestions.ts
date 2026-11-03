import { NICE_0_WEIGHT, avgVruntime, psi, ringSizes, submitSyscalls, virtualDeadline, type EevdfTask, type PsiTick } from "@/game/sim/modern";
import { cpuShares } from "@/game/sim/containers";
import type { Question } from "@/game/engine/question";
import type { MoveType } from "@/game/engine/types";

/**
 * EEVDF, io_uring and cgroup v2 / PSI, five questions each (as of October
 * 2026, see docs/FRESHNESS.md). Numbers come from `game/sim/modern.ts`.
 */
const mv = (name: string, type: MoveType, power: number) => ({ name, type, power });

export const EEVDF_TASKS: EevdfTask[] = [
  { name: "A", weight: NICE_0_WEIGHT, vruntime: 100, sliceMs: 30 },
  { name: "B", weight: NICE_0_WEIGHT, vruntime: 118, sliceMs: 2 },
  { name: "C", weight: NICE_0_WEIGHT, vruntime: 100, sliceMs: 24 },
];
export const HEAVY: EevdfTask = { name: "H", weight: 2048, vruntime: 90, sliceMs: 4 };

/** Ten one-second samples: [non-idle tasks, stalled tasks]. */
export const PSI_TICKS: PsiTick[] = [[3, 0], [3, 1], [3, 3], [2, 2], [3, 0], [3, 2], [2, 0], [3, 3], [3, 1], [2, 0]].map(([nonidle, stalled]) => ({ nonidle, stalled }));

const shares = cpuShares([100, 300, 100]);

/** Moves the keyed option of a multiple-choice question to slot `k` (keeps the other options in order). */
const keyAt = (q: Question, k: number): Question => {
  if (q.kind !== undefined && q.kind !== "mcq") return q;
  const keyed = q.options[q.answer];
  const rest = q.options.filter((_, i) => i !== q.answer);
  rest.splice(k, 0, keyed);
  return { ...q, options: rest, answer: k };
};

const RAW: Question[] = [
  {
    id: "mt-eevdf-avg",
    kind: "numeric",
    prompt: "EEVDF model: three equal-weight tasks A, B, C have vruntime 100, 118 and 100. What is the average virtual time V?",
    answer: avgVruntime(EEVDF_TASKS),
    unit: "vruntime",
    explain: "V is the weight-averaged vruntime: (100 + 118 + 100) / 3 = 106. A task's lag is V minus its own vruntime, so A and C are owed 6 units each and B is 12 ahead of its fair share.",
    move: mv("Fair Average", "scheduler", 34),
  },
  {
    id: "mt-eevdf-pick",
    prompt: "Same tasks (equal weights): A has vruntime 100 and a 30 ms slice, B has 118 and 2 ms, C has 100 and 24 ms. V is 106. Which does EEVDF run next?",
    options: ["B, it has the earliest virtual deadline (120)", "C: it is eligible, and its deadline (124) beats A's (130)", "A, it has the lowest vruntime and the longest slice", "Whichever arrived first"],
    answer: 1,
    explain: "Deadline = vruntime + slice (equal weights): A 130, B 120, C 124. B's deadline is earliest, but its lag is negative (118 > V = 106), so it is not eligible yet. Among eligible tasks A and C, C's deadline is earlier. Eligibility first, then earliest virtual deadline (as of October 2026, EEVDF in mainline since 6.6).",
    move: mv("Eligible First", "scheduler", 38),
  },
  {
    id: "mt-eevdf-lag",
    prompt: "In EEVDF, what does a task with negative lag mean?",
    options: ["It has had more than its fair share so far, so it is not eligible until the others catch up", "It is blocked on I/O", "It is a real-time task", "Its nice value is negative"],
    answer: 0,
    explain: "Lag is the service a task is owed: the fair share minus what it received. Negative lag means it ran ahead of its share, so it is ineligible and cannot be picked even if its deadline is early. Lag across all runnable tasks sums to zero.",
    move: mv("Lag Ledger", "scheduler", 34),
  },
  {
    id: "mt-eevdf-latency",
    prompt: "How can a latency-sensitive task get picked sooner under EEVDF without receiving more total CPU time?",
    options: ["Ask for a shorter slice: its virtual deadline comes earlier, so it wins the pick more often, but its weight, and so its share, is unchanged", "Raise its nice value", "Disable preemption for it", "Pin it to CPU 0"],
    answer: 0,
    explain: "The deadline is vruntime plus slice scaled by weight, so a shorter requested slice means an earlier deadline. Recent kernels (6.12 and later) let a task suggest its slice through sched_attr.sched_runtime. The trade-off is more preemptions; the long-run share is still set by weight. Classic CFS had no such deadline notion.",
    move: mv("Short Slice", "scheduler", 36),
  },
  {
    id: "mt-eevdf-deadline",
    kind: "numeric",
    prompt: "EEVDF model: a task of weight 2048 (nice-0 is 1024) has vruntime 90 and asks for a 4 ms slice. What is its virtual deadline?",
    answer: virtualDeadline(HEAVY),
    unit: "vruntime",
    explain: "The slice is scaled by weight: 4 x 1024 / 2048 = 2 virtual units, so the deadline is 90 + 2 = 92. A heavier task consumes virtual time more slowly, which is how weights turn into larger CPU shares.",
    move: mv("Virtual Deadline", "scheduler", 36),
  },
  {
    id: "mt-uring-calls",
    kind: "numeric",
    prompt: "An app issues 1000 reads. With one read() per operation that is 1000 system calls. Using io_uring and submitting 32 queue entries per io_uring_enter, how many submission syscalls does it need?",
    answer: submitSyscalls(1000, "io_uring", 32),
    unit: "calls",
    explain: "ceil(1000 / 32) = 32. The app writes entries into the shared submission ring and one io_uring_enter hands the whole batch to the kernel. Fewer mode switches is the point, though each call also does more work.",
    move: mv("Batch Submit", "io", 36),
  },
  {
    id: "mt-uring-rings",
    prompt: "What are the io_uring submission queue (SQ) and completion queue (CQ)?",
    options: ["Two ring buffers shared between the application and the kernel through mmap: the app posts requests to the SQ and reads results from the CQ", "Two kernel threads", "Two files in /proc", "Two syscall tables"],
    answer: 0,
    explain: "Because both rings live in shared memory, posting a request or reaping a result needs no copy and, with batching or polling, often no syscall. Each request carries a user_data tag so the matching completion can be found, since completions may arrive out of order.",
    move: mv("Shared Rings", "io", 36),
  },
  {
    id: "mt-uring-size",
    kind: "numeric",
    prompt: "io_uring_setup(100, ...) is called with default flags. How many entries does the completion queue get?",
    answer: ringSizes(100).cq,
    unit: "entries",
    explain: "The submission ring size is rounded up to a power of two (128) and the completion ring defaults to twice that: 256. Completions outnumber submissions in flight easily, for example with multishot requests, so the CQ is larger by default.",
    move: mv("Ring Sizing", "io", 34),
  },
  {
    id: "mt-uring-sqpoll",
    prompt: "What does IORING_SETUP_SQPOLL do?",
    options: ["A kernel thread polls the submission ring, so the app can submit without a system call while that thread is awake, at the cost of a busy CPU", "It makes all I/O synchronous", "It disables the completion queue", "It batches 32 requests automatically"],
    answer: 0,
    explain: "With SQPOLL the application just writes entries and updates the ring tail. The poller thread picks them up, and it goes to sleep after an idle timeout, after which the app must wake it with io_uring_enter. It trades CPU for lower submission latency.",
    move: mv("Poll Thread", "io", 38),
  },
  {
    id: "mt-uring-vs-epoll",
    prompt: "How does io_uring differ from epoll for reading a socket or file?",
    options: ["epoll reports that a descriptor is ready and you still call read(); io_uring performs the read for you and reports completion", "They are the same", "epoll works for regular files and io_uring does not", "io_uring only reports readiness"],
    answer: 0,
    explain: "epoll is a readiness model: wait, then issue the read yourself. io_uring is a completion model: submit the operation, and the kernel does it and posts the result, which also gives asynchronous file I/O that epoll cannot offer (epoll does not report readiness for regular files).",
    move: mv("Completion Model", "io", 36),
  },
  {
    id: "mt-psi-some",
    kind: "numeric",
    prompt: "Ten one-second samples of (non-idle tasks, stalled tasks) on memory: (3,0) (3,1) (3,3) (2,2) (3,0) (3,2) (2,0) (3,3) (3,1) (2,0). What is the PSI `some` share, in percent?",
    answer: psi(PSI_TICKS).some,
    unit: "%",
    explain: "`some` counts seconds with at least one stalled task: samples 2, 3, 4, 6, 8 and 9 = 6 of 10, so 60%.",
    move: mv("Some Stall", "memory", 36),
  },
  {
    id: "mt-psi-full",
    kind: "numeric",
    prompt: "Same ten samples: (3,0) (3,1) (3,3) (2,2) (3,0) (3,2) (2,0) (3,3) (3,1) (2,0). What is the PSI `full` share, in percent?",
    answer: psi(PSI_TICKS).full,
    unit: "%",
    explain: "`full` counts seconds where every non-idle task was stalled: samples 3, 4 and 8, so 3 of 10 = 30%. At those moments the CPU did no useful work for this resource. Full is never above some.",
    move: mv("Full Stall", "memory", 36),
  },
  {
    id: "mt-cg-noint",
    prompt: "What does cgroup v2's \"no internal processes\" rule say?",
    options: ["A non-root cgroup that enables controllers for its children cannot hold processes itself; processes live in the leaves", "Processes may not be in any cgroup", "Only the root cgroup may have children", "Each process must be in one cgroup per controller"],
    answer: 0,
    explain: "v2 has a single hierarchy and a process belongs to exactly one cgroup in it. To keep resource accounting between a parent's own processes and its children unambiguous, a cgroup that distributes controllers to children has no processes of its own (the root is exempt). v1 allowed one hierarchy per controller.",
    move: mv("Leaf Rule", "process", 36),
  },
  {
    id: "mt-cg-high-max",
    prompt: "In cgroup v2, a container exceeds memory.high but is below memory.max. What happens?",
    options: ["Its allocations are throttled and reclaim is forced, but it is not OOM-killed for crossing high", "The kernel immediately kills it", "Nothing; high is only a statistic", "It is moved to swap entirely"],
    answer: 0,
    explain: "memory.high is a soft ceiling: the cgroup is slowed down and pushed to reclaim, giving a signal before disaster. memory.max is the hard limit: if reclaim cannot get usage below it, the cgroup's OOM handling runs.",
    move: mv("Soft Ceiling", "memory", 36),
  },
  {
    id: "mt-cg-weight",
    kind: "numeric",
    prompt: "Three busy cgroups have cpu.weight 100, 300 and 100 on a saturated CPU. What percent of the CPU does the 300 cgroup get?",
    answer: Math.round(shares[1] * 100),
    unit: "%",
    explain: "Weights are proportional shares only under contention: 300 / (100 + 300 + 100) = 60%. An idle cgroup does not reserve anything, unlike cpu.max, which is a hard cap.",
    move: mv("Weight Share", "scheduler", 34),
  },
];

const SLOTS: Record<string, number> = { "mt-eevdf-pick": 1, "mt-eevdf-lag": 2, "mt-eevdf-latency": 3, "mt-uring-rings": 1, "mt-uring-sqpoll": 2, "mt-uring-vs-epoll": 3, "mt-cg-noint": 2, "mt-cg-high-max": 1 };
export const MODERN_TOPIC_QUESTIONS: Question[] = RAW.map((q) => (q.id in SLOTS ? keyAt(q, SLOTS[q.id]) : q));
