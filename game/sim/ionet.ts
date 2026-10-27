/**
 * I/O models and server architectures.
 *
 * Facts follow Stevens, UNIX Network Programming vol. 1, ch. 6 (blocking,
 * non-blocking, I/O multiplexing, signal-driven and asynchronous I/O; only the
 * last never blocks in the data copy phase) and the Linux man pages: select(2)
 * is limited to FD_SETSIZE (1024) descriptors and the kernel and caller both scan
 * every descriptor up to nfds on each call; poll(2) has no fixed limit but still
 * scans the whole array; epoll(7) keeps an interest list in the kernel and
 * epoll_wait returns only the ready descriptors.
 */

export const FD_SETSIZE = 1024;

export type IoModel = "blocking" | "nonblocking" | "multiplexing" | "signal" | "async";

export interface IoModelFacts {
  /** The first phase, waiting for data to be ready, blocks the caller. */
  waitBlocks: boolean;
  /** The second phase, copying data from the kernel to the user buffer, blocks the caller. */
  copyBlocks: boolean;
  /** POSIX counts it as asynchronous I/O (the whole operation is done by the kernel). */
  posixAsync: boolean;
}

export const IO_MODELS: Record<IoModel, IoModelFacts> = {
  blocking: { waitBlocks: true, copyBlocks: true, posixAsync: false },
  // read returns EAGAIN until data is ready; the caller polls, then blocks in the copy.
  nonblocking: { waitBlocks: false, copyBlocks: true, posixAsync: false },
  // select/poll/epoll block in the wait, then read blocks in the copy.
  multiplexing: { waitBlocks: true, copyBlocks: true, posixAsync: false },
  // SIGIO says "ready", then read blocks in the copy.
  signal: { waitBlocks: false, copyBlocks: true, posixAsync: false },
  async: { waitBlocks: false, copyBlocks: false, posixAsync: true },
};

export type PollCall = "select" | "poll" | "epoll";

export interface PollCost {
  /** Descriptors the kernel examines for readiness on this call. */
  examined: number;
  /** Entries the caller must walk afterwards to find the ready ones. */
  callerScan: number;
  /** False when the call cannot watch these descriptors at all. */
  ok: boolean;
}

/**
 * The cost of one wait call over `watched` descriptors of which `ready` are ready.
 * `maxFd` is the highest descriptor number (select scans 0..maxFd).
 */
export function waitCost(call: PollCall, watched: number, ready: number, maxFd = watched - 1): PollCost {
  if (call === "select") {
    const n = maxFd + 1;
    return { examined: n, callerScan: n, ok: maxFd < FD_SETSIZE };
  }
  if (call === "poll") return { examined: watched, callerScan: watched, ok: true };
  // epoll_wait: the ready list is maintained by wakeup callbacks, not by scanning.
  return { examined: ready, callerScan: ready, ok: true };
}

export interface ServerLoad {
  /** CPU time per request, ms. */
  cpuMs: number;
  /** Time a request waits on I/O (disk, database, network), ms. */
  waitMs: number;
}

/**
 * Requests per second on one core. A worker that blocks for the I/O wait does
 * 1000/(cpu+wait) per second; the core caps the sum at 1000/cpu.
 */
export function threadedThroughput(load: ServerLoad, workers: number, cores = 1): number {
  const perWorker = 1000 / (load.cpuMs + load.waitMs);
  return Math.min(workers * perWorker, (cores * 1000) / load.cpuMs);
}

/** An event loop never blocks on the I/O wait, so one thread is limited by CPU alone. */
export function eventLoopThroughput(load: ServerLoad): number {
  return 1000 / load.cpuMs;
}

/** Smallest worker count whose throughput reaches the CPU limit. */
export function workersToSaturate(load: ServerLoad, cores = 1): number {
  return Math.ceil((cores * (load.cpuMs + load.waitMs)) / load.cpuMs);
}

/** Memory used by thread-per-connection stacks, in bytes (committed stack per thread). */
export const threadStackBytes = (connections: number, stackBytes: number) => connections * stackBytes;

export type SendMethod = "readwrite" | "mmapwrite" | "sendfile" | "sendfileSG";

export interface SendCost {
  /** Data copies in total (DMA and CPU). */
  copies: number;
  /** Copies done by the CPU (memcpy), which burn cycles and pollute caches. */
  cpuCopies: number;
  /** User/kernel mode switches (two per system call). */
  modeSwitches: number;
}

/**
 * Sending a file from disk to a socket (Linux zero-copy; Love, and the sendfile(2) and
 * "Zero Copy I" write-up). read+write: disk DMA to the page cache, CPU copy to the user
 * buffer, CPU copy to the socket buffer, NIC DMA. mmap+write maps the page cache, so the
 * first CPU copy disappears but there are still two system calls. sendfile makes one
 * call and the CPU copies page cache to socket buffer. With NIC scatter-gather DMA the
 * socket buffer only receives descriptors, so no CPU copy is left.
 */
export const SEND_COSTS: Record<SendMethod, SendCost> = {
  readwrite: { copies: 4, cpuCopies: 2, modeSwitches: 4 },
  mmapwrite: { copies: 3, cpuCopies: 1, modeSwitches: 4 },
  sendfile: { copies: 3, cpuCopies: 1, modeSwitches: 2 },
  sendfileSG: { copies: 2, cpuCopies: 0, modeSwitches: 2 },
};
