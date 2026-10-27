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
  {
    id: "inc-ctx-storm",
    kind: "incident",
    prompt: "Page at 16:05: after a traffic spike the gateway's latency tripled, and the 8-core host is pegged, yet throughput barely moved. The service spawns one thread per request. You check the host.",
    outputs: [
      {
        cmd: "vmstat 1 3",
        text: [
          "procs ------memory------ --swap-- ---io--- -system- ------cpu-----",
          "  r  b   swpd   free   si   so    bi    bo     in     cs us sy id wa st",
          "212  0      0 6120344    0    0     4    22  98210 186400 31 64  5  0  0",
          "206  0      0 6118120    0    0     0    18  97650 184900 32 63  5  0  0",
          "215  0      0 6117002    0    0     2    30  99020 188100 30 65  5  0  0",
        ].join("\n"),
      },
      {
        cmd: "nproc; ps -eLf | wc -l",
        text: ["8", "4106"].join("\n"),
      },
      {
        cmd: "pidstat -w -t -p 7331 1 1 | head -5",
        text: [
          "  TID   cswch/s nvcswch/s Command",
          " 7331      0.00      0.00 gateway",
          " 7502     14.00    310.00 |__gateway",
          " 7503     11.00    298.00 |__gateway",
        ].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What is the bottleneck?",
        options: ["Disk I/O", "The CPUs are saturated, but mostly in the kernel: 64% sy with about 186,000 context switches per second", "Memory is exhausted", "The network card is dropping packets"],
        answer: 1,
        why: "Idle is 5% and wa is 0, so the CPUs are fully busy, yet sy (64%) dwarfs us (31%): most of the time goes to the kernel, not to the application. The run queue r is about 210 on 8 cores, and cs is about 186,000/s. Swap and I/O columns are zero and 6 GB is free.",
      },
      {
        ask: "Which counter shows why so many switches happen?",
        options: ["The per-thread voluntary and involuntary counts from pidstat -w: nvcswch/s is far higher than cswch/s", "free -m", "df -h", "ulimit -n"],
        answer: 0,
        why: "A voluntary switch (cswch) is a thread blocking; an involuntary one (nvcswch) is the scheduler preempting a thread that was still runnable. Each gateway thread has about 300 involuntary and about 12 voluntary switches per second: the threads are runnable and fighting for 8 cores, not waiting on I/O.",
      },
      {
        ask: "What is the root cause and fix?",
        options: ["Too few threads: add more", "Thread-per-request created about 4,100 threads for 8 cores: run queue length and switching overhead eat the CPU. Bound the concurrency with a pool of roughly one to two times the cores (or an event loop) and queue the rest", "The scheduler quantum is too long: nothing to change", "The kernel needs a reboot"],
        answer: 1,
        why: "With 4,106 threads and r near 210 there are about 26 runnable threads per core, so every quantum ends in a preemption and a switch, which costs direct time and cold caches and TLBs. A bounded pool matched to the cores does the same work with far fewer switches, and a queue absorbs the spike.",
      },
    ],
    explain: "High sy, a run queue far above the core count and a huge cs rate with mostly involuntary switches mean too many runnable threads. Bound concurrency near the number of cores instead of spawning a thread per request.",
    move: mv("Triage", "scheduler", 30),
  },
  {
    id: "inc-swap-thrash",
    kind: "incident",
    prompt: "Page at 11:20: the analytics box is crawling. Shell commands take seconds to start and the batch job's progress has almost stopped. Nobody deployed anything, but a new report started an hour ago.",
    outputs: [
      {
        cmd: "free -m",
        text: [
          "              total   used   free  shared  buff/cache  available",
          "Mem:          16384  16190     96       2          98         61",
          "Swap:          8192   8104     88",
        ].join("\n"),
      },
      {
        cmd: "vmstat 1 3",
        text: [
          "procs ------memory------ --swap-- ---io--- -system- ------cpu-----",
          " r  b   swpd   free   si   so    bi    bo   in   cs us sy id wa st",
          " 2 19 8300544  98304 21440 23610 21800 24100 1450 2900  4  6 31 59  0",
          " 1 21 8301120  97800 22100 22980 22400 23500 1432 2870  3  7 30 60  0",
          " 3 20 8300960  98112 20980 24220 21100 24800 1465 2940  4  6 29 61  0",
        ].join("\n"),
      },
      {
        cmd: "top -bn1 -o %MEM | head -10 | tail -3",
        text: [
          "  PID USER  RES   S %CPU %MEM COMMAND",
          " 6611 etl   14.6g D  3.0 91.2 report-gen",
          "   54 root     0   D  5.9  0.0 kswapd0",
        ].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What is happening?",
        options: ["The CPUs are saturated", "Thrashing: the working set no longer fits in RAM, so the kernel constantly swaps pages out and back in", "The disk is failing", "A network outage"],
        answer: 1,
        why: "Available memory is 61 MB and swap is 8,104 of 8,192 MB used. vmstat shows si and so of about 21,000 and 23,000 KB/s at the same time (pages leave and return in the same second), b=20 blocked tasks and wa near 60%. Only 7% of the CPU is busy, and kswapd0 is active in D state.",
      },
      {
        ask: "Which process is the culprit?",
        options: ["kswapd0, because it is the busiest kernel thread", "report-gen: it has 14.6 GB resident, 91% of memory, so its working set pushes everything else out", "systemd", "The shell, because it is slow to start"],
        answer: 1,
        why: "kswapd0 is only the reclaim thread doing the paging, a symptom. The memory is held by report-gen at 14.6 GB RES (91.2% of RAM). Because it keeps touching its pages, they are swapped back in constantly, and the shell is slow because its own pages were evicted too.",
      },
      {
        ask: "Which action fixes it, rather than hiding it?",
        options: ["Add a larger swap file", "Shrink the working set (process the report in chunks or lower its memory limit), or add RAM; bigger swap only makes the thrashing last longer", "Raise the priority of kswapd0", "Run sync and drop the page cache"],
        answer: 1,
        why: "The demand for resident pages exceeds RAM, and disk is about 100,000 times slower than memory, so more swap does not help. Reduce what the job needs at once, or give the machine more RAM. The page cache is already only 98 MB, so dropping it frees nothing.",
      },
    ],
    explain: "Simultaneous heavy swap-in and swap-out, near-zero available memory, many tasks blocked and high wa mean thrashing. The cure is to make the working set fit in RAM, not to enlarge the swap.",
    move: mv("Triage", "memory", 30),
  },
  {
    id: "inc-emfile",
    kind: "incident",
    prompt: "Page at 09:40: a web proxy that ran fine for weeks starts refusing new connections. Existing clients are fine, CPU and memory are quiet, and the error log has a line you have not seen before.",
    outputs: [
      {
        cmd: "tail -3 /var/log/proxy.log",
        text: [
          "09:38:51 accept4: Too many open files",
          "09:38:51 accept4: Too many open files",
          "09:38:52 open(/etc/proxy/tls.pem): Too many open files",
        ].join("\n"),
      },
      {
        cmd: "grep 'open files' /proc/2290/limits; ls /proc/2290/fd | wc -l",
        text: [
          "Max open files            1024                 1048576              files",
          "1024",
        ].join("\n"),
      },
      {
        cmd: "lsof -p 2290 | awk '{print $5}' | sort | uniq -c; ss -s | head -2",
        text: [
          "      1 TYPE",
          "     12 REG",
          "      3 CHR",
          "    236 IPv4",
          "    773 sock",
          "Total: 1031",
          "TCP:   1004 (estab 236, closed 0, orphaned 0, timewait 0)",
        ].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What does the output say about the failure?",
        options: ["The machine is out of memory", "The process hit its per-process file-descriptor limit: 1024 open of a soft limit of 1024, so accept4() and open() fail with EMFILE", "The system-wide file table is full", "The disk is full"],
        answer: 1,
        why: "The log says \"Too many open files\" (EMFILE) from accept4 and open, and /proc/2290/limits shows a soft limit of 1024 with exactly 1024 entries in /proc/2290/fd. Memory and CPU are quiet, and the failing call is on a descriptor, not on disk space. The hard limit is 1,048,576, so the soft limit is the one being hit.",
      },
      {
        ask: "Why is the descriptor count so high for only 236 live clients?",
        options: ["Each client needs four descriptors", "A descriptor leak: 773 sockets are open that are not established connections, so the code is not calling close() on some path (an error branch or a finished upstream connection)", "The kernel keeps closed sockets for a minute", "lsof counts every thread separately"],
        answer: 1,
        why: "lsof shows 236 IPv4 sockets, matching the 236 established connections in ss, plus 773 further sock entries that are not live connections (ss counts only 236 established and no orphaned or TIME_WAIT sockets). Those are descriptors the process still holds for connections it no longer uses. 12 + 3 + 236 + 773 = 1,024, exactly the open-file limit.",
      },
      {
        ask: "What is the right fix?",
        options: ["Only raise the limit with ulimit -n 1048576 and move on", "Find and fix the missing close() (for example close in a finally/defer on every path) and monitor the fd count; raising the limit may be a stopgap, but a leak will fill any limit", "Restart the proxy every night and keep the limit", "Disable TLS so there are fewer files"],
        answer: 1,
        why: "A bigger limit only delays the failure, because descriptors keep leaking at the same rate. Closing the descriptor on every path, preferably with RAII/defer/try-with-resources, removes the cause. Alerting on /proc/<pid>/fd count against the limit catches a regression early.",
      },
    ],
    explain: "EMFILE with a descriptor count equal to the soft limit means the per-process limit is reached. Sockets that outnumber live connections point to a missing close(), so fix the leak rather than only raising ulimit.",
    move: mv("Triage", "io", 30),
  },
  {
    id: "inc-spinlock",
    kind: "incident",
    prompt: "Page at 14:15: a 4-core worker has been at 100% CPU for ten minutes, but request throughput fell to a trickle. The load is not from traffic, which is down. You look at which threads are burning CPU.",
    outputs: [
      {
        cmd: "top -H -bn1 -p 5180 | head -12 | tail -5",
        text: [
          "  PID USER  S  %CPU  COMMAND",
          " 5192 svc   R  99.9  worker-2",
          " 5193 svc   R  99.7  worker-3",
          " 5194 svc   R  99.8  worker-4",
          " 5191 svc   R  99.6  worker-1",
        ].join("\n"),
      },
      {
        cmd: "vmstat 1 3",
        text: [
          "procs ------memory------ --swap-- ---io--- -system- ------cpu-----",
          " r  b   swpd   free   si   so    bi    bo   in   cs us sy id wa st",
          " 4  0      0 9120344    0    0     0     2  310  420 99  1  0  0  0",
          " 4  0      0 9120344    0    0     0     0  305  415 99  1  0  0  0",
          " 4  0      0 9120344    0    0     0     0  308  418 98  2  0  0  0",
        ].join("\n"),
      },
      {
        cmd: "perf top -p 5180 -d 1 --stdio | head -4",
        text: [
          "Overhead  Shared Object  Symbol",
          "  97.40%  libcache.so    [.] spin_lock_acquire",
          "   1.20%  libcache.so    [.] cache_lookup",
          "   0.80%  [kernel]       [k] native_queued_spin_lock_slowpath",
        ].join("\n"),
      },
    ],
    steps: [
      {
        ask: "What does the CPU data say?",
        options: ["The workers are blocked on I/O", "The workers are runnable and burning user-mode CPU (99% us, almost no context switches and no I/O wait), yet making almost no progress", "The kernel is the bottleneck", "The system is swapping"],
        answer: 1,
        why: "All four threads are in state R at about 99.7% CPU, vmstat shows us 98-99% with sy 1-2, wa 0 and b 0, and only about 420 context switches per second. They are not sleeping or waiting for the disk; they are executing instructions in user space without finishing requests.",
      },
      {
        ask: "What does perf show?",
        options: ["The time is in cache_lookup, so the cache is slow", "97% of the samples are in spin_lock_acquire: threads are busy-waiting on a spinlock that someone holds", "The time is in the kernel scheduler", "perf shows nothing useful"],
        answer: 1,
        why: "perf attributes 97.4% to spin_lock_acquire against 1.2% for the real work in cache_lookup. A spinlock keeps the thread on the CPU in a loop instead of sleeping, so contention shows up as 100% CPU with no progress. Fully busy CPUs with idle 0 and few switches are the signature.",
      },
      {
        ask: "What is the likely root cause and fix?",
        options: ["The CPUs are too slow: add cores", "The lock holder is not releasing (it was descheduled or is blocked while holding the spinlock, or an error path skipped the unlock); hold spinlocks only for very short non-blocking sections and use a sleeping mutex (futex) for anything longer", "Use more threads so that someone gets the lock", "Raise the thread priority of the workers"],
        answer: 1,
        why: "With four threads spinning, none are making progress, so the thread that owns the lock is not running its critical section: it blocked or was preempted while holding it, or never unlocked. Spinning wastes the CPU the holder needs. More cores or threads add more spinners, and a mutex lets waiters sleep so the holder can run and the CPU stays free.",
      },
    ],
    explain: "100% user CPU, a few context switches, no I/O wait and a profile dominated by a spin-lock function mean threads are busy-waiting on a lock that is not being released. Spin only for brief, non-blocking sections; otherwise use a sleeping lock.",
    move: mv("Triage", "sync", 30),
  },
];
