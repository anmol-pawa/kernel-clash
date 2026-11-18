/**
 * Journaling crash simulator. One file-system operation (append a block to a
 * file) touches three blocks: the new data block D, the inode I (size and
 * pointer) and the allocation bitmap B. We list the block writes each journaling
 * mode issues, in order, let the user crash after any of them, run crash
 * recovery, and classify what the disk looks like afterwards.
 *
 * Model assumptions (stated in the UI): every block write is atomic, each step
 * is flushed (write barrier) before the next starts, the whole operation fits
 * in one transaction, and recovery replays a transaction only if its commit
 * block reached the journal and the transaction was not yet retired.
 */
import { rng } from "@/lib/rng";

export type JMode = "none" | "writeback" | "ordered" | "data";
export const JMODES: readonly JMode[] = ["none", "writeback", "ordered", "data"];
export const JMODE_LABEL: Record<JMode, string> = {
  none: "No journal",
  writeback: "Writeback",
  ordered: "Ordered",
  data: "Data journaling",
};

/** D = file data block, I = inode, B = block bitmap. */
export type Blk = "D" | "I" | "B";
export const BLK_NAME: Record<Blk, string> = { D: "data block", I: "inode", B: "bitmap" };

export type StepKind = "begin" | "journal" | "commit" | "home" | "retire";
export interface JStep {
  kind: StepKind;
  /** which block, for journal and home writes */
  blk?: Blk;
  label: string;
}

const j = (blk: Blk): JStep => ({ kind: "journal", blk, label: `journal: copy of ${BLK_NAME[blk]}` });
const h = (blk: Blk): JStep => ({ kind: "home", blk, label: `home location: ${BLK_NAME[blk]}` });
const BEGIN: JStep = { kind: "begin", label: "journal: transaction begin" };
const COMMIT: JStep = { kind: "commit", label: "journal: commit block" };
const RETIRE: JStep = { kind: "retire", label: "journal: retire transaction (checkpoint done)" };

/** The ordered list of block writes each mode issues. */
export function journalSteps(mode: JMode): JStep[] {
  switch (mode) {
    case "none":
      // no ordering discipline: the kernel writes the inode and bitmap first, the data last
      return [h("I"), h("B"), h("D")];
    case "writeback":
      // metadata is journaled; the data write is not ordered against the commit (worst case shown: after it)
      return [BEGIN, j("I"), j("B"), COMMIT, h("I"), h("B"), h("D"), RETIRE];
    case "ordered":
      // data goes to its home location first, then the metadata transaction
      return [h("D"), BEGIN, j("I"), j("B"), COMMIT, h("I"), h("B"), RETIRE];
    case "data":
      // everything goes through the journal
      return [BEGIN, j("D"), j("I"), j("B"), COMMIT, h("D"), h("I"), h("B"), RETIRE];
  }
}

export interface DiskState {
  /** true = the block holds its new contents at its home location */
  home: Record<Blk, boolean>;
  journal: { begun: boolean; blocks: Blk[]; committed: boolean; retired: boolean };
}

export const emptyState = (): DiskState => ({
  home: { D: false, I: false, B: false },
  journal: { begun: false, blocks: [], committed: false, retired: false },
});

/** The disk right after the first `done` steps completed (done in 0..steps.length). */
export function applySteps(mode: JMode, done: number): DiskState {
  const s = emptyState();
  journalSteps(mode).slice(0, done).forEach((st) => {
    if (st.kind === "begin") s.journal.begun = true;
    else if (st.kind === "journal" && st.blk) s.journal.blocks.push(st.blk);
    else if (st.kind === "commit") s.journal.committed = true;
    else if (st.kind === "home" && st.blk) s.home[st.blk] = true;
    else if (st.kind === "retire") s.journal.retired = true;
  });
  return s;
}

/** Crash recovery: replay a committed, unretired transaction (idempotent); discard anything else. */
export function recover(mode: JMode, s: DiskState): { state: DiskState; replayed: Blk[]; discarded: boolean } {
  const home = { ...s.home };
  const j = s.journal;
  if (mode === "none") return { state: { home, journal: j }, replayed: [], discarded: false };
  if (j.begun && j.committed && !j.retired) {
    j.blocks.forEach((b) => (home[b] = true));
    return { state: { home, journal: { ...j, retired: true } }, replayed: [...j.blocks], discarded: false };
  }
  return { state: { home, journal: j }, replayed: [], discarded: j.begun && !j.committed };
}

export type Outcome = "old" | "complete" | "stale-data" | "inconsistent" | "leak";
export const OUTCOMES: readonly Outcome[] = ["old", "complete", "stale-data", "inconsistent", "leak"];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  old: "Old state, consistent (append lost)",
  complete: "New state, complete",
  "stale-data": "Consistent, but file shows stale garbage",
  inconsistent: "Inconsistent: inode points at a free block",
  leak: "Leak: block marked used, no owner",
};
export const OUTCOME_WHY: Record<Outcome, string> = {
  old: "Neither the inode nor the bitmap changed, so the file is exactly as before. Any data already written sits in a block nobody references.",
  complete: "The inode, bitmap and data all hold their new contents: the append survived.",
  "stale-data": "The inode and bitmap are new, but the data block still holds whatever was there before, so the file's new tail is stale or another user's old data.",
  inconsistent: "The inode points to a block the bitmap still calls free. The allocator may hand it to another file, so the disk needs a full fsck.",
  leak: "The bitmap says the block is used but no inode owns it. Harmless to read, but space is lost until fsck reclaims it.",
};

/** Classify a disk by what the three blocks hold. */
export function classify(home: Record<Blk, boolean>): Outcome {
  if (home.I && home.B) return home.D ? "complete" : "stale-data";
  if (home.I && !home.B) return "inconsistent";
  if (!home.I && home.B) return "leak";
  return "old";
}

export interface CrashResult {
  mode: JMode;
  crashAfter: number;
  before: DiskState;
  replayed: Blk[];
  discarded: boolean;
  after: DiskState;
  outcome: Outcome;
}

/** Crash after `crashAfter` completed steps, run recovery, classify. */
export function crashAt(mode: JMode, crashAfter: number): CrashResult {
  const n = journalSteps(mode).length;
  const k = Math.max(0, Math.min(n, Math.trunc(crashAfter)));
  const before = applySteps(mode, k);
  const { state, replayed, discarded } = recover(mode, structuredClone(before));
  return { mode, crashAfter: k, before, replayed, discarded, after: state, outcome: classify(state.home) };
}

/** Every crash point 0..n for a mode, for the summary strip. */
export function crashMatrix(mode: JMode): CrashResult[] {
  return journalSteps(mode).map((_, i) => crashAt(mode, i)).concat(crashAt(mode, journalSteps(mode).length));
}

export interface JournalProblem {
  seed: number;
  mode: JMode;
  crashAfter: number;
  answer: Outcome;
}

/** Seeded "crash after step k: what state results?" problems. Seeds cycle the modes. */
export function makeJournalProblem(seed: number): JournalProblem {
  const r = rng(seed * 6007 + 5);
  const mode = JMODES[seed % JMODES.length];
  const n = journalSteps(mode).length;
  const crashAfter = r.int(0, n);
  return { seed, mode, crashAfter, answer: crashAt(mode, crashAfter).outcome };
}

export function gradeJournalProblem(p: JournalProblem, answer: Outcome): boolean {
  return crashAt(p.mode, p.crashAfter).outcome === answer;
}
