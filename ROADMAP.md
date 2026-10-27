# Kernel Clash roadmap

The hourly routine works top to bottom: take the first unchecked box. Split big items into sub-boxes when you start them.

## 0. Bootstrap (reuse Query Clash's engine)

- [x] 0.1 Scaffold Next.js 16 + TypeScript + Tailwind 4 + Vitest + ESLint, copying configs from Query Clash. Static export with `BASE_PATH=/kernel-clash`, the PWA manifest and icons (an original "KC" pixel icon), the offline service worker (with the worker-fragment fix), and `ci.yml` + `pages.yml`. Ship a placeholder title screen that deploys and installs.
- [x] 0.2 Port the Pixi battle engine (stage, tweens, particles, camera, audio synth, battle reducer, UI kit, save) and get a demo battle running.
- [x] 0.3 Pixel-sprite system: palette + character-grid sprites rendered to nearest-neighbour textures, with idle frames. Add a sprite-validity test.
- [x] 0.4 GBA-style battle screen: foe front sprite on a platform top-right, player creature back sprite bottom-left, HP/XP boxes, typed-out message box, and a move menu of 4 answer options (tap-friendly).

## 1. Game structure

- [x] 1.1 Region map with 9 "gyms" (one per chapter below) and an original boss creature per gym (e.g. a fork-spawning hydra for processes, a clock-golem for scheduling, a lock-serpent for sync, a deadlock crab, a page-moth for memory…). Badges are earned per gym.
  - [x] 1.1a Pixel overworld region map with the 9 gym buildings, gym data (chapter, topics, boss, badge), badge case, unlock order, and a save (`lib/save.ts`). PRESS START opens the map.
  - [x] 1.1b Boss creatures for gyms 1–2 (96×96, front + back, idle/attack/hurt): Trapjaw (OS basics) and Hydrafork (processes).
  - [x] 1.1c Bosses for gyms 3–4: Chronogolem (scheduling) and Mutexa (sync).
  - [x] 1.1d Bosses for gyms 5–6: Deadlocrab (deadlocks) and Heapotamus (memory).
  - [x] 1.1e Bosses for gyms 7–9: Thrashmoth (virtual memory), Diskraken (storage) and Kernelord (interview gauntlet).
  - [x] 1.1f Gym boss battles: enter a gym from the map, fight its boss, earn its badge (saved), unlock the next gym.
- [x] 1.2 Move types (Process, Scheduler, Sync, Memory, Storage, IO…) with a type chart and super-effective messages. Tests for the chart.
- [x] 1.3 Starter creature choice, XP and levels, evolution at gym milestones, and a capture box ("Kerneldex").
  - [x] 1.3a Two more starters (64×64, front + back, idle/attack/hurt) so the three form a type triangle: Bytling (process), Ramster (memory), Spinnail (storage). `content/starters.ts` + tests.
  - [x] 1.3b Starter choice screen on a new save (the three starters, types and blurbs), saved; the chosen starter is the player's typed creature in every battle (re-check boss counter balance with typed starters).
  - [x] 1.3c XP and levels saved per creature: XP from wins, level-ups with stat growth and a level-up line in battle.
  - [x] 1.3d Evolved forms for the three starters (art) and the evolve animation (white silhouette morph) at gym milestones.
    - [x] 1.3d1 Evolved-form art (64×64, front + back, idle/attack/hurt): Threadrake (Bytling), Gigahoard (Ramster), Raidsnail (Spinnail), plus evolution data (`evolution`, `EVOLVE_GYM`) and tests.
    - [x] 1.3d2 The evolve sequence (white silhouette morph between the two forms, flash, "BYTLING evolved into THREADRAKE!") after winning the `EVOLVE_GYM` badge; save the evolved flag; battles, map card and partner screen use the evolved form (name, art, a small HP bump), with balance tests.
  - [x] 1.3e The Kerneldex: a capture box listing seen/caught creatures with their art, type and blurb.
- [x] 1.4 A question engine with MCQ / multi-select / numeric / order-the-steps / generated problems, explanations after every answer, and a Leitner spaced-repetition box.
  - [x] 1.4a Question model and pure grader for MCQ / select-all / numeric / order-the-steps, seeded RNG, a `Generator` interface with the first two generators (FCFS averages via an FCFS simulator, fork() print counts via a fork simulator), sample select-all and order questions, and tests against textbook examples.
  - [x] 1.4b Battle UI for every kind (select-all with a confirm, a numeric keypad, tap-to-order steps, code/table blocks in the prompt), the right answer stated after a wrong one and the explanation after every answer; mix generated and new-kind questions into the practice battle.
  - [x] 1.4c Leitner spaced-repetition box: save per-question boxes, pick due questions for battles, and a review screen.

## 2. Curriculum (each gym: concept lessons → generated battles → boss)

- [x] 2.1 OS basics: kernel vs user mode, system calls, interrupts and traps, monolithic/micro/hybrid kernels, booting.
  - [x] 2.1a Lesson system: a lesson reader (`/learn/[gym]`) with pages narrated by the partner, illustrated pixel diagrams, a quick check per lesson (any question kind), saved lesson progress and a LESSONS button on the map card. The five OS-basics lessons with their diagrams (mode bit / privilege, syscall path, interrupt vector, kernel designs, boot chain).
  - [x] 2.1b OS-basics question pool (every kind, ~20 questions) plus generators (e.g. which instructions are privileged, boot-order, trap vs interrupt classification), all tested; gym battles draw from the pool.
  - [x] 2.1c Gym flow: lessons → trainer battles (a gym trainer creature with its own art) → boss, with the boss gated on finishing the trainer battles.
    - [x] 2.1c1 The Bootstrap Gym's trainer creature: Syscallow (64×64, front + back, idle/attack/hurt), a `trainer` on the gym, `TRAINERS` art map, a "trainer" Kerneldex entry before its boss, tests.
    - [x] 2.1c2 Trainer battles: two Syscallow battles per gym (`/gym/[id]/trainer`), trainer fighter stats with balance tests, questions drawn from the pool, wins saved per gym, the trainer marked seen/caught.
    - [x] 2.1c3 The gated flow: the boss locked until the trainer battles are won (gym page, map card and lecture-hall CHALLENGE show LESSONS → TRAINERS n/2 → BOSS), with tests and screenshots.
- [x] 2.2 Processes and threads: PCB, states and transitions (an animated state diagram), context switch, fork/exec/wait (predict-the-output puzzles for `fork()` trees), user vs kernel threads, IPC (pipes, shared memory, message passing).
  - [x] 2.2a Five processes-and-threads lessons in the Fork Grove lecture hall (states and the PCB, context switch, fork/exec/wait, threads and threading models, IPC), each with a pixel diagram (an animated five-state diagram) and a tested quick check.
  - [x] 2.2b Processes question pool (every kind, ~20) plus generators (fork() tree print/process counts, state-transition traces, pipe/IPC choices), all tested; gym battles draw from it.
  - [x] 2.2c The Fork Grove trainer creature (64×64, front + back, idle/attack/hurt), dex entry and tests.
  - [x] 2.2d Fork Grove trainer battles and the gated flow (lessons → trainers → Hydrafork), with screenshots.
  - [x] 2.2e Per-gym battle backdrops: every battle still uses the Bootstrap kernel-city skyline. Add a backdrop per gym (start with an illustrated Fork Grove: forked trees, roots, a grove floor) chosen by gym id in the stage, shown in `/dev/sprites`, with a test that every gym has one. The other seven gyms still map to kernel city: each later gym task (2.3–2.9) draws its own backdrop (sky, horizon, platform, props) in `game/sprites/scenery.ts` and points `BACKDROPS` at it.
- [x] 2.3 CPU scheduling: FCFS, SJF, SRTF, Priority (with aging), Round Robin, MLFQ. A **simulator draws Gantt charts**. Generated problems ask for average waiting/turnaround/response time, and the player builds the Gantt chart by tapping. Validated against textbook examples.
  - [x] 2.3a Scheduling simulators beyond FCFS: SJF, SRTF, priority (preemptive or not, with aging), Round Robin and MLFQ, each returning a merged Gantt chart and per-job times, tested against Silberschatz's worked examples plus random-workload invariants.
  - [x] 2.3b A pixel Gantt-chart renderer (the simulator's chart drawn as blocks with a time axis) used in explanations, plus five scheduling lessons in the Clocktower lecture hall (criteria and FCFS/convoy, SJF/SRTF, priority and aging, Round Robin and the quantum, MLFQ) with tested quick checks.
  - [x] 2.3c Scheduling question pool (every kind, ~20) plus generators (average waiting/turnaround/response for each algorithm, which algorithm produced this chart), all solver-checked; gym battles draw from it.
  - [x] 2.3d A tap-to-build Gantt-chart question kind: the player taps processes into the chart block by block, graded against the simulator, on desktop and iPhone.
  - [x] 2.3e The Clocktower trainer creature (64×64, front + back, idle/attack/hurt), dex entry, trainer battles and the gated flow, with screenshots.
  - [x] 2.3f The Clocktower battle backdrop (sky, horizon, platform, props) in `game/sprites/scenery.ts`.
- [x] 2.4 Synchronization: race conditions (spot-the-race in pseudocode), critical-section requirements, Peterson's algorithm, mutex vs semaphore, monitors and condition variables, producer–consumer, readers–writers, dining philosophers. Interactive step-through interleavings.
  - [x] 2.4a Sync simulators (`game/sim/sync.ts`: load/add/store interleavings with every final value, a state-space checker for Peterson's and broken entry protocols, a blocking semaphore) and five Mutex Marsh lessons (race conditions and the critical-section problem, Peterson's solution, mutex locks and semaphores, monitors and condition variables, classic problems) with pixel diagrams and tested quick checks.
  - [x] 2.4b Interactive step-through interleavings: a tap-to-schedule widget (pick which thread runs its next load/add/store, watch registers and the shared variable change, spot the lost update), used in the race lesson and as a question kind.
  - [x] 2.4c Sync question pool (every kind, ~20, including the old "which final values are possible" select-all for counter++ vs counter-- from 5, answers from `finalValues`) plus generators (`gen-sync-interleave` already exists in `content/syncGenerators.ts`; add it to a sync `POOLS` entry; possible final values of racing threads, semaphore value/blocked-count traces, Peterson's who-enters, bounded-buffer orderings), all solver-checked; gym battles draw from it.
  - [x] 2.4d The Mutex Marsh trainer creature (64×64, front + back, idle/attack/hurt), dex entry, trainer battles and the gated flow (check trainer-counter balance for Bytling, see run 34's note).
  - [x] 2.4e The Mutex Marsh battle backdrop (sky, horizon, platform, props) in `game/sprites/scenery.ts`.
- [x] 2.5 Deadlocks: Coffman conditions, resource-allocation graphs (cycle detection), prevention/avoidance/detection/recovery, and the **Banker's algorithm** (generated safe-sequence and request-granting problems, solver-checked).
  - [x] 2.5a Deadlock simulators (`game/sim/deadlock.ts`: RAG cycle finder, Banker's safety and request algorithms, detection) and five Gridlock Gym lessons (Coffman conditions, resource-allocation graphs, prevention and avoidance, the Banker's algorithm, detection and recovery) with `rag` and `banker` pixel diagrams and tested quick checks.
  - [x] 2.5b Tap-to-build Banker's safe-sequence widget (`banker` question kind, lesson free-play page).
  - [x] 2.5b2 RAG cycle spotter: tap the nodes that form the cycle (`cycle` question kind, `RagBoard`, lesson play page).
  - [x] 2.5c Deadlock question pool and seeded generators (safe sequence, request granted or not, need matrix, detection, lock-order deadlock) checked against the simulators, wired into `POOLS.deadlocks`.
  - [x] 2.5d The Gridlock Gym trainer creature (64×64, front + back, idle/attack/hurt), dex entry, trainer battles and gated flow.
  - [x] 2.5e The Gridlock Gym battle backdrop in `game/sprites/scenery.ts`.
- [x] 2.6 Memory management: contiguous allocation (first/best/worst fit), fragmentation, paging and **address translation** problems, page tables (multi-level, inverted), TLB and effective access time, segmentation.
  - [x] 2.6a Memory simulators (`game/sim/memory.ts`: first/best/worst fit with hole bookkeeping, fragmentation, paging translation, multi-level splits, inverted lookup, TLB effective access time, segmentation) tested against Silberschatz's worked examples.
  - [x] 2.6b Five Heap Harbor lessons (contiguous allocation and fragmentation, paging and address translation, page-table structures, TLB and effective access time, segmentation) with pixel diagrams and tested quick checks.
  - [x] 2.6c1 Memory question pool and seeded generators (fit placement, internal fragmentation, address translation, page-table size, EAT, two-level split, segment lookup) wired into `POOLS.memory`.
  - [x] 2.6c2 A tap-to-translate question kind (split a logical address, pick the frame) and one generator using it.
  - [x] 2.6d The Heap Harbor trainer creature (64×64, front + back, idle/attack/hurt), dex entry, trainer battles and gated flow.
  - [x] 2.6e The Heap Harbor battle backdrop in `game/sprites/scenery.ts`.
- [x] 2.7 Virtual memory: demand paging, **page replacement** (FIFO, LRU, Optimal, Clock) with fault-counting simulators and Belady's anomaly demo, thrashing and working sets.
  - [x] 2.7a Virtual-memory simulators (`game/sim/paging.ts`: FIFO/LRU/Optimal/Clock with per-reference traces, Belady's anomaly, demand-paging EAT, working sets, thrashing) tested against Silberschatz's examples.
  - [x] 2.7b Five Pagewood lessons (demand paging and page faults, page replacement, Belady and stack algorithms, frame allocation and thrashing, working sets) with pixel diagrams and tested quick checks.
  - [x] 2.7c1 Virtual-memory question pool (12 authored: mcq, multi, numeric, order) and six seeded generators (fault counts per policy, victim choice, EAT, tolerable fault rate, working-set size, thrashing check).
  - [x] 2.7c2 A tap-the-victim question kind (tap the frame a policy evicts, step through a reference string) and one generator using it.
  - [x] 2.7d The virtual-memory gym trainer creature (64×64, front + back, idle/attack/hurt), dex entry, trainer battles and gated flow.
  - [x] 2.7e The virtual-memory gym battle backdrop in `game/sprites/scenery.ts`.
- [x] 2.8 Storage and file systems: file allocation (contiguous/linked/indexed), inodes and max-file-size calculations, directories, journaling, RAID levels, **disk scheduling** (FCFS, SSTF, SCAN, C-SCAN, LOOK) with head-movement problems.
  - [x] 2.8a Storage simulators (`game/sim/storage.ts`: FCFS/SSTF/SCAN/C-SCAN/LOOK/C-LOOK head movement, inode max file size, file-allocation block counts, RAID capacity/fault tolerance) tested against Silberschatz's worked examples.
  - [x] 2.8b Five Disk Docks lessons (file allocation, inodes, directories and journaling, RAID, disk scheduling) with pixel diagrams and tested quick checks.
  - [x] 2.8c1 Storage question pool and seeded generators (head movement per algorithm, max file size, RAID capacity, linked-allocation reads) wired into `POOLS`.
  - [x] 2.8c2 A tap-the-next-track question kind for disk scheduling and one generator using it.
  - [x] 2.8d The storage gym trainer creature (64×64, front + back, idle/attack/hurt), dex entry, trainer battles and gated flow.
  - [x] 2.8e The storage gym battle backdrop in `game/sprites/scenery.ts`.
- [x] 2.9 Interview gauntlet: the top OS interview questions (process vs thread, virtual memory, thrashing, mutex vs semaphore, deadlock handling, paging vs segmentation, how `malloc` works, what happens on a page fault, Linux specifics like `epoll` and copy-on-write) as a timed mock interview with a scorecard.
  - [x] 2.9a Interview question pool: 23 authored questions (`content/interviewQuestions.ts`) + the six boss questions in `POOLS.interview`, answers checked against the simulators.
  - [x] 2.9b Mock-interview engine (`game/engine/interview.ts`, topic tags in `content/interviewTopics.ts`): topic-balanced 10-question draw, per-kind time limits, speed bonus scoring, scorecard and verdict.
  - [x] 2.9c The `/interview` screen: timer bar, one question at a time (reusing `AnswerPanel`), scorecard with per-topic bars, verdict and best score saved.
  - [x] 2.9d (map link "MOCK INTERVIEW" already added in 2.9c) Link the interview from the Kernel Summit gym card, add an e2e-style test, and cover the screen with Playwright at desktop and iPhone 14.

## 3. Polish

- [x] 3.1 Daily challenge (date-seeded) and streaks.
- [x] 3.2 Accessibility and performance pass on iPhone.
  - [x] 3.2a Accessibility audit of every route at iPhone size (tap targets, names, landmarks, overflow): battle stage labelled with a heading, keyboard focus ring.
  - [x] 3.2b Typewriter message box announces whole lines to screen readers (`MessageBox` `fullText`).
  - [x] 3.2c First-load JS: measured per-route gzip size (Pixi was already a dynamic import); the map no longer bundles the question bank (`ReviewLink` loads it after first paint), 325 KB -> 271 KB gzipped.
  - [x] 3.2d Measured battle frame cost on a 4x CPU-throttled iPhone profile: JS is ~3.5% of a core, so no trim needed (see PROGRESS).

## 4. Hardening

- [x] 4.1 Whole-bank audit test (`tests/bankAudit.test.ts`): unique ids across every gym pool, every generator deterministic and well-formed over 40 seeds.
- [x] 4.2 Offline-reload Playwright check: after one online load, reload every route (title, map, dex, daily, interview, review, starter, battle, lessons, gyms) with the network off.
- [x] 4.3 Save-file corruption tests (`tests/saveCorruption.test.ts`); `parseSave` now keeps only known, de-duplicated badges.
- [x] 4.4 Visual pass of every lesson page on iPhone 14 (40 lessons, ~100 pages): no overflow, no console errors, diagrams reviewed.
- [x] 4.5 Small-phone pass (iPhone SE, 320 px) and desktop of battle, map, interview, starter: fixed the starter row being clipped on both sides at 320 px.
- [x] 4.6 Landscape phone battle layout: stage and answer panel side by side on short landscape screens (`land` variant in `globals.css`).
- [x] 4.7 Landscape phone starter screen: creatures on the left, message and detail card on the right (`land` variant).
- [x] 4.8 Landscape phone map: the gym card becomes a right-hand side panel and the map scrolls on the left (`land` variant). The interview screen already fit.
- [x] 4.9 Landscape phone Kerneldex: detail card on the left (sticky, scrolls), creature grid on the right (`land` variant). Daily and Leitner box already fit.
- [x] 4.10 Landscape phone lesson pages: mascot/diagram on the left, lesson text on the right (`land` variant). Gym gate and lesson list already fit.
- [x] 4.11 Landscape phone interview scorecard: verdict and answers on the left, topic bars on the right (`land` variant). The ask screen already fit.
- [x] 4.12 Landscape phone title screen: title and buttons on the left, mascot on the right (`land` variant), so it fits without scrolling.
- [x] 4.13 Landscape pass of the gym trainer battle and boss gate (iPhone 14 landscape, portrait, desktop): both already fit with no overflow, so no code change.

## 5. Content depth

- [x] 5.1 Five more Kernel Summit interview questions (hard vs symbolic links, journaling order, SJF, SSTF, inode capacity), each checked against the simulators.
- [x] 5.2 Five more interview questions on synchronization and deadlock (Banker safe sequence, lock ordering, Coffman conditions, bounded-buffer producer order, resource-graph cycles), each checked against the simulators.
- [x] 5.3 Five more interview questions on memory (Belady's anomaly, Optimal faults, internal fragmentation, flat page-table size, first-fit vs best-fit), each checked against the simulators.
- [x] 5.4 Five more interview questions on storage (LOOK head movement, linked-allocation reads and payload, RAID 5 capacity, RAID 6 fault tolerance), each checked against the simulators.
- [x] 5.5 Five more interview questions on processes (fork print count, `if (fork() == 0)` process count, WAITING to READY on I/O completion, exec semantics, shared-memory IPC), checked against the simulators.
- [x] 5.6 Five more interview questions on file systems and Linux (double-indirect inode reach, indexed-allocation reads, shared fd offset after fork, unlink of an open file, write() durability), checked against the simulators.
- [x] 5.7 Five more interview questions on scheduling (Round Robin and SRTF average waits, convoy effect, starvation and aging, large-quantum RR), checked against the simulators.
- [x] 5.8 Five more interview questions on OS basics (trap vs interrupt, privileged instructions, why syscalls trap, BIOS boot order, microkernel trade-off), checked against the basics tables.
- [x] 5.9 Five more interview questions on synchronization primitives (counting semaphore value, lost-update minimum, flag-then-check protocol, spinlock vs mutex, condition-variable while loop), checked against the sync simulators.
- [x] 5.10 Five more interview questions on threads and IPC (what threads own, cheaper thread switch, copy-on-write fork, FIFO vs pipe, SIGINT), checked against the IPC cases.
- [x] 5.11 Five more interview questions on virtual memory (FIFO faults on the textbook string, page-size trade-off, TLB flush without ASIDs, working-set size, max fault rate for a 10% slowdown), checked against the paging simulator.
- [x] 5.12 Five more interview questions on deadlock (refused unsafe Banker request, minimum instances for deadlock freedom, detection count, three-thread lock ring, dining philosophers fix), checked against the deadlock simulator.
- [x] 5.13 Five more interview questions on scheduling metrics (FCFS turnaround, RR response time, SJF optimality, exponential burst prediction, context-switch overhead), checked against the scheduling simulators.
- [x] 5.14 Five more interview questions on memory allocation (first-fit unplaced requests, page-table size, TLB effective access time, two-level index bits, internal vs external fragmentation), checked against the memory simulators.
- [x] 5.15 Five more interview questions on disk scheduling (FCFS, SCAN and C-SCAN head movement on the textbook queue, SSTF starvation, why C-SCAN), checked against the disk simulator.
- [x] 5.16 Five more interview questions on RAID and file allocation (RAID 10 and RAID 6 capacity, RAID 5 small-write penalty, where a file name lives, contiguous-allocation drawback), checked against the storage simulator.
- [x] 5.17 Five more interview questions on Linux practice (epoll vs select, lowest file descriptor, hard-link count, SIGKILL, full pipes), checked in the pool test.
- [x] 5.18 Five more interview questions on threads and synchronization (thread stacks, dining-philosophers concurrency, compare-and-swap, priority inversion, lost wakeups), checked in the pool test.
- [x] 5.19 Five more interview questions on paging and address translation (LRU and FIFO faults with 4 frames, page number of an address, inverted page tables, pure demand paging), checked against the paging simulator.
- [x] 5.20 Five more interview questions on OS basics (trap-based mode switch, interrupt vs trap, loadable kernel modules, PID 1, why privileged instructions), checked in the pool test.
- [x] 5.21 Five more interview questions on file-system caching (page-cache write-back, read-ahead, fsync, cache-miss effective access time, O_DIRECT), checked in the pool test.
- [x] 5.22 Five more interview questions on virtualization and containers (containers vs VMs, namespaces, cgroups, type 1 vs type 2 hypervisors, nested paging), checked in the pool test.
- [x] 5.23 Five more interview questions on protection and security (user/kernel mode bit, NX, ASLR, least privilege, ACLs vs capabilities), checked in the pool test.
- [x] 5.24 Five more interview questions on boot and process lifecycle (bootloader, initramfs, fork bombs, orphans, exec), checked in the pool test.
- [x] 5.25 Five more interview questions on signals (SIGSTOP/SIGCONT job control, SIGCHLD and zombies, SIGPIPE, async-signal safety, SIGSEGV), checked in the pool test.
- [x] 5.26 Five more interview questions on I/O and device drivers (polling vs interrupts, top/bottom halves, block vs character devices, MMIO, non-blocking vs async I/O), checked in the pool test.
- [x] 5.27 Five more interview questions on CPU caches (AMAT, tag bits, locality, false sharing, write-back vs write-through), checked in the pool test.
- [x] 5.28 Five more interview questions on concurrency bugs (data race vs race condition, livelock, ABA, memory reordering, writer starvation), checked in the pool test.
- [x] 5.29 Five more interview questions on file-system consistency (why fsck is slow, ordered-mode journaling, copy-on-write file systems, inode exhaustion, atomic replace via rename), checked in the pool test.
- [x] 5.30 Five more interview questions on kernel networking (sendfile zero-copy, listen backlog, send-buffer back-pressure, SO_REUSEADDR/TIME_WAIT, edge-triggered epoll), checked in the pool test.
- [x] 5.31 Five more interview questions on scheduler tuning (nice values, CFS vruntime, SCHED_FIFO starvation, CPU affinity, load average), checked in the pool test.

## 6. FAANG-level interview readiness

Audit (2026-10-25): the textbook core is well covered (40 lessons, 8 gyms, ~180 interview questions, simulators for scheduling, paging, Banker's, disk, RAID). Gaps against what SDE interviews at large tech companies actually ask: (a) hands-on concurrency *coding* (producer-consumer, thread pool, thread-safe LRU, rate limiter, dining philosophers, readers-writers written out in code), (b) code-reading "spot the bug" rounds, (c) lessons for modern Linux topics that only exist as quiz questions today (containers/namespaces/cgroups, virtualization, atomics and memory models, futexes, allocators), (d) production-debugging scenarios (strace, /proc, vmstat/top, perf, core dumps, OOM, high load), (e) an interview mode that feels like a round (multi-part scenario, follow-ups), not only a flat 10-question quiz. Do these in order, one slice per run; each must have tested answers and, for simulators, textbook or hand-checked examples.

- [x] 6.1 Code-reading question kind `bugspot`: show 8-15 lines of C/pseudocode with tappable lines; the player taps the line(s) that contain the race / missing unlock / lost wakeup / use-after-free. Answers authored per snippet and checked by tests (including that exactly the keyed lines are marked). Reuse the lesson play page and `AnswerPanel`.
  - [x] 6.1a The question kind, `BugSpotBoard` widget (touch-friendly, monospaced, 16px+ text), grading and tests.
  - [x] 6.1b Ten snippets: unlocked counter++, check-then-act (TOCTOU), `if` instead of `while` around `cond_wait`, lock-order inversion, missing unlock on early return, double-checked locking without a barrier, signal lost because notify before wait, buffer overflow in a bounded buffer index, fork() without checking -1, closing an fd twice.
- [x] 6.2 Code-completion kind `fill`: a short program with 1-3 blanks chosen from tapped options (e.g. which semaphore ops go where in producer-consumer; `while` vs `if`; `pthread_mutex_unlock` placement). Grading by exact blank match, tests per snippet.
  - [x] 6.2a The kind and widget.
  - [x] 6.2b Classic problems as fills: bounded buffer with semaphores, bounded buffer with mutex + two condition variables, readers-writers (reader preference), dining philosophers with an asymmetric pickup order, barrier with a counter, one-time init with a once flag.
- [x] 6.3 Concurrency-coding simulator (`game/sim/threads.ts`): run a small multi-thread program under every interleaving (or a seeded random scheduler) and report deadlock / lost update / starvation, to prove each authored "correct" solution in 6.2 is correct and each buggy one in 6.1 fails. Tests check the solutions, so the content is not just trusted.
  - [x] 6.3a `game/sim/threads.ts`: exhaustive interleaving explorer (mutexes, semaphores, condvars with lost wakeups and optional spurious wakeups) reporting deadlock, failed asserts, misuse and every final value, with shortest counterexamples.
  - [x] 6.3b Every 6.2 fill problem as a model in `tests/fillModels.test.ts`: all option combinations run, only the keyed one is safe.
  - [x] 6.3c Models for the 6.1 bugspot snippets that are concurrency bugs (unlocked counter++, TOCTOU, `if` around `cond_wait`, lock-order inversion, missing unlock, lost signal): buggy version fails, fixed version is safe. Add a starvation / bounded-waiting check (a thread that can never finish under a fair schedule).
- [x] 6.4 Lessons for Linux topics that today exist only as questions (five lessons each, with pixel diagrams and tested quick checks):
  - [x] 6.4a Containers (lessons live in the Kernel Summit gym's lecture hall, `gym: "interview"`): namespaces (pid, net, mnt, uts, user), cgroups (cpu.max, memory.max, OOM kills), union file systems, why containers share a kernel vs VMs.
    - [x] 6.4a-1 `game/sim/containers.ts` (PID namespaces, cpu.max, cpu.weight, memory.max) plus the namespaces and cgroups lessons with diagrams and tested checks.
    - [x] 6.4a-2 Union file systems / overlayfs (layers, copy-up, whiteouts) and containers vs VMs (shared kernel, startup, isolation strength, escapes), with diagrams and tested checks; then a "what `docker run` does" recap lesson (clone with namespaces, cgroup attach, pivot_root, exec).
  - [x] 6.4b Virtualization: trap-and-emulate, hardware-assisted virtualization, shadow vs nested page tables, paravirtual drivers, type 1 vs type 2 hypervisors, live migration.
  - [x] 6.4c Atomics and memory models: compare-and-swap, ABA, acquire/release, why `volatile` is not synchronization, false sharing, lock-free stack, spinlock vs mutex vs futex (the fast path stays in user space).
    - [x] 6.4c-1 `game/sim/atomics.ts` (ABA on a Treiber stack, store-buffer litmus tests under SC / TSO / relaxed) plus the CAS/ABA and memory-ordering/volatile lessons with diagrams and tested checks.
    - [x] 6.4c-2 False sharing (cache-line ping-pong, padding, a cost model) and spinlock vs mutex vs futex lessons with diagrams and tested checks.
  - [x] 6.4d Memory allocators: brk vs mmap, free lists, fragmentation, buddy system, slab allocation, thread-local caches (tcmalloc/jemalloc idea), memory leaks vs fragmentation, huge pages.
    - [x] 6.4d-1 `game/sim/allocator.ts` (free-list heap with first/best/worst fit and coalescing, buddy system, brk-vs-mmap threshold) plus the "malloc: brk, mmap and free lists" and "The buddy system" lessons with diagrams and tested checks.
    - [x] 6.4d-2 Slab allocation (object caches, constructors, no internal waste), thread-local caches (tcmalloc/jemalloc idea) and huge pages (TLB reach), with a simulator, diagrams and tested checks.
  - [x] 6.4e I/O models and servers:
    - [x] 6.4e-1 `game/sim/ionet.ts` (Stevens' five I/O models, select/poll/epoll scan cost and FD_SETSIZE, threaded vs event-loop throughput) plus the "five I/O models" and "select, poll and epoll" lessons with diagrams and tested checks.
    - [x] 6.4e-2 Server architectures (thread-per-connection vs event loop vs thread pool, the C10K problem, thread stack memory) and zero-copy (`sendfile`, copies and context switches), with diagrams and tested checks.
- [x] 6.5 Calculations that interviews like and are not yet generated: context-switch overhead percentage for a quantum, Amdahl's law speedup with a serial fraction, utilization bounds for rate-monotonic scheduling (Liu & Layland), hit-ratio to effective access time for a two-level cache, throughput with N threads and lock contention, thread-pool sizing (CPU-bound N+1 vs I/O-bound N*(1+W/C)), pipe/socket buffer sizing. Seeded generators with textbook-checked tests.
- [x] 6.6 Production-debugging scenario kind `incident`: a short story with real-looking tool output (top / vmstat / free / `strace -c` / dmesg OOM line / `ps` showing D or Z states), then 2-3 chained questions ("what is the bottleneck", "what do you run next", "root cause"). Authored scenarios, each answer justified from the printed output.
  - [x] 6.6a The kind (scenario text + monospaced output panel + chained questions) and tests.
  - [x] 6.6b Eight scenarios (high load with idle CPU is `inc-io-wait` in `content/incidentQuestions.ts`):
    - [x] 6.6b-1 Runaway memory and the OOM killer (`inc-oom`), zombie pile-up (`inc-zombies`), thread-pool deadlock under load (`inc-pool-deadlock`).
    - [x] 6.6b-2 Context-switch storm from too many threads, swap thrashing.
    - [x] 6.6b-3 fd exhaustion (EMFILE), a 100% CPU spin lock.
- [x] 6.7 Linux command and file-system toolkit gym section: quiz and simulate `ps`, `top`, `vmstat`, `iostat`, `lsof`, `strace`, `ltrace`, `perf`, `/proc/<pid>/{status,maps,fd}`, `kill -l`, `ulimit`, `nice`, `taskset`, `free`; "which tool answers this question" matching questions.
- [x] 6.8 Design-style questions ("how would you build...") as ordered/multi questions with a reference outline: a thread-safe LRU cache, a rate limiter, a thread pool with a bounded queue, a user-space scheduler, a simple malloc, a shell with pipes (fork/exec/dup2), a file-descriptor-based chat server. Each has an ordered "design steps" question plus a "what breaks without X" follow-up.
- [x] 6.9 Interview mode as rounds: `/interview` gets a round picker (Fundamentals 10Q, Concurrency coding, Debugging incident, Design, Full loop = one of each with a combined scorecard and a "hire / lean hire / no hire" verdict), per-round timers, and a weak-topic study plan linking back to the matching lessons.
- [x] 6.10 Interview difficulty tiers: tag every interview question easy / medium / hard (screen vs onsite vs staff-level follow-up), balance the draw by tier, and show the tier on the scorecard. Add a test that each topic has all three tiers.
- [x] 6.11 Review-queue integration: wrong answers from every new kind (bugspot, fill, incident) feed the existing review/spaced-repetition screen and the daily challenge.
- [x] 6.12 Whole-bank audit extension: every new kind covered in `tests/bankAudit.test.ts` (unique ids, keyed answers valid, no answer position bias, explanations present), plus Playwright desktop + iPhone 14 screenshots of each new widget with no overflow or console errors.
- [ ] 6.13 After 6.1-6.12: a coverage matrix in `docs/COVERAGE.md` mapping typical SDE OS interview topics (processes/threads, scheduling, sync, deadlock, memory, virtual memory, file systems, I/O, IPC, signals, containers/virtualization, performance debugging, concurrency coding) to the lessons, generators and questions that cover them, and fill any hole it shows.
