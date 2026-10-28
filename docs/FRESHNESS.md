# Freshness log (Linux facts)

Linux-specific claims in `content/` are checked against current kernel documentation. Stamp: **as of October 2026**.

| Area | Status | Notes |
|---|---|---|
| Fair scheduler | Fixed | Mainline switched from CFS to EEVDF in 6.6. Textbook CFS (red-black tree on vruntime) stays as "classic" in `sched-cfs` and `ivx-cfs-vruntime`; `ivx-eevdf-pick` covers lag, eligibility and virtual deadline. The nice-to-weight table is shared by both. |
| I/O schedulers | Fixed | mq-deadline, BFQ, Kyber and none (the old CFQ, noop and legacy deadline are gone). |
| cgroups | Checked | Lessons describe cgroup v2's single tree. |
| io_uring, epoll | Checked | Ring-based submission/completion described correctly. |
| sched_ext | Added | Mainline since 6.12; BPF-defined scheduler with a watchdog fallback to the fair class (`ml-sched-ext`). |
| PSI | Added | Linux 4.20; `some` vs `full` stall time, not usage (`ml-psi-meaning`). |
| eBPF | Added | Verifier safety checks, JIT; loading needs privileges such as CAP_BPF (`ml-ebpf-verifier`). |
| MGLRU | Added | Mainline since 6.1; generations instead of active/inactive only (`ml-mglru`). Textbook LRU/clock kept as the concept. |
| Folios | Added | Introduced in 5.16; contiguous page groups as one unit (`ml-folio`). |
| Transparent huge pages | Added | `always`/`madvise`/`never`, compaction stalls; lesson text already mentions the latency cost (`ml-thp-madvise`). |
| Not yet covered | Open | Multi-size THP (6.8+) and a dedicated io_uring/cgroup v2/PSI lesson are in 7.3. |
