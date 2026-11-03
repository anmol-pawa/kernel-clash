/**
 * Small models of three modern-Linux ideas (as of October 2026): the EEVDF
 * pick rule, io_uring syscall batching and ring sizing, and PSI stall shares.
 * Simplified on purpose: they keep the rule an interviewer asks about, not
 * every kernel detail. Tests check them by hand-worked examples.
 */
export const NICE_0_WEIGHT = 1024;

export interface EevdfTask {
  name: string;
  weight: number;
  vruntime: number;
  /** requested slice in ms (a task can suggest it via sched_attr.sched_runtime) */
  sliceMs: number;
}

/** Weighted average virtual time V = sum(w*v) / sum(w). */
export function avgVruntime(tasks: readonly EevdfTask[]): number {
  const w = tasks.reduce((a, t) => a + t.weight, 0);
  return tasks.reduce((a, t) => a + t.weight * t.vruntime, 0) / w;
}

/** Lag = V - v: positive means the task is owed service. */
export const lag = (tasks: readonly EevdfTask[], t: EevdfTask) => avgVruntime(tasks) - t.vruntime;

/** Eligible when it is not ahead of the fair share, i.e. lag >= 0. */
export const eligible = (tasks: readonly EevdfTask[], t: EevdfTask) => lag(tasks, t) >= 0;

/** Virtual deadline = vruntime + slice scaled by weight (heavier tasks burn virtual time slower). */
export const virtualDeadline = (t: EevdfTask) => t.vruntime + (t.sliceMs * NICE_0_WEIGHT) / t.weight;

/** EEVDF pick: among eligible tasks, the earliest virtual deadline. */
export function eevdfPick(tasks: readonly EevdfTask[]): EevdfTask {
  const ok = tasks.filter((t) => eligible(tasks, t));
  return ok.reduce((best, t) => (virtualDeadline(t) < virtualDeadline(best) ? t : best));
}

export type SubmitMode = "syscall-per-op" | "io_uring" | "sqpoll";

/** Submission syscalls for `ops` operations; io_uring_enter submits up to `batch` at once. */
export function submitSyscalls(ops: number, mode: SubmitMode, batch = 1): number {
  if (mode === "syscall-per-op") return ops;
  if (mode === "io_uring") return Math.ceil(ops / batch);
  return 0; // SQPOLL: the kernel thread polls the ring (wake-ups after idle ignored)
}

const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));
/** io_uring_setup rounds the SQ up to a power of two; the CQ defaults to twice that. */
export const ringSizes = (entries: number) => ({ sq: pow2(entries), cq: 2 * pow2(entries) });

export interface PsiTick {
  /** tasks that are not idle (running, runnable or stalled) */
  nonidle: number;
  /** of those, tasks stalled waiting on the resource */
  stalled: number;
}

/** PSI shares in percent: `some` = at least one stalled; `full` = every non-idle task stalled. */
export function psi(ticks: readonly PsiTick[]): { some: number; full: number } {
  const some = ticks.filter((t) => t.stalled >= 1).length;
  const full = ticks.filter((t) => t.nonidle > 0 && t.stalled === t.nonidle).length;
  return { some: (100 * some) / ticks.length, full: (100 * full) / ticks.length };
}
