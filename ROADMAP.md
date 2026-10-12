# Kernel Clash roadmap

The hourly routine works top to bottom: take the first unchecked box. Split big items into sub-boxes when you start them.

## 0. Bootstrap (reuse Query Clash's engine)

- [x] 0.1 Scaffold Next.js 16 + TypeScript + Tailwind 4 + Vitest + ESLint, copying configs from Query Clash. Static export with `BASE_PATH=/kernel-clash`, the PWA manifest and icons (an original "KC" pixel icon), the offline service worker (with the worker-fragment fix), and `ci.yml` + `pages.yml`. Ship a placeholder title screen that deploys and installs.
- [x] 0.2 Port the Pixi battle engine (stage, tweens, particles, camera, audio synth, battle reducer, UI kit, save) and get a demo battle running.
- [x] 0.3 Pixel-sprite system: palette + character-grid sprites rendered to nearest-neighbour textures, with idle frames. Add a sprite-validity test.
- [x] 0.4 GBA-style battle screen: foe front sprite on a platform top-right, player creature back sprite bottom-left, HP/XP boxes, typed-out message box, and a move menu of 4 answer options (tap-friendly).

## 1. Game structure

- [ ] 1.1 Region map with 9 "gyms" (one per chapter below) and an original boss creature per gym (e.g. a fork-spawning hydra for processes, a clock-golem for scheduling, a lock-serpent for sync, a deadlock crab, a page-moth for memory…). Badges are earned per gym.
  - [x] 1.1a Pixel overworld region map with the 9 gym buildings, gym data (chapter, topics, boss, badge), badge case, unlock order, and a save (`lib/save.ts`). PRESS START opens the map.
  - [x] 1.1b Boss creatures for gyms 1–2 (96×96, front + back, idle/attack/hurt): Trapjaw (OS basics) and Hydrafork (processes).
  - [ ] 1.1c Bosses for gyms 3–4: Chronogolem (scheduling) and Mutexa (sync).
  - [ ] 1.1d Bosses for gyms 5–6: Deadlocrab (deadlocks) and Heapotamus (memory).
  - [ ] 1.1e Bosses for gyms 7–9: Thrashmoth (virtual memory), Diskraken (storage) and Kernelord (interview gauntlet).
  - [ ] 1.1f Gym boss battles: enter a gym from the map, fight its boss, earn its badge (saved), unlock the next gym.
- [ ] 1.2 Move types (Process, Scheduler, Sync, Memory, Storage, IO…) with a type chart and super-effective messages. Tests for the chart.
- [ ] 1.3 Starter creature choice, XP and levels, evolution at gym milestones, and a capture box ("Kerneldex").
- [ ] 1.4 A question engine with MCQ / multi-select / numeric / order-the-steps / generated problems, explanations after every answer, and a Leitner spaced-repetition box.

## 2. Curriculum (each gym: concept lessons → generated battles → boss)

- [ ] 2.1 OS basics: kernel vs user mode, system calls, interrupts and traps, monolithic/micro/hybrid kernels, booting.
- [ ] 2.2 Processes and threads: PCB, states and transitions (an animated state diagram), context switch, fork/exec/wait (predict-the-output puzzles for `fork()` trees), user vs kernel threads, IPC (pipes, shared memory, message passing).
- [ ] 2.3 CPU scheduling: FCFS, SJF, SRTF, Priority (with aging), Round Robin, MLFQ. A **simulator draws Gantt charts**. Generated problems ask for average waiting/turnaround/response time, and the player builds the Gantt chart by tapping. Validated against textbook examples.
- [ ] 2.4 Synchronization: race conditions (spot-the-race in pseudocode), critical-section requirements, Peterson's algorithm, mutex vs semaphore, monitors and condition variables, producer–consumer, readers–writers, dining philosophers. Interactive step-through interleavings.
- [ ] 2.5 Deadlocks: Coffman conditions, resource-allocation graphs (cycle detection), prevention/avoidance/detection/recovery, and the **Banker's algorithm** (generated safe-sequence and request-granting problems, solver-checked).
- [ ] 2.6 Memory management: contiguous allocation (first/best/worst fit), fragmentation, paging and **address translation** problems, page tables (multi-level, inverted), TLB and effective access time, segmentation.
- [ ] 2.7 Virtual memory: demand paging, **page replacement** (FIFO, LRU, Optimal, Clock) with fault-counting simulators and Belady's anomaly demo, thrashing and working sets.
- [ ] 2.8 Storage and file systems: file allocation (contiguous/linked/indexed), inodes and max-file-size calculations, directories, journaling, RAID levels, **disk scheduling** (FCFS, SSTF, SCAN, C-SCAN, LOOK) with head-movement problems.
- [ ] 2.9 Interview gauntlet: the top OS interview questions (process vs thread, virtual memory, thrashing, mutex vs semaphore, deadlock handling, paging vs segmentation, how `malloc` works, what happens on a page fault, Linux specifics like `epoll` and copy-on-write) as a timed mock interview with a scorecard.

## 3. Polish

- [ ] 3.1 Daily challenge (date-seeded) and streaks.
- [ ] 3.2 Accessibility and performance pass on iPhone.
