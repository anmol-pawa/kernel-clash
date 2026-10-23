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
