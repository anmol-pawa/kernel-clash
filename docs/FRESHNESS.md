# Freshness log (Linux facts)

Linux-specific claims in `content/` are checked against current kernel documentation. Stamp: **as of October 2026**.

| Area | Status | Notes |
|---|---|---|
| Fair scheduler | Fixed | Mainline switched from CFS to EEVDF in 6.6. Textbook CFS (red-black tree on vruntime) stays as "classic" in `sched-cfs` and `ivx-cfs-vruntime`; `ivx-eevdf-pick` covers lag, eligibility and virtual deadline. The nice-to-weight table is shared by both. |
| I/O schedulers | Fixed | mq-deadline, BFQ, Kyber and none (the old CFQ, noop and legacy deadline are gone). |
| cgroups | Checked | Lessons describe cgroup v2's single tree. |
| io_uring, epoll | Checked | Ring-based submission/completion described correctly. |
| Still to audit (7.1b) | Open | `sched_ext`, PSI, eBPF, MGLRU, folios and transparent huge pages: add or verify wording. |
