import type { MoveType } from "@/game/engine/types";

/**
 * The nine gyms of the region, one per curriculum chapter (ROADMAP §2). They
 * are cleared in order: beating a gym's boss earns its badge and opens the
 * next gym on the map.
 */
export interface Gym {
  id: string;
  /** 1-based order on the map */
  n: number;
  name: string;
  /** curriculum chapter title */
  chapter: string;
  type: MoveType;
  topics: string[];
  boss: { name: string; blurb: string };
  /** the gym's trainer creature, fought before the boss (gyms with trainer battles only) */
  trainer?: { name: string; blurb: string };
  badge: string;
  /** roof / badge colour ramp, dark → light */
  ramp: [string, string, string, string];
}

export const GYMS: Gym[] = [
  {
    id: "basics",
    n: 1,
    name: "Bootstrap Gym",
    chapter: "OS basics",
    type: "io",
    topics: ["Kernel vs user mode", "System calls", "Interrupts and traps", "Kernel designs", "Booting"],
    boss: { name: "Trapjaw", blurb: "A gatekeeper that snaps shut on every illegal instruction and drags it into kernel mode." },
    trainer: { name: "Syscallow", blurb: "A courier swallow that flies requests from user mode to the kernel. The wax seal on its letter is the system-call number." },
    badge: "Boot Badge",
    ramp: ["#3b2a6e", "#5b49a8", "#8a7ad8", "#c4b8ff"],
  },
  {
    id: "processes",
    n: 2,
    name: "Fork Grove Gym",
    chapter: "Processes and threads",
    type: "process",
    topics: ["PCB and process states", "Context switch", "fork / exec / wait", "Threads", "IPC"],
    boss: { name: "Hydrafork", blurb: "Every head it loses calls fork(). Count the children before they count you." },
    trainer: { name: "Forkupine", blurb: "A grove porcupine whose quills split in two at every tip. Each new quill gets a PID tag of its own: the parent's fork() returns that number, the quill's returns 0." },
    badge: "Fork Badge",
    ramp: ["#0f5a55", "#178f84", "#3cc9b5", "#9af2e2"],
  },
  {
    id: "scheduling",
    n: 3,
    name: "Clocktower Gym",
    chapter: "CPU scheduling",
    type: "scheduler",
    topics: ["FCFS and SJF", "SRTF and priority", "Round Robin", "MLFQ", "Gantt charts"],
    boss: { name: "Chronogolem", blurb: "A golem of gears that hands out time slices, and takes them back on the tick." },
    badge: "Quantum Badge",
    ramp: ["#7a3d0c", "#b8641a", "#e89a2c", "#ffd77a"],
  },
  {
    id: "sync",
    n: 4,
    name: "Mutex Marsh Gym",
    chapter: "Synchronization",
    type: "sync",
    topics: ["Race conditions", "Peterson's algorithm", "Mutexes and semaphores", "Monitors", "Classic problems"],
    boss: { name: "Mutexa", blurb: "A lock-serpent coiled round the critical section. Only one may pass at a time." },
    badge: "Lock Badge",
    ramp: ["#6a1a52", "#a02a7c", "#e05aa8", "#ffaedb"],
  },
  {
    id: "deadlocks",
    n: 5,
    name: "Gridlock Gym",
    chapter: "Deadlocks",
    type: "sync",
    topics: ["Coffman conditions", "Resource-allocation graphs", "Prevention and avoidance", "Banker's algorithm", "Recovery"],
    boss: { name: "Deadlocrab", blurb: "Each claw holds what the other one wants. Neither will ever let go." },
    badge: "Banker Badge",
    ramp: ["#6e1414", "#a82a20", "#e0533a", "#ff9c7a"],
  },
  {
    id: "memory",
    n: 6,
    name: "Heap Harbor Gym",
    chapter: "Memory management",
    type: "memory",
    topics: ["Contiguous allocation", "Fragmentation", "Paging and address translation", "TLB and EAT", "Segmentation"],
    boss: { name: "Heapotamus", blurb: "It swallows whole blocks and leaves the gaps behind." },
    badge: "Frame Badge",
    ramp: ["#173c78", "#2a62b8", "#4f93e8", "#a6d0ff"],
  },
  {
    id: "virtual",
    n: 7,
    name: "Swapwood Gym",
    chapter: "Virtual memory",
    type: "memory",
    topics: ["Demand paging", "FIFO, LRU, Optimal, Clock", "Belady's anomaly", "Thrashing", "Working sets"],
    boss: { name: "Thrashmoth", blurb: "Drawn to the light of a full frame table, it faults faster than you can swap." },
    badge: "Victim Badge",
    ramp: ["#3a1c6e", "#5e32a8", "#9466e0", "#d2b8ff"],
  },
  {
    id: "storage",
    n: 8,
    name: "Platter Peak Gym",
    chapter: "Storage and file systems",
    type: "storage",
    topics: ["File allocation", "Inodes", "Journaling", "RAID levels", "Disk scheduling"],
    boss: { name: "Diskraken", blurb: "Its tentacles sweep the platters: SCAN to the end, then all the way back." },
    badge: "Inode Badge",
    ramp: ["#2c4a14", "#4a7a1e", "#7cb83a", "#c4ec7a"],
  },
  {
    id: "interview",
    n: 9,
    name: "Kernel Summit",
    chapter: "Interview gauntlet",
    type: "process",
    topics: ["Process vs thread", "Page faults", "Mutex vs semaphore", "malloc and copy-on-write", "epoll"],
    boss: { name: "Kernelord", blurb: "The final interviewer. It has heard every answer, and it wants to know why." },
    badge: "Root Badge",
    ramp: ["#5a4410", "#9a7418", "#d8a828", "#fff0a0"],
  },
];
