import { cpuMax, memoryMax, Overlay, type Layer } from "@/game/sim/containers";
import { nestedWalkRefs, preCopy } from "@/game/sim/virt";
import type { Question } from "@/game/engine/question";
import type { MoveType } from "@/game/engine/types";

/**
 * The containers, virtualization and NUMA round: cgroup limits, overlayfs,
 * PID 1 in a namespace, trap-and-emulate, nested page walks, live migration.
 * Numbers come from `game/sim/containers.ts` and `game/sim/virt.ts`, which
 * their tests check against the kernel documentation and the papers.
 */
const mv = (name: string, type: MoveType, power: number) => ({ name, type, power });

const throttle = cpuMax(50000, 100000, 4, 8);
const oom = memoryMax(512, [{ name: "worker", anonMB: 300 }, { name: "sidecar", anonMB: 250 }], 100);
const image: Layer = new Map([["/db/data", { data: "v1", sizeMB: 100 }], ["/etc/motd", { data: "hi", sizeMB: 1 }]]);
const copyUp = (() => {
  const o = new Overlay([image]);
  o.write("/db/data", "v2");
  return o.copiedUpMB;
})();
const afterRm = (() => {
  const o = new Overlay([image]);
  o.remove("/etc/motd");
  return { seenByContainer: o.read("/etc/motd"), imageStillHas: image.get("/etc/motd") !== undefined, upperMB: o.upperMB };
})();
const mig = preCopy(16384, 1200, 1000, 64);

export const CONTAINER_QUESTIONS: Question[] = [
  {
    id: "ct-cpu-throttle",
    kind: "numeric",
    prompt: `A container has cpu.max = "50000 100000" (50 ms of CPU per 100 ms period) and runs 4 busy threads on an 8-CPU host. For how many milliseconds of each period do the threads run before the cgroup is throttled?`,
    answer: throttle.runUs / 1000,
    unit: "ms",
    explain: "The quota is CPU time summed over all CPUs. Four threads burn 4 ms of CPU per wall-clock ms, so 50 ms of quota is gone after 50 / 4 = 12.5 ms. The threads then sit throttled for the other 87.5 ms of the period, which is why a quota can cause latency spikes while average CPU use looks low.",
    move: mv("Quota Wall", "scheduler", 36),
  },
  {
    id: "ct-throttle-latency",
    prompt: "A container's average CPU use is 30% of its limit, yet request latency spikes every few hundred milliseconds. cpu.stat shows nr_throttled climbing. What is the most likely cause?",
    options: ["Bursts of threads use the whole quota early in a period, and the cgroup is throttled until the next period starts", "The container shares the host kernel, so its system calls are slow", "The page cache of the container is full", "cpu.weight is set too high"],
    answer: 0,
    explain: "cpu.max is enforced per period (100 ms by default), not on the average. A burst across many threads consumes the quota in a few milliseconds, and every runnable thread then waits for the period to roll over. Raise the quota, use fewer threads, or lengthen the period. cpu.weight only splits contended CPU; it never throttles.",
    move: mv("Throttle Stall", "scheduler", 34),
  },
  {
    id: "ct-memory-max",
    prompt: `A cgroup has memory.max = 512 MB. Its processes hold worker 300 MB and sidecar 250 MB of anonymous memory, plus 100 MB of page cache. The cgroup reaches its limit. What does the kernel do?`,
    options: ["Drops the 100 MB of cache first; anonymous memory is still 550 MB, so the OOM killer shoots sidecar", "Kills sidecar immediately and keeps the cache", "Swaps the cache out and carries on", "Drops the cache first; the OOM killer then kills the biggest process, worker"],
    answer: 3,
    explain: `Page cache is reclaimable, so the kernel evicts it first (${oom.reclaimedMB} MB here). The anonymous memory alone (550 MB) still exceeds the 512 MB limit, so the cgroup's OOM killer picks the process with the largest footprint: ${oom.killed[0]}. The survivor then fits (${oom.survivors[0].anonMB} MB).`,
    move: mv("Cgroup Reaper", "memory", 36),
  },
  {
    id: "ct-copy-up",
    kind: "numeric",
    prompt: "A container's image has a 100 MB database file in a lower overlayfs layer. The container changes one byte of it. How many megabytes does overlayfs copy into the container's writable layer?",
    answer: copyUp,
    unit: "MB",
    explain: "overlayfs works on whole files: the first write to a lower-layer file copies the entire file up to the upper layer (copy-up), however small the change. That is why databases belong on a volume, not in the image's writable layer.",
    move: mv("Copy-Up", "storage", 34),
  },
  {
    id: "ct-whiteout",
    prompt: "Inside a container you run rm /etc/motd, a file that lives in a read-only image layer. What happens?",
    options: ["The file is deleted from the image, so every container made from it loses the file", "A whiteout entry is added to the writable layer; the container no longer sees the file and the image is unchanged", "The command fails with EROFS", "The file is copied up and then deleted, using 1 MB of the writable layer"],
    answer: 1,
    explain: `Image layers are read-only and shared by all containers. Removing a lower-layer file records a whiteout (a special 0-byte node) in the upper layer, which hides the name from the merged view while the image keeps the file (here the container sees ${afterRm.seenByContainer === undefined ? "nothing" : "a file"}, the image still has it: ${afterRm.imageStillHas}, writable layer used: ${afterRm.upperMB} MB).`,
    move: mv("Whiteout", "storage", 32),
  },
  {
    id: "ct-pid1",
    prompt: "Your app runs as PID 1 in a container and has no SIGTERM handler. docker stop waits ten seconds and then SIGKILLs it. Why did SIGTERM not stop it?",
    options: ["Containers cannot receive SIGTERM", "SIGTERM is only delivered by a hypervisor", "The first process of a PID namespace gets no default signal actions: a signal with no installed handler is ignored for PID 1", "cgroups block signals to protect the limits"],
    answer: 2,
    explain: "The kernel protects PID 1 of every PID namespace: a signal sent from inside the namespace is dropped unless PID 1 installed a handler (SIGKILL and SIGSTOP from an ancestor namespace still work, which is the eventual docker kill). Fix it by handling SIGTERM, or by running a tiny init such as tini (docker run --init), which also reaps orphaned zombies that would otherwise pile up under PID 1.",
    move: mv("Init Guard", "process", 38),
  },
  {
    id: "ct-trap-emulate",
    prompt: "On classic x86 (before hardware virtualization support), POPF silently ignores the interrupt-flag bit instead of trapping when run in user mode. Why did that stop pure trap-and-emulate virtualization?",
    options: ["POPF is too slow to emulate", "It is sensitive but not privileged, so the deprivileged guest kernel runs it without a trap and the hypervisor never gets control", "POPF needs 64-bit mode", "It traps twice, which confuses the hypervisor"],
    answer: 1,
    explain: "Popek and Goldberg: an architecture is classically virtualizable when every sensitive instruction is privileged, so each one traps to the hypervisor. POPF changes machine state (the interrupt flag) yet does not trap, so the guest's change is lost without a trace. VMware answered with binary translation, Xen with paravirtualization, and Intel VT-x / AMD-V with a guest mode that makes it exit.",
    move: mv("Silent Flag", "process", 38),
  },
  {
    id: "ct-nested-walk",
    kind: "numeric",
    prompt: "With hardware nested paging (EPT/NPT), a guest uses 3-level page tables and the host's nested tables have 4 levels. On a TLB miss, how many memory references does the full two-dimensional walk need?",
    answer: nestedWalkRefs(3, 4),
    unit: "refs",
    explain: "Each of the 3 guest-table reads and the final data address is a guest-physical address that needs its own 4-step nested walk, and the guest-table reads themselves cost 3 more: (3 + 1) × (4 + 1) − 1 = 19. This is why virtualized TLB misses are expensive and why huge pages matter even more in VMs.",
    move: mv("Double Walk", "memory", 40),
  },
  {
    id: "ct-precopy",
    prompt: `A 16 GB VM is live-migrated over a 1000 MB/s link while the guest dirties memory at 1200 MB/s. Pre-copy migration will not converge, because each round re-sends more than the one before. What can the operator do?`,
    options: ["Add more RAM to the destination", "Keep going; the last round always fits", "Throttle the guest's CPU (auto-converge) or switch to post-copy, which moves execution first and fetches pages on demand", "Shut the VM down for the length of one round"],
    answer: 2,
    explain: `Pre-copy sends all memory, then the pages dirtied meanwhile, round after round, and pauses the guest only for a small remainder. When the dirty rate exceeds the link rate the remainder never shrinks (this run converges: ${mig.converges}). Throttling the guest lowers the dirty rate; post-copy resumes on the destination at once and faults missing pages in over the network, trading a longer slowdown for a bounded migration.`,
    move: mv("Live Move", "io", 38),
  },
  {
    id: "ct-numa-first-touch",
    prompt: "On a two-socket NUMA server, a program allocates a large array on one thread, but 32 worker threads on both sockets then read it. Linux's default first-touch policy puts each page on the node of the thread that first writes it. Why is the program slower than expected?",
    options: ["Every page lands on the node where the allocating thread first wrote it, so threads on the other socket pay remote-memory latency and share one memory controller", "NUMA machines have no shared memory", "First-touch spreads pages evenly, so caches are cold", "The array is stored in swap until the second socket reads it"],
    answer: 0,
    explain: "If one thread initializes everything, all pages sit on its node. Threads on the other socket reach them across the interconnect (roughly 1.5-2x the latency) and all traffic queues at one memory controller. Let each worker first-touch its own slice, interleave with numactl --interleave, or pin threads with their data (taskset / numactl --cpunodebind).",
    move: mv("Remote Hop", "memory", 36),
  },
];
