import type { IncidentQ } from "@/game/engine/question";
import type { MoveType } from "@/game/engine/types";

/**
 * Production-incident questions for the Kernel Summit: a short story, the
 * tool output an on-call engineer would see, and 2-3 chained questions. Each
 * answer is justified from the printed numbers, which are internally
 * consistent (load vs CPU split, free vs cache, run queue vs blocked).
 */
const mv = (name: string, type: MoveType, power: number) => ({ name, type, power });

export const INCIDENT_QUESTIONS: IncidentQ[] = [
  {
    id: "inc-io-wait",
    kind: "incident",
    prompt: "Page at 02:10: the orders API times out. The database host shows a load average near 15, yet the on-call dashboard says the CPUs look idle. You SSH in and run a few tools.",
    outputs: [
      {
        cmd: "top -bn1 | head -5",
        text: [
          "top - 02:11:40 up 41 days,  load average: 14.82, 13.97, 9.40",
          "Tasks: 211 total,   1 running, 210 sleeping,   0 zombie",
          "%Cpu(s):  3.1 us,  2.0 sy,  0.0 ni, 11.9 id, 83.0 wa,  0.0 hi",
          "MiB Mem :  15880 total,    402 free,     20 buffers,   1849 cache",
          "MiB Swap:   4096 total,   4096 free,      0 used",
        ].join("\n"),
      },
      {
        cmd: "vmstat 1 3",
        text: [
          "procs ------memory------ --swap-- ---io--- -system- ------cpu-----",
          " r  b   swpd   free   si   so    bi    bo   in   cs us sy id wa st",
          " 1 14      0 412344    0    0 18420   310 2210 4120  3  2 12 83  0",
          " 0 14      0 412120    0    0 19110   285 2188 4098  2  2 11 85  0",
          " 1 13      0 411986    0    0 18760   402 2240 4155  3  2 13 82  0",
        ].join("\n"),
      },
      {
        cmd: "ps -eo state,pid,comm | sort | uniq -c -w1",
        text: ["      1 R  4412 top", "    196 S  1 systemd", "     14 D  3107 postgres"].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What is the bottleneck?",
        options: ["The CPUs are saturated", "Memory is exhausted and the host is swapping", "Disk I/O: tasks are blocked waiting for storage", "A runaway process is leaking file descriptors"],
        answer: 2,
        why: "us+sy is only 5% and idle is about 12%, so the CPUs are not busy. But wa is 83%, vmstat shows b=14 tasks blocked, bi is about 18,000 blocks/s and ps shows 14 postgres processes in D state. Swap is untouched (si/so = 0), so it is not paging.",
      },
      {
        ask: "Which tool do you run next?",
        options: ["perf top, to find the hot function", "iostat -x 1, to see which device has high await and %util", "free -m, to look for a memory leak", "strace -c on PID 1"],
        answer: 1,
        why: "The wait is on storage, so you need the per-device view: await (latency per request), queue size and %util show whether one disk is saturated. perf top and strace look at CPU and system calls, which are idle here.",
      },
      {
        ask: "kill -9 on the 14 stuck postgres processes does nothing. Why?",
        options: ["postgres traps SIGKILL", "The processes are in uninterruptible sleep (D) and only act on signals when the I/O completes", "Only the parent can kill a child", "They are zombies, which are already dead"],
        answer: 1,
        why: "State D is uninterruptible sleep: the task is inside the kernel waiting for a disk request and cannot be woken by a signal, SIGKILL included, until the I/O finishes. SIGKILL cannot be trapped, and these are not zombies (the zombie count is 0).",
      },
    ],
    explain: "High load with idle CPU is the classic signature of I/O wait: Linux counts tasks in D state in the load average, so load rises while us+sy stay low. Read wa and b in vmstat, confirm D states in ps, then drill into the device with iostat.",
    move: mv("Triage", "io", 30),
  },
  {
    id: "inc-oom",
    kind: "incident",
    prompt: "Page at 14:52: the search service restarts every few hours with no crash report. Latency climbs for an hour before each restart. You log in to the host right after the latest one.",
    outputs: [
      {
        cmd: "dmesg -T | grep -i -A2 'out of memory'",
        text: [
          "[Tue 14:51:07] Out of memory: Killed process 8123 (indexer)",
          "  total-vm:31457280kB, anon-rss:15728640kB, file-rss:0kB",
          "[Tue 14:51:07] oom_reaper: reaped process 8123 (indexer)",
        ].join("\n"),
      },
      {
        cmd: "free -m",
        text: [
          "              total   used   free  shared  buff/cache  available",
          "Mem:          16384  15902    118       4         364        161",
          "Swap:             0      0      0",
        ].join("\n"),
      },
      {
        cmd: "ps -eo pid,rss,etimes,comm --sort=-rss | head -3",
        text: ["    PID     RSS ELAPSED COMMAND", "   9040 15481212    3011 indexer", "   1722   188340  901234 postgres"].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What killed the service?",
        options: ["A segfault in the indexer", "The kernel OOM killer reclaimed memory after RAM ran out with no swap", "systemd stopped it for a failed health check", "The disk filled up"],
        answer: 1,
        why: "dmesg shows 'Out of memory: Killed process 8123 (indexer)' with anon-rss of 15 GB on a 16 GB host. free shows 118 MB free and only 161 MB available (the cache is just 364 MB, so there is nothing cheap to drop) and swap is 0, so the kernel had no other way to get memory back.",
      },
      {
        ask: "What do you check next to find the cause?",
        options: ["Whether the new indexer is already growing: sample its RSS over time (ps, /proc/PID/status or smem)", "Reboot the host to clear memory", "Raise vm.swappiness", "Run fsck on the data disk"],
        answer: 0,
        why: "The replacement indexer (PID 9040) already has 15 GB RSS only 3011 s (50 min) after starting, so it grows without bound. Sampling its RSS (and a heap profile) shows the rate and confirms a leak. Swappiness is irrelevant with no swap, and a reboot only resets the clock.",
      },
      {
        ask: "Which change makes the failure safe while the leak is being fixed?",
        options: ["Turn off the OOM killer", "Run the indexer in a cgroup with a memory limit (and restart policy) so only it is killed and the host stays healthy", "Lower the indexer's nice value", "Add more CPU cores"],
        answer: 1,
        why: "A cgroup memory.max limit makes the OOM kill happen inside the group, at a predictable size, instead of the host running out and the kernel choosing a victim. Disabling the OOM killer would let allocations stall the machine, and nice or cores affect CPU, not memory.",
      },
    ],
    explain: "A process whose RSS grows until RAM is gone is killed by the kernel OOM killer; the evidence is the 'Out of memory: Killed process' line in dmesg plus near-zero free and available memory. Confirm the leak by watching RSS grow, then contain it with a cgroup limit.",
    move: mv("Triage", "memory", 30),
  },
  {
    id: "inc-zombies",
    kind: "incident",
    prompt: "Page at 09:30: the job runner can no longer start new jobs ('fork: Resource temporarily unavailable'). CPU and memory look fine. You check the process table.",
    outputs: [
      {
        cmd: "ps -eo pid,ppid,stat,comm | awk '$3 ~ /Z/' | head -4",
        text: [
          "  5101  2210 Z    job <defunct>",
          "  5102  2210 Z    job <defunct>",
          "  5103  2210 Z    job <defunct>",
          "  ...",
        ].join("\n"),
      },
      {
        cmd: "ps -eo stat | sort | uniq -c",
        text: ["      3 R", "    240 S", "  32520 Z"].join("\n"),
      },
      {
        cmd: "cat /proc/sys/kernel/pid_max; ps -p 2210 -o pid,stat,comm",
        text: ["32768", "  PID STAT COMMAND", " 2210 Sl   runner"].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What are the 32,520 Z processes?",
        options: ["Processes stuck waiting for disk I/O", "Children that have exited but whose parent has not called wait() to collect their exit status", "Threads spinning on a lock", "Processes swapped out to disk"],
        answer: 1,
        why: "State Z with <defunct> is a zombie: the process has exited and only its process-table entry remains until the parent reads the exit status with wait()/waitpid(). All of them share PPID 2210, the runner, which is alive in state Sl (sleeping) and is not reaping.",
      },
      {
        ask: "Why does fork() fail now, with CPU and RAM idle?",
        options: ["Zombies use all the CPU", "The kernel has run out of PIDs: 32,520 zombies plus 243 live tasks use 32,763 of the 32768 PIDs allowed by pid_max", "Zombies hold 4 GB of memory each", "fork is disabled once the load average passes 10"],
        answer: 1,
        why: "Each zombie still owns a PID. 32,520 + 243 live tasks is 32,763 of the 32,768 PIDs in use (the last few are reserved or taken by short-lived commands), so no PID is free and fork returns EAGAIN. Zombies hold essentially no memory or CPU, which is why those graphs look fine.",
      },
      {
        ask: "What is the real fix?",
        options: ["kill -9 each zombie", "Make the runner reap children (wait()/waitpid in a SIGCHLD handler, or SIGCHLD set to SIG_IGN); killing the runner also lets init adopt and reap the zombies", "Raise the nice value of the runner", "Reboot every night"],
        answer: 1,
        why: "A zombie is already dead, so SIGKILL has nothing to kill. Only the parent's wait() frees the entry. Fix the runner's code; as an immediate remedy, terminate the runner, because orphaned zombies are re-parented to init (PID 1), which reaps them immediately.",
      },
    ],
    explain: "Zombies cost a PID and a process-table slot, not CPU or memory, but enough of them exhaust pid_max and make fork fail. The cure is in the parent: reap with waitpid in a SIGCHLD handler, or exit the parent so init adopts them.",
    move: mv("Triage", "process", 30),
  },
  {
    id: "inc-pool-deadlock",
    kind: "incident",
    prompt: "Page at 16:05: after a traffic spike the checkout service stops answering. Nothing crashed and the host is nearly idle, but every request hangs until the load balancer times out. A restart fixes it for a few minutes.",
    outputs: [
      {
        cmd: "top -bn1 | head -4",
        text: [
          "top - 16:06:12 up 9 days,  load average: 0.12, 0.40, 0.22",
          "Tasks: 188 total,   0 running, 188 sleeping,   0 zombie",
          "%Cpu(s):  0.4 us,  0.2 sy,  0.0 ni, 99.3 id,  0.1 wa",
          "MiB Mem :  15880 total,  9120 free,  2210 used,  4550 cache",
        ].join("\n"),
      },
      {
        cmd: "ps -L -o tid,stat,wchan:20,comm -p 3301 | head -6",
        text: [
          "  TID STAT WCHAN                COMMAND",
          " 3301 Sl   futex_wait_queue     checkout",
          " 3340 Sl   futex_wait_queue     pool-1-worker-1",
          " 3341 Sl   futex_wait_queue     pool-1-worker-2",
          " 3342 Sl   futex_wait_queue     pool-1-worker-3",
          " 3343 Sl   futex_wait_queue     pool-1-worker-4",
        ].join("\n"),
      },
      {
        cmd: "thread dump (all 4 workers identical)",
        text: [
          '"pool-1-worker-1" WAITING',
          "  at Future.get(Future.java:193)",
          "  at CheckoutService.price(CheckoutService.java:58)",
          "  at CheckoutService.handle(CheckoutService.java:31)",
          "  at ThreadPoolExecutor.runWorker(...)",
          "queue: 37 pending tasks (pool size 4, all 4 busy)",
        ].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What does the output say about the problem?",
        options: ["The CPUs are saturated", "The process is blocked, not busy: every worker waits on a futex (a lock or condition) with the CPU 99% idle", "The disk is slow", "The kernel is out of memory"],
        answer: 1,
        why: "Load is 0.12 and idle is 99.3%, so nothing is computing. Every worker thread is in futex_wait_queue, the kernel wait used by locks and condition variables, and wa is 0.1 so it is not disk either. Memory is 9 GB free.",
      },
      {
        ask: "What is the root cause?",
        options: ["A data race corrupts the queue", "Thread-pool starvation deadlock: each of the 4 workers runs handle(), which submits price() to the same pool and blocks in Future.get() for it, but the sub-task sits in the queue behind them and no worker is free to run it", "The futex syscall is slow", "The load balancer is broken"],
        answer: 1,
        why: "The dump shows workers inside handle() blocked at Future.get() in price(). With 4 workers all blocked and 37 tasks pending, the awaited sub-tasks can never run. It is a circular wait: workers need queue progress, and queue progress needs a free worker. It only appears under load, when all workers are busy at once.",
      },
      {
        ask: "Which fix removes the deadlock?",
        options: ["Retry the request in a loop", "Do not block a pool thread waiting for work queued on the same pool: use a separate pool for the sub-tasks, make it asynchronous (composition/callbacks), or run price() inline", "Increase the pool to 5 threads and hope", "Lower the thread priority"],
        answer: 1,
        why: "The wait must not depend on a resource (a free worker) held by the waiters. A separate pool or a non-blocking continuation breaks the cycle. A bigger pool only moves the threshold: 5 workers deadlock once 5 requests arrive together.",
      },
    ],
    explain: "Idle CPU with every thread in futex wait and a growing queue means threads are blocked on each other. Nested blocking submits to a bounded pool create a hold-and-wait cycle. Break it by never waiting for a queued sub-task from inside the same pool.",
    move: mv("Triage", "sync", 30),
  },
];
