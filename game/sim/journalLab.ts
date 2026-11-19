/**
 * Journaling crash simulator. One file append touches three things on disk:
 *   D = the new data block, I = the inode (new size and pointer), B = the free-space bitmap.
 * A crash can hit between any two writes. We model each mode as an ordered list of
 * write steps (each step is durable before the next starts), crash after k steps,
 * run recovery, and classify what the file looks like.
 *
 * Modes (Linux ext3/ext4 names):
 *  - "none":      no journal; updates go straight to their home blocks in the order I, B, D (fsck is the only repair).
 *  - "writeback": metadata journaling, no ordering of data against the journal. Model: data is written after the commit (the worst legal order).
 *  - "ordered":   metadata journaling, but the data block is written first, before the journal transaction.
 *  - "data":      data and metadata both go through the journal, then are checkpointed.
 *
 * Recovery: a transaction with a commit block that has not been freed is replayed
 * (idempotent); a transaction without a commit block is discarded.
 */
import { rng } from "@/lib/rng";

export type JournalMode = "none" | "writeback" | "ordered" | "data";
export const JOURNAL_MODES: readonly JournalMode[] = ["none", "writeback", "ordered", "data"];
export const MODE_LABEL: Record<JournalMode, string> = {
  none: "No journal",
  writeback: "Writeback",
  ordered: "Ordered",
  data: "Data journaling",
};

/** What the file looks like once the dust has settled. */
export type Outcome = "old" | "new" | "garbage" | "leak" | "inconsistent";
export const OUTCOMES: readonly Outcome[] = ["old", "new", "garbage", "leak", "inconsistent"];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  old: "Old file, update lost (consistent)",
  new: "New file, update complete (consistent)",
  garbage: "Inode points at a block holding stale data",
  leak: "Block marked used but no file owns it",
  inconsistent: "Inode points at a block marked free",
};
/** Is the outcome a legal state for the file system (all-or-nothing, nothing stale exposed)? */
export const isSafe = (o: Outcome): boolean => o === "old" || o === "new";

export interface DiskState {
  /** the data block holds the new data */
  data: boolean;
  /** the inode points at the new block */
  inode: boolean;
  /** the bitmap marks the new block used */
  bitmap: boolean;
  /** journal contents */
  jBegin: boolean;
  jInode: boolean;
  jBitmap: boolean;
  jData: boolean;
  jCommit: boolean;
  /** journal space released after checkpoint */
  jFreed: boolean;
}

export const EMPTY_DISK: DiskState = {
  data: false, inode: false, bitmap: false,
  jBegin: false, jInode: false, jBitmap: false, jData: false, jCommit: false, jFreed: false,
};

export interface WriteStep {
  label: string;
  /** number of disk blocks this step writes */
  blocks: number;
  apply: (s: DiskState) => DiskState;
}

const step = (label: string, blocks: number, patch: Partial<DiskState>): WriteStep => ({ label, blocks, apply: (s) => ({ ...s, ...patch }) });

/** The ordered writes of one file append under each mode. */
export function writeSteps(mode: JournalMode): WriteStep[] {
  switch (mode) {
    case "none":
      return [step("write I (inode)", 1, { inode: true }), step("write B (bitmap)", 1, { bitmap: true }), step("write D (data)", 1, { data: true })];
    case "writeback":
      return [
        step("journal: TxBegin + I + B", 3, { jBegin: true, jInode: true, jBitmap: true }),
        step("journal: commit block", 1, { jCommit: true }),
        step("write D (data) to its home", 1, { data: true }),
        step("checkpoint I", 1, { inode: true }),
        step("checkpoint B", 1, { bitmap: true }),
        step("free the journal entry", 1, { jFreed: true }),
      ];
    case "ordered":
      return [
        step("write D (data) to its home", 1, { data: true }),
        step("journal: TxBegin + I + B", 3, { jBegin: true, jInode: true, jBitmap: true }),
        step("journal: commit block", 1, { jCommit: true }),
        step("checkpoint I", 1, { inode: true }),
        step("checkpoint B", 1, { bitmap: true }),
        step("free the journal entry", 1, { jFreed: true }),
      ];
    case "data":
      return [
        step("journal: TxBegin + D + I + B", 4, { jBegin: true, jData: true, jInode: true, jBitmap: true }),
        step("journal: commit block", 1, { jCommit: true }),
        step("checkpoint D", 1, { data: true }),
        step("checkpoint I", 1, { inode: true }),
        step("checkpoint B", 1, { bitmap: true }),
        step("free the journal entry", 1, { jFreed: true }),
      ];
  }
}

/** Total blocks written for one clean append, a write-amplification figure. */
export const totalBlockWrites = (mode: JournalMode): number => writeSteps(mode).reduce((a, s) => a + s.blocks, 0);

/** Disk contents if the machine dies right after `done` steps (0 = before any write). */
export function stateAfter(mode: JournalMode, done: number): DiskState {
  const steps = writeSteps(mode);
  const k = Math.max(0, Math.min(done, steps.length));
  return steps.slice(0, k).reduce((s, st) => st.apply(s), EMPTY_DISK);
}

export interface Recovery {
  action: "none" | "replay" | "discard" | "fsck-needed";
  state: DiskState;
}

/** Mount-time recovery: replay a committed, unfreed transaction; drop an uncommitted one. */
export function recover(mode: JournalMode, crashed: DiskState): Recovery {
  if (mode === "none") return { action: "fsck-needed", state: crashed };
  if (crashed.jBegin && !crashed.jFreed) {
    if (crashed.jCommit) {
      return {
        action: "replay",
        state: {
          ...crashed,
          inode: crashed.inode || crashed.jInode,
          bitmap: crashed.bitmap || crashed.jBitmap,
          data: crashed.data || crashed.jData,
          jFreed: true,
        },
      };
    }
    return { action: "discard", state: { ...crashed, jBegin: false, jInode: false, jBitmap: false, jData: false } };
  }
  return { action: "none", state: crashed };
}

/** Classify the file after recovery. */
export function classify(s: DiskState): Outcome {
  if (s.inode && !s.bitmap) return "inconsistent";
  if (s.inode && !s.data) return "garbage";
  if (!s.inode && s.bitmap) return "leak";
  if (s.inode && s.bitmap && s.data) return "new";
  return "old";
}

export interface CrashRow {
  /** steps completed before the crash */
  done: number;
  /** label of the last completed write, or "nothing written yet" */
  last: string;
  crashed: DiskState;
  recovery: Recovery;
  outcome: Outcome;
}

/** One row per crash point, 0..steps.length. */
export function crashTable(mode: JournalMode): CrashRow[] {
  const steps = writeSteps(mode);
  return Array.from({ length: steps.length + 1 }, (_, done) => {
    const crashed = stateAfter(mode, done);
    const recovery = recover(mode, crashed);
    return { done, last: done === 0 ? "nothing written yet" : steps[done - 1].label, crashed, recovery, outcome: classify(recovery.state) };
  });
}

/** Does every possible crash point end in a safe (old or new) state after recovery? */
export const alwaysSafe = (mode: JournalMode): boolean => crashTable(mode).every((r) => isSafe(r.outcome));

export interface JournalProblem {
  seed: number;
  mode: JournalMode;
  done: number;
  answer: Outcome;
}

/** Seeded "crash here, what do you find after recovery?" problem. */
export function makeJournalProblem(seed: number): JournalProblem {
  const r = rng(seed * 7919 + 13);
  const mode = r.pick(JOURNAL_MODES);
  const done = r.int(0, writeSteps(mode).length);
  return { seed, mode, done, answer: crashTable(mode)[done].outcome };
}

/** Outcomes that some crash point of some mode can actually produce (the answer choices). */
export const REACHABLE_OUTCOMES: readonly Outcome[] = OUTCOMES.filter((o) => JOURNAL_MODES.some((m) => crashTable(m).some((r) => r.outcome === o)));

export const gradeJournalProblem = (p: JournalProblem, pick: Outcome): boolean => pick === p.answer;
