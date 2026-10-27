# Coverage matrix: SDE operating-systems interview topics

Each row maps a typical interview topic to the lessons (`/learn/<id>`), the seeded generators, the simulators in `game/sim/` and a few of the authored questions that cover it. `tests/coverage.test.ts` checks that every id and path named in backticks in the table exists and that each topic names at least two example questions, so the matrix cannot drift from the code.

| Topic | Lessons | Generators | Simulators | Example questions |
| --- | --- | --- | --- | --- |
| Processes and threads | `processes-states`, `processes-context`, `processes-fork`, `processes-threads` | `gen-fork-tree`, `gen-fork-prints`, `gen-state-trace`, `gen-state-arrows` | `game/sim/processes.ts`, `game/sim/fork.ts`, `game/sim/threads.ts` | `iv-thread`, `ivx-forks`, `ivx-zombie`, `ds-shell-eof` |
| Scheduling | `scheduling-fcfs`, `scheduling-sjf`, `scheduling-priority`, `scheduling-rr`, `scheduling-mlfq` | `gen-sched-avg`, `gen-sched-build`, `gen-sched-finish`, `gen-sched-which`, `gen-fcfs-avg` | `game/sim/scheduling.ts` | `ivx-rr`, `ivx-sjf`, `ivx-cfs-vruntime`, `ct-cpu-throttle` |
| Synchronization | `sync-race`, `sync-peterson`, `sync-semaphores`, `sync-monitors`, `sync-classic` | `gen-sync-finals`, `gen-sync-interleave`, `gen-sync-peterson`, `gen-sync-semaphore` | `game/sim/sync.ts`, `game/sim/atomics.ts`, `game/sim/contention.ts` | `iv-mutex-sem`, `ivx-semaphore`, `ivx-prodcons`, `ivx-priority-inversion` |
| Deadlock | `deadlocks-coffman`, `deadlocks-rag`, `deadlocks-prevention`, `deadlocks-banker`, `deadlocks-recovery` | `gen-deadlock-safe`, `gen-deadlock-need`, `gen-deadlock-request`, `gen-deadlock-detect`, `gen-deadlock-rag`, `gen-deadlock-lockorder` | `game/sim/deadlock.ts` | `ivx-deadlock`, `ivx-coffman`, `ivx-banker-seq`, `bs-lock-order`, `inc-pool-deadlock` |
| Memory management | `memory-contiguous`, `memory-paging`, `memory-tables`, `memory-tlb`, `memory-segments` | `gen-mem-translate`, `gen-mem-eat`, `gen-mem-fit`, `gen-mem-ptsize`, `gen-mem-segment` | `game/sim/memory.ts`, `game/sim/allocator.ts` | `iv-malloc`, `ivx-eat-tlb`, `ivx-first-fit`, `ds-malloc-steps` |
| Virtual memory | `virtual-demand`, `virtual-replace`, `virtual-belady`, `virtual-thrash`, `virtual-wss` | `gen-vm-faults`, `gen-vm-victim`, `gen-vm-eat`, `gen-vm-thrash`, `gen-vm-wss` | `game/sim/paging.ts` | `ivx-pagefault`, `ivx-belady`, `ivx-lru`, `inc-swap-thrash` |
| File systems | `storage-alloc`, `storage-inode`, `storage-journal` | `gen-st-inode`, `gen-st-linked-blocks`, `gen-st-reads` | `game/sim/storage.ts` | `ivx-inode-blocks`, `ivx-journal`, `ivx-hardlink-count`, `ct-copy-up` |
| Disks and I/O | `storage-raid`, `storage-disk`, `io-models`, `io-epoll`, `io-servers`, `io-zerocopy` | `gen-st-raid`, `gen-st-movement`, `gen-st-first`, `gen-perf-bdp` | `game/sim/ionet.ts`, `game/sim/storage.ts` | `iv-epoll`, `ivx-dma`, `ivx-sstf`, `ds-chat-select` |
| IPC | `processes-ipc` | `gen-ipc-pick` | `game/sim/designs.ts` | `ivx-ipc`, `ivx-pipe-full`, `ds-shell-steps` |
| Signals | `basics-interrupts` | `gen-irq-or-trap` | `game/sim/linuxtools.ts` | `ivx-sigkill`, `ivx-sigchld`, `tk-signals`, `ct-pid1` |
| Containers and virtualization | `containers-namespaces`, `containers-cgroups`, `containers-overlayfs`, `containers-vms`, `containers-run`, `virt-trap`, `virt-paging`, `virt-hypervisors` | | `game/sim/containers.ts`, `game/sim/virt.ts` | `ivx-container-vs-vm`, `ct-memory-max`, `ct-whiteout`, `ct-trap-emulate`, `ct-nested-walk`, `ct-precopy` |
| Performance debugging | `alloc-hugepages` | `gen-perf-amdahl`, `gen-perf-lock`, `gen-perf-pool`, `gen-perf-switch` | `game/sim/perf.ts`, `game/sim/linuxtools.ts` | `inc-io-wait`, `inc-oom`, `inc-ctx-storm`, `tk-triage` |
| Concurrency coding | `atomics-cas`, `atomics-order`, `atomics-false-sharing`, `atomics-futex` | | `game/sim/atomics.ts`, `game/sim/sync.ts` | `bs-dcl`, `bs-lost-signal`, `fill-bb-cv`, `fill-rw` |
| Allocators and NUMA | `alloc-freelist`, `alloc-buddy`, `alloc-slab`, `alloc-hugepages` | `gen-mem-internal`, `gen-mem-outer` | `game/sim/allocator.ts` | `ivx-internal-frag`, `ct-numa-first-touch` |
| Boot, modes and system calls | `basics-modes`, `basics-syscalls`, `basics-interrupts`, `basics-kernels`, `basics-boot` | `gen-boot-order`, `gen-irq-load`, `gen-privileged` | `game/sim/basics.ts` | `ivx-syscall`, `ivx-dual-mode`, `ivx-boot-bios`, `ivx-pid1` |

## Holes found and filled

- Containers, virtualization and NUMA had only 6 to 12 interview questions each and no computed ones. `content/containerQuestions.ts` adds ten (CPU quota throttling, `memory.max` OOM, overlayfs copy-up and whiteouts, PID 1 signal rules, Popek-Goldberg and POPF, nested page walks, pre-copy migration that cannot converge, NUMA first-touch). Their numbers come from `game/sim/containers.ts` and `game/sim/virt.ts`.
