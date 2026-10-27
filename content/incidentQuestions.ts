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
];
