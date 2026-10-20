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
- [ ] 2.3 CPU scheduling: FCFS, SJF, SRTF, Priority (with aging), Round Robin, MLFQ. A **simulator draws Gantt charts**. Generated problems ask for average waiting/turnaround/response time, and the player builds the Gantt chart by tapping. Validated against textbook examples.
  - [x] 2.3a Scheduling simulators beyond FCFS: SJF, SRTF, priority (preemptive or not, with aging), Round Robin and MLFQ, each returning a merged Gantt chart and per-job times, tested against Silberschatz's worked examples plus random-workload invariants.
  - [ ] 2.3b A pixel Gantt-chart renderer (the simulator's chart drawn as blocks with a time axis) used in explanations, plus five scheduling lessons in the Clocktower lecture hall (criteria and FCFS/convoy, SJF/SRTF, priority and aging, Round Robin and the quantum, MLFQ) with tested quick checks.
  - [ ] 2.3c Scheduling question pool (every kind, ~20) plus generators (average waiting/turnaround/response for each algorithm, which algorithm produced this chart), all solver-checked; gym battles draw from it.
  - [ ] 2.3d A tap-to-build Gantt-chart question kind: the player taps processes into the chart block by block, graded against the simulator, on desktop and iPhone.
  - [ ] 2.3e The Clocktower trainer creature (64×64, front + back, idle/attack/hurt), dex entry, trainer battles and the gated flow, with screenshots.
  - [ ] 2.3f The Clocktower battle backdrop (sky, horizon, platform, props) in `game/sprites/scenery.ts`.
- [ ] 2.4 Synchronization: race conditions (spot-the-race in pseudocode), critical-section requirements, Peterson's algorithm, mutex vs semaphore, monitors and condition variables, producer–consumer, readers–writers, dining philosophers. Interactive step-through interleavings.
- [ ] 2.5 Deadlocks: Coffman conditions, resource-allocation graphs (cycle detection), prevention/avoidance/detection/recovery, and the **Banker's algorithm** (generated safe-sequence and request-granting problems, solver-checked).
- [ ] 2.6 Memory management: contiguous allocation (first/best/worst fit), fragmentation, paging and **address translation** problems, page tables (multi-level, inverted), TLB and effective access time, segmentation.
- [ ] 2.7 Virtual memory: demand paging, **page replacement** (FIFO, LRU, Optimal, Clock) with fault-counting simulators and Belady's anomaly demo, thrashing and working sets.
- [ ] 2.8 Storage and file systems: file allocation (contiguous/linked/indexed), inodes and max-file-size calculations, directories, journaling, RAID levels, **disk scheduling** (FCFS, SSTF, SCAN, C-SCAN, LOOK) with head-movement problems.
- [ ] 2.9 Interview gauntlet: the top OS interview questions (process vs thread, virtual memory, thrashing, mutex vs semaphore, deadlock handling, paging vs segmentation, how `malloc` works, what happens on a page fault, Linux specifics like `epoll` and copy-on-write) as a timed mock interview with a scorecard.

## 3. Polish

- [ ] 3.1 Daily challenge (date-seeded) and streaks.
- [ ] 3.2 Accessibility and performance pass on iPhone.
