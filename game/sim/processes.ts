/**
 * Facts for the processes-and-threads generators: the five-state process
 * model (Silberschatz §3.1.2) and which IPC mechanism suits which job.
 */
export type PState = "NEW" | "READY" | "RUNNING" | "WAITING" | "TERMINATED";

export const PSTATES: readonly PState[] = ["NEW", "READY", "RUNNING", "WAITING", "TERMINATED"];

export type PEvent = "admit" | "dispatch" | "preempt" | "block" | "wake" | "exit";

/** The six transitions of the five-state diagram, one per event. */
export const TRANSITIONS: Record<PEvent, { from: PState; to: PState }> = {
  admit: { from: "NEW", to: "READY" },
  dispatch: { from: "READY", to: "RUNNING" },
  preempt: { from: "RUNNING", to: "READY" },
  block: { from: "RUNNING", to: "WAITING" },
  wake: { from: "WAITING", to: "READY" },
  exit: { from: "RUNNING", to: "TERMINATED" },
};

/** Ways to describe each event in a trace (block and wake come in matching pairs, see WAITS). */
export const EVENT_TEXT: Record<Exclude<PEvent, "block" | "wake">, readonly string[]> = {
  admit: ["the OS admits it to the ready queue", "the OS finishes creating it and admits it"],
  dispatch: ["the scheduler dispatches it to the CPU", "the dispatcher gives it the CPU"],
  preempt: ["a timer interrupt ends its time slice", "the scheduler preempts it for another process"],
  exit: ["it calls exit()", "it returns from main()"],
};

/** What it waits for (block) and what ends the wait (wake). */
export const WAITS: readonly [string, string][] = [
  ["it calls read() on a disk file and must wait", "the disk read completes"],
  ["it waits for a key press", "the user presses a key"],
  ["it calls wait() for its running child", "the child exits"],
];

/** The state after an event, or null if the event can't happen in `s`. */
export function step(s: PState, e: PEvent): PState | null {
  const t = TRANSITIONS[e];
  return t.from === s ? t.to : null;
}

/** Run a trace from `start`; throws on an impossible event. */
export function trace(start: PState, events: readonly PEvent[]): PState {
  return events.reduce<PState>((s, e) => {
    const n = step(s, e);
    if (!n) throw new Error(`${e} can't happen in ${s}`);
    return n;
  }, start);
}

/** Events possible in a state (none once TERMINATED). */
export const eventsFrom = (s: PState) => (Object.keys(TRANSITIONS) as PEvent[]).filter((e) => TRANSITIONS[e].from === s);

/** Arrows that are not in the five-state diagram. */
export const INVALID_TRANSITIONS: readonly [PState, PState][] = [
  ["WAITING", "RUNNING"],
  ["READY", "WAITING"],
  ["NEW", "RUNNING"],
  ["TERMINATED", "READY"],
  ["NEW", "WAITING"],
  ["TERMINATED", "RUNNING"],
];

export type Ipc = "Shared memory" | "An ordinary (anonymous) pipe" | "A named pipe (FIFO)" | "A message queue" | "A socket" | "A signal";

export const IPCS: readonly Ipc[] = ["Shared memory", "An ordinary (anonymous) pipe", "A named pipe (FIFO)", "A message queue", "A socket", "A signal"];

export interface IpcCase {
  text: string;
  answer: Ipc;
  /** mechanisms that clearly don't fit (the distractors are drawn from these) */
  wrong: readonly Ipc[];
  why: string;
}

export const IPC_CASES: readonly IpcCase[] = [
  {
    text: "A shell runs `ls | wc -l`, connecting the output of one child to the input of the other.",
    answer: "An ordinary (anonymous) pipe",
    wrong: ["Shared memory", "A signal", "A message queue", "A socket"],
    why: "The shell calls pipe() before forking, so both children inherit the two ends: a one-way byte stream between related processes, gone when they exit.",
  },
  {
    text: "A parent process forks a child and wants the simplest one-way byte stream to it (no record boundaries, no shared variables).",
    answer: "An ordinary (anonymous) pipe",
    wrong: ["A signal", "Shared memory", "A message queue"],
    why: "An ordinary pipe is one-way and needs a parent–child relationship to hand the ends over, which is exactly this case.",
  },
  {
    text: "Two unrelated programs on one machine, started separately, need a one-way byte stream they can both find by a path name.",
    answer: "A named pipe (FIFO)",
    wrong: ["An ordinary (anonymous) pipe", "A signal", "Shared memory"],
    why: "A FIFO has a name in the file system (made with mkfifo), so unrelated processes can open it. An ordinary pipe has no name and only reaches related processes.",
  },
  {
    text: "A video decoder and a renderer on one machine pass hundreds of megabytes of frames per second and synchronize access themselves.",
    answer: "Shared memory",
    wrong: ["A signal", "A named pipe (FIFO)", "An ordinary (anonymous) pipe", "A message queue"],
    why: "Once mapped, shared memory needs no system call per transfer and no copying through the kernel, so it is the fastest for bulk data; the processes must synchronize themselves.",
  },
  {
    text: "A web browser fetches a page from a server on another computer.",
    answer: "A socket",
    wrong: ["Shared memory", "An ordinary (anonymous) pipe", "A signal", "A named pipe (FIFO)"],
    why: "Pipes and shared memory only work within one machine. A socket is an endpoint (IP address and port) for communication across a network.",
  },
  {
    text: "The user presses Ctrl-C and the terminal must tell the running program to stop.",
    answer: "A signal",
    wrong: ["Shared memory", "A message queue", "A named pipe (FIFO)"],
    why: "Ctrl-C makes the kernel send SIGINT to the foreground process: a signal is a small asynchronous notification, not a data channel.",
  },
  {
    text: "Worker processes on one machine send small, separate job records to a manager, and the kernel should keep the record boundaries and do the synchronization.",
    answer: "A message queue",
    wrong: ["A signal", "Shared memory", "An ordinary (anonymous) pipe"],
    why: "A message queue keeps each message whole and the kernel synchronizes send() and receive(). A pipe is a plain byte stream, and shared memory leaves synchronization to you.",
  },
  {
    text: "A program learns that one of its child processes has just exited, without polling.",
    answer: "A signal",
    wrong: ["Shared memory", "A named pipe (FIFO)", "A socket"],
    why: "The kernel sends the parent SIGCHLD when a child exits, so a handler can call wait() to reap it.",
  },
];
