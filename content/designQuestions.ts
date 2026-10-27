import { firstRunTimes, submitBurst, SELECT_MAX_FD } from "@/game/sim/designs";
import type { Question } from "@/game/engine/question";
import type { MoveType } from "@/game/engine/types";

/**
 * The design round: "how would you build..." as an ordered list of design
 * steps, plus a "what breaks without X" follow-up for each design. The
 * follow-ups are backed by the models in `game/sim/designs.ts`.
 */
const mv = (name: string, type: MoveType, power: number) => ({ name, type, power });

const rr = firstRunTimes([100, 5, 5], 10)[2];
const fcfs = firstRunTimes([100, 5, 5], null)[2];
const burst = submitBurst(8, 2, 3);

export const DESIGN_QUESTIONS: Question[] = [
  {
    id: "ds-lru-steps",
    kind: "order",
    prompt: "Design a thread-safe LRU cache. Put the design steps in a sensible order.",
    steps: ["Pick the structure: a hash map for O(1) lookup plus a recency order (a doubly linked list)", "get: find the entry and move it to the most-recently-used end", "put: insert at the MRU end and, when over capacity, evict the LRU end", "Protect the map and the list with one lock, since get also writes", "Measure contention, then shard the cache by key hash if the lock is hot"],
    explain: "Choose the data structure first, then define each operation on it, then make it safe, then make it fast. The lock comes after the operations because only then do you know what they touch: a get reorders the list, so it is a write.",
    move: mv("Cache Design", "memory", 38),
  },
  {
    id: "ds-lru-lock",
    prompt: "In your LRU cache, a teammate wants a readers-writer lock so many threads can run get() in parallel under the read lock. What goes wrong?",
    options: ["Nothing: get never changes anything", "get moves the entry to the MRU end, so concurrent gets corrupt the list", "Readers would starve writers, but the data stays correct", "The hash map cannot be read by two threads at once"],
    answer: 1,
    explain: "In an LRU cache a get is a write: it reorders the recency list. Two gets under a shared read lock would relink the same nodes at once and can corrupt the list. Use one mutex (or shard the cache), or make the recency update approximate and lock-free.",
    move: mv("Lock Audit", "sync", 36),
  },
  {
    id: "ds-rate-steps",
    kind: "order",
    prompt: "Design a rate limiter that allows 100 requests per second per client, with short bursts. Put the design steps in order.",
    steps: ["Choose the algorithm: a token bucket per client (capacity = burst size, refill = 100 per second)", "On each request, refill from the time elapsed since the last request, capped at capacity", "If at least one token is left, take it and allow the request", "Otherwise reject with 429 and a Retry-After hint", "Keep the buckets in a map guarded by per-key locks or atomics, and expire idle ones"],
    explain: "Pick the algorithm, define the refill (done lazily from timestamps, so no timer thread per client), then the allow/reject decision, and last the concurrent bookkeeping. Refilling from elapsed time is what makes it cheap.",
    move: mv("Throttle Plan", "sync", 38),
  },
  {
    id: "ds-rate-cap",
    prompt: "A token bucket forgets to cap the refill at its capacity. A client sends nothing for an hour, then floods. What happens?",
    options: ["Requests are rejected for the first hour", "Nothing: the limit still holds", "The bucket has an hour of tokens, so a huge burst gets through", "The refill thread crashes"],
    answer: 2,
    explain: "Capacity is the maximum burst. Without the cap, idle time accumulates tokens without bound (3,600 s x the rate), and the first flood after a quiet hour is allowed in full. Capping at the capacity is what bounds the burst.",
    move: mv("Burst Check", "sync", 34),
  },
  {
    id: "ds-pool-steps",
    kind: "order",
    prompt: "Design a thread pool with a bounded queue. Put the design steps in order.",
    steps: ["Start a fixed number of worker threads, sized from the cores and the CPU/IO mix", "Create a bounded blocking queue guarded by a mutex and two condition variables (not-empty, not-full)", "Workers loop: wait while empty, pop a task, run it outside the lock", "submit(): if the queue is full, apply a policy (block the caller, reject, or run it in the caller)", "shutdown(): set a flag, wake every worker, let them drain the queue and join"],
    explain: "Workers and the queue come first, then the worker loop, then what submit does when full (the back-pressure policy), and shutdown last. Running the task outside the lock keeps the queue from being held while user code runs.",
    move: mv("Pool Blueprint", "process", 38),
  },
  {
    id: "ds-pool-bound",
    prompt: `A pool has 2 workers. Eight tasks arrive at once. With a queue limited to 3, ${burst.running} run, ${burst.queued} wait and ${burst.rejected} are rejected. Why is that better than an unbounded queue under a long overload?`,
    options: ["It finishes every task sooner", "It lets workers sleep less", "It makes the tasks run in a different order", "Overload turns into rejections the caller sees, instead of memory and latency growing without limit"],
    answer: 3,
    explain: "An unbounded queue accepts everything, so during a sustained overload it grows until the process runs out of memory and every task waits longer. A bound turns the overload into explicit back-pressure: rejected, blocked or caller-runs, so clients can retry or slow down.",
    move: mv("Back-pressure", "io", 36),
  },
  {
    id: "ds-sched-steps",
    kind: "order",
    prompt: "Design a user-space scheduler for green threads (cooperative tasks in one process). Put the design steps in order.",
    steps: ["Give each task its own stack and a saved register context (makecontext / swapcontext or hand-written assembly)", "Keep a run queue of ready tasks", "yield(): save the current context, pick the next ready task, switch to it", "Block and wake: parking a task on I/O or a lock removes it from the run queue until an event moves it back", "Add preemption: a timer signal forces a yield so a CPU-bound task cannot hog the thread"],
    explain: "Contexts and stacks are the mechanism, the run queue is the policy's data, yield ties them together, blocking makes it useful for I/O, and preemption is the last refinement. Without a timer, a task that never yields owns the CPU.",
    move: mv("Green Thread", "scheduler", 38),
  },
  {
    id: "ds-sched-preempt",
    prompt: `Tasks of 100, 5 and 5 time units are ready. Without preemption (run to completion) the third task first runs at t=${fcfs}. With a 10-unit round-robin quantum it first runs at t=${rr}. What does that show?`,
    options: ["Round-robin makes the total work shorter", "Preemption bounds how long a short task waits behind a long one", "Round-robin always lowers turnaround for every task", "Run to completion has better response time"],
    answer: 1,
    explain: "Total work is unchanged. Preemption bounds how long any ready task waits for its first turn (here 15 instead of 105 units), which is response time. The cost is more context switches and a longer finish for the 100-unit task.",
    move: mv("Quantum Check", "scheduler", 36),
  },
  {
    id: "ds-malloc-steps",
    kind: "order",
    prompt: "Design a simple malloc. Put the design steps in order.",
    steps: ["Get memory from the OS: grow the heap with brk/sbrk (or mmap for large requests)", "Give each block a header with its size and a free flag", "malloc(n): walk the free list for a hole that fits (first or best fit) and split it if it is much larger", "If nothing fits, ask the OS for more and add it to the list", "free(p): mark the block free and coalesce it with free neighbours"],
    explain: "Source of memory, then the block metadata, then allocation with splitting, then the grow path, then free with coalescing. Splitting and coalescing are a pair: one carves holes, the other merges them back.",
    move: mv("Heap Builder", "memory", 38),
  },
  {
    id: "ds-malloc-coalesce",
    prompt: "Your malloc never merges adjacent free blocks. A program allocates three adjacent 100-byte blocks, frees them all, then asks for 300 bytes in a 300-byte heap. What happens?",
    options: ["It succeeds: the three holes are one 300-byte hole", "It crashes in free()", "It fails: three separate 100-byte holes remain, which is external fragmentation", "It succeeds but is slower"],
    answer: 2,
    explain: "Without coalescing the free list keeps three 100-byte holes and none fits a 300-byte request, even though 300 bytes are free. Merging adjacent free blocks on free() restores one 300-byte hole.",
    move: mv("Fragment Check", "memory", 36),
  },
  {
    id: "ds-shell-steps",
    kind: "order",
    prompt: "Implement `ls | wc` in a shell. Put the system-call steps in order.",
    steps: ["pipe(fds): create the pipe (read end fds[0], write end fds[1])", "fork() the first child: dup2(fds[1], 1), close both pipe fds, exec ls", "fork() the second child: dup2(fds[0], 0), close both pipe fds, exec wc", "In the parent: close both pipe fds", "In the parent: wait() for both children"],
    explain: "The pipe must exist before the forks so both children inherit it. Each child wires its end to stdin or stdout with dup2, then closes the originals. The parent closes its copies before waiting, otherwise a write end stays open and wc never sees end-of-file.",
    move: mv("Pipe Fitter", "process", 38),
  },
  {
    id: "ds-shell-eof",
    prompt: "In your shell, `wc` never finishes after `ls` has exited. What is the most likely bug?",
    options: ["ls wrote too much for the pipe", "The pipe's write end is still open somewhere, for example the parent never closed it", "wc was started before ls", "dup2 copies the data instead of the descriptor"],
    answer: 1,
    explain: "A reader gets end-of-file only when every write end is closed. After fork, the parent and both children each hold a copy, so if any copy stays open (typically the parent's), wc blocks in read() forever. Close the unused ends in every process.",
    move: mv("Hang Hunt", "process", 36),
  },
  {
    id: "ds-chat-steps",
    kind: "order",
    prompt: "Design a chat server for thousands of clients on one thread, using file descriptors. Put the design steps in order.",
    steps: ["Create a listening socket, set it non-blocking, and register it with epoll", "Loop on epoll_wait: for each ready fd, handle only that fd", "On the listening fd: accept() until EAGAIN and register each new client as non-blocking", "On a client fd that is readable: read what is there, parse whole messages, queue them for the other clients' output buffers", "On a writable client: write from its output buffer and drop EPOLLOUT interest once it is empty"],
    explain: "Everything is non-blocking so one slow client cannot stall the loop. epoll tells you which descriptors are ready, so cost follows activity, not connection count. Output goes through a per-client buffer because a non-blocking write can be short.",
    move: mv("Chat Loop", "io", 38),
  },
  {
    id: "ds-chat-select",
    prompt: `The chat server is built on select() and grows to 5,000 clients. Which is the first hard limit it hits?`,
    options: ["select() cannot watch any descriptor numbered " + (SELECT_MAX_FD + 1) + " or higher (FD_SETSIZE)", "TCP allows at most 1,024 connections", "epoll is needed to read from sockets at all", "Non-blocking sockets do not work with select()"],
    answer: 0,
    explain: `select() uses a fixed-size bitmap, FD_SETSIZE, which is ${SELECT_MAX_FD + 1} on Linux, so descriptors above ${SELECT_MAX_FD} cannot be watched (and it rescans the whole set on every call). poll has no such cap but still scans every entry; epoll removes both limits. The process also needs a higher ulimit -n for 5,000 sockets.`,
    move: mv("Scale Limit", "io", 36),
  },
];
