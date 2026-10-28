import type { Tier } from "@/game/engine/interview";

/**
 * Easy = phone-screen recall of a definition or one rule; hard = an onsite
 * or staff-level follow-up (multi-step arithmetic, subtle races, "what breaks
 * when..."); everything else is medium. Listed by id; unlisted ids are medium.
 */
const EASY = `iv-thread iv-cow iv-mutex-sem iv-epoll iv-ctx ivx-vm ivx-zombie ivx-segv ivx-syscall-trap ivx-privileged ivx-trap-vs-int
ivx-dual-mode ivx-mode-switch ivx-pid1 ivx-lkm ivx-thread-shared ivx-fifo ivx-sigint ivx-sigkill ivx-container-vs-vm ivx-namespaces
ivx-cgroups ct-whiteout ivx-page-size ivx-semaphore ivx-fcfs-turnaround ivx-fcfs-disk ivx-rr ivx-sjf ivx-lowest-fd ivx-hardlink-count ivx-links
ivx-spinlock ivx-nice ivx-block-char ivx-polling-irq ivx-protection-rings ivx-aslr ivx-nx-bit ivx-least-privilege ivx-page-cache
ivx-locality ivx-data-race ivx-stack-heap ivx-mmap ivx-deadlock ivx-pageseg ivx-thrash ivx-lost-update ivx-fork-prints ivx-ipc ivx-exec
ivx-boot-bios ivx-lru ivx-oom tk-which-swap tk-which-disk tk-which-syscalls tk-which-hotfn tk-signals tk-ulimit ml-folio`;
const HARD = `ivx-belady ivx-opt-faults ivx-banker-seq ivx-banker-request ivx-raid5 ivx-raid5-write ivx-raid6-cap ivx-tau-predict ivx-eat-fault
ivx-eat-tlb ivx-eat-98 ivx-eat-disk ivx-pt-size ivx-ptentries ivx-vpn ivx-inverted-pt ivx-shadow-paging ivx-aba ivx-reorder ivx-signal-safe
ivx-false-sharing ivx-inversion ivx-priority-inversion ivx-notify-lost ivx-writer-starve ivx-livelock ivx-epoll-edge ivx-listen-backlog
ivx-detect-count ivx-min-resources ivx-lock-ring ivx-philosophers ivx-dining-count ivx-srtf-wait ivx-rr-response ivx-inode-double
ivx-indexed-reads ivx-linked-data ivx-journal-meta ivx-cow-fs ivx-atomic-rename ivx-cfs-vruntime ivx-top-bottom-half ivx-max-fault-rate
ivx-fifo-four ivx-lru-four ivx-fork-child ivx-tlb-switch ivx-type1-hypervisor ivx-sigchld ivx-orphan
bs-dcl bs-lost-signal bs-lock-order bs-toctou fill-bb-cv fill-rw fill-philosophers fill-barrier
inc-ctx-storm inc-swap-thrash inc-pool-deadlock inc-spinlock
ct-pid1 ct-trap-emulate ct-nested-walk ct-precopy ds-lru-lock ds-rate-cap ds-pool-bound ds-sched-preempt ds-malloc-coalesce ds-shell-eof ds-chat-select tk-triage ml-sched-ext ml-mglru`;

const split = (s: string) => s.split(/\s+/).filter(Boolean);
export const TIER_OF: Readonly<Record<string, Tier>> = Object.fromEntries([...split(EASY).map((id) => [id, "easy" as const]), ...split(HARD).map((id) => [id, "hard" as const])]);

export const tierOfId = (id: string): Tier => TIER_OF[id] ?? "medium";
