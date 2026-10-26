/**
 * Linux container mechanics: PID namespaces and cgroup v2 limits.
 *
 * Facts follow namespaces(7), pid_namespaces(7) and the kernel's cgroup-v2
 * documentation:
 *   - the first process of a new PID namespace is PID 1 inside it, and every
 *     process also has a PID in each ancestor namespace (the host sees them all);
 *   - `cpu.max` is "quota period" in microseconds: a cgroup may run `quota` µs
 *     of CPU time (summed over all its CPUs) in every `period`, then is
 *     throttled until the next period; `cpu.weight` splits contended CPU in
 *     proportion;
 *   - `memory.max` is a hard limit: the kernel first reclaims page cache, and
 *     if the anonymous memory alone still exceeds the limit the cgroup's OOM
 *     killer picks the biggest process.
 */

export interface PidNs {
  id: number;
  parent: number | null;
}

export class PidNamespaces {
  readonly spaces: PidNs[] = [{ id: 0, parent: null }];
  private next: number[] = [1];

  /** unshare(CLONE_NEWPID) for children: a new namespace under `parent` */
  create(parent: number): number {
    if (!this.spaces[parent]) throw new Error(`no namespace ${parent}`);
    this.spaces.push({ id: this.spaces.length, parent });
    this.next.push(1);
    return this.spaces.length - 1;
  }

  /** a new process in `ns`: its PID in `ns` and in every ancestor, keyed by namespace id */
  fork(ns: number): Map<number, number> {
    if (!this.spaces[ns]) throw new Error(`no namespace ${ns}`);
    const pids = new Map<number, number>();
    for (let n: number | null = ns; n !== null; n = this.spaces[n].parent) pids.set(n, this.next[n]++);
    return pids;
  }
}

export interface CpuThrottle {
  /** CPUs' worth of time the limit allows, quota / period */
  cores: number;
  /** wall-clock µs of each period the threads run before the quota is gone */
  runUs: number;
  /** wall-clock µs of each period spent throttled */
  throttledUs: number;
}

/** `cpu.max = "quota period"` with `threads` busy threads on `cpus` CPUs. */
export function cpuMax(quotaUs: number, periodUs: number, threads: number, cpus: number): CpuThrottle {
  const running = Math.max(1, Math.min(threads, cpus));
  const runUs = Math.min(periodUs, quotaUs / running);
  return { cores: quotaUs / periodUs, runUs, throttledUs: periodUs - runUs };
}

/** CPU share (fraction of the contended CPU) for each `cpu.weight` among busy cgroups. */
export const cpuShares = (weights: readonly number[]): number[] => {
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / total);
};

export interface MemProc {
  name: string;
  anonMB: number;
}

export interface MemOutcome {
  /** page cache dropped to make room */
  reclaimedMB: number;
  /** processes the OOM killer shot, in order */
  killed: string[];
  survivors: MemProc[];
}

/** A cgroup with `memory.max = maxMB`, its processes' anonymous memory and its page cache. */
export function memoryMax(maxMB: number, procs: readonly MemProc[], cacheMB: number): MemOutcome {
  const live = procs.map((p) => ({ ...p }));
  const anon = () => live.reduce((a, p) => a + p.anonMB, 0);
  const reclaimedMB = Math.min(cacheMB, Math.max(0, anon() + cacheMB - maxMB));
  const killed: string[] = [];
  while (anon() > maxMB && live.length > 0) {
    let big = 0;
    live.forEach((p, i) => {
      if (p.anonMB > live[big].anonMB) big = i;
    });
    killed.push(live[big].name);
    live.splice(big, 1);
  }
  return { reclaimedMB, killed, survivors: live };
}

/**
 * overlayfs, as used for container images (Documentation/filesystems/overlayfs.rst):
 * read-only lower layers (an image's layers, top first) under one writable
 * upper layer. A lookup takes the topmost layer that has the name; a
 * whiteout in a higher layer hides the name in every layer below it. The
 * first write to a lower-layer file copies the whole file up to the upper
 * layer (copy-up), however small the change; deleting a lower-layer file
 * leaves a whiteout in the upper layer, it never changes the lower layer.
 */
export const WHITEOUT = Symbol("whiteout");
export interface OverlayFile {
  data: string;
  sizeMB: number;
}
export type Layer = Map<string, OverlayFile | typeof WHITEOUT>;

export class Overlay {
  readonly upper: Layer = new Map();
  /** MB copied up so far */
  copiedUpMB = 0;
  /** `lower` lists the image layers, topmost first */
  constructor(readonly lower: readonly Layer[]) {}

  /** the file a process sees at `path`, or undefined */
  read(path: string): OverlayFile | undefined {
    for (const layer of [this.upper, ...this.lower]) {
      const e = layer.get(path);
      if (e === WHITEOUT) return undefined;
      if (e) return e;
    }
    return undefined;
  }

  private inLower(path: string): OverlayFile | undefined {
    for (const layer of this.lower) {
      const e = layer.get(path);
      if (e === WHITEOUT) return undefined;
      if (e) return e;
    }
    return undefined;
  }

  /** change a file's contents; a lower-layer file is copied up in full first. `sizeMB` is the new size. */
  write(path: string, data: string, sizeMB?: number): void {
    const up = this.upper.get(path);
    if (up && up !== WHITEOUT) {
      this.upper.set(path, { data, sizeMB: sizeMB ?? up.sizeMB });
      return;
    }
    const low = up === WHITEOUT ? undefined : this.inLower(path);
    if (low) this.copiedUpMB += low.sizeMB;
    this.upper.set(path, { data, sizeMB: sizeMB ?? low?.sizeMB ?? 0 });
  }

  /** rm: a file that exists below gets a whiteout; one only in the upper layer is just removed */
  remove(path: string): void {
    if (this.inLower(path)) this.upper.set(path, WHITEOUT);
    else this.upper.delete(path);
  }

  /** disk the container's writable layer uses: files and whiteouts (a whiteout is a 0-byte character device) */
  get upperMB(): number {
    let mb = 0;
    for (const e of this.upper.values()) if (e !== WHITEOUT) mb += e.sizeMB;
    return mb;
  }
}
