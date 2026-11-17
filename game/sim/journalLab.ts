/**
 * Journaling crash simulator. One file append touches three things: the new
 * data block D, the inode I (size and block pointer) and the allocation bitmap B.
 * A journaling file system writes some of them to a log first, then commits,
 * then copies ("checkpoints") them to their home locations.
 *
 * Modes (ext3/ext4 names):
 *  - "data":      D, I and B all go through the journal (D is written twice).
 *  - "ordered":   only I and B are journaled, but D reaches its home location BEFORE the commit.
 *  - "writeback": only I and B are journaled and D is flushed whenever the cache gets to it
 *                 (modelled here as: last, after the metadata is checkpointed).
 *
 * Model: every step is one atomic block write; the commit record is a single
 * atomic write issued only after all journal content blocks completed (so a torn
 * commit cannot happen); a crash happens between two steps; on reboot recovery
 * replays every committed, not-yet-freed transaction and discards the rest.
 */
import { rng } from "@/lib/rng";

export type JournalMode = "data" | "ordered" | "writeback";
export const JOURNAL_MODES: readonly JournalMode[] = ["data", "ordered", "writeback"];
export const MODE_LABEL: Record<JournalMode, string> = { data: "Data journaling", ordered: "Ordered", writeback: "Writeback" };

export type Block = "D" | "I" | "B";
export const BLOCK_NAME: Record<Block, string> = { D: "data block", I: "inode", B: "bitmap" };

export type StepKind = "journal-begin" | "journal-block" | "commit" | "home" | "journal-free";

export interface JournalStep {
  kind: StepKind;
  /** which block this step writes (absent for begin, commit and free) */
  block?: Block;
  label: string;
}

const step = (kind: StepKind, block?: Block): JournalStep => {
  const name = block ? BLOCK_NAME[block] : "";
  const label =
    kind === "journal-begin" ? "write the transaction-begin record to the journal"
    : kind === "journal-block" ? `write the ${name} copy to the journal`
    : kind === "commit" ? "write the commit record to the journal"
    : kind === "home" ? `write the ${name} to its home location`
    : "mark the journal entry free";
  return { kind, block, label };
};

/** The ordered list of block writes for one append, per mode. */
export function writeSequence(mode: JournalMode): JournalStep[] {
  const begin = step("journal-begin");
  const commit = step("commit");
  const free = step("journal-free");
  if (mode === "data") {
    return [begin, step("journal-block", "D"), step("journal-block", "I"), step("journal-block", "B"), commit, step("home", "D"), step("home", "I"), step("home", "B"), free];
  }
  if (mode === "ordered") {
    return [step("home", "D"), begin, step("journal-block", "I"), step("journal-block", "B"), commit, step("home", "I"), step("home", "B"), free];
  }
  return [begin, step("journal-block", "I"), step("journal-block", "B"), commit, step("home", "I"), step("home", "B"), free, step("home", "D")];
}

export type Version = "old" | "new";
export type Outcome = "old" | "new" | "stale-data";
export const OUTCOME_LABEL: Record<Outcome, string> = {
  old: "File unchanged (the append never happened)",
  new: "Append fully applied and consistent",
  "stale-data": "Inode and bitmap say the append happened, but the data block holds old garbage",
};

export interface CrashResult {
  /** crash happens after this many steps completed (0 = before the first write) */
  after: number;
  /** home-location contents right after the crash, before recovery */
  beforeRecovery: Record<Block, Version>;
  /** the journal holds a committed transaction that was not yet freed */
  replays: boolean;
  /** home-location contents after recovery */
  afterRecovery: Record<Block, Version>;
  outcome: Outcome;
  /** D reached disk but nothing references it (harmless orphan, space reused later) */
  orphanData: boolean;
}

export function crashAfter(mode: JournalMode, after: number): CrashResult {
  const seq = writeSequence(mode);
  const n = Math.min(Math.max(0, Math.trunc(after)), seq.length);
  const home: Record<Block, Version> = { D: "old", I: "old", B: "old" };
  let committed = false;
  let freed = false;
  for (const s of seq.slice(0, n)) {
    if (s.kind === "home" && s.block) home[s.block] = "new";
    else if (s.kind === "commit") committed = true;
    else if (s.kind === "journal-free") freed = true;
  }
  const replays = committed && !freed;
  const rec = { ...home };
  if (replays) {
    // data mode journals all three blocks; the other modes journal only inode and bitmap
    const journaled: Block[] = mode === "data" ? ["D", "I", "B"] : ["I", "B"];
    for (const b of journaled) rec[b] = "new";
  }
  let outcome: Outcome;
  if (rec.I === "old" && rec.B === "old") outcome = "old";
  else if (rec.D === "new") outcome = "new";
  else outcome = "stale-data";
  return {
    after: n,
    beforeRecovery: home,
    replays,
    afterRecovery: rec,
    outcome,
    orphanData: outcome === "old" && rec.D === "new",
  };
}

/** Outcome at every crash point 0..steps, in order. */
export function crashTable(mode: JournalMode): CrashResult[] {
  return Array.from({ length: writeSequence(mode).length + 1 }, (_, i) => crashAfter(mode, i));
}

/** Total block writes for one append (journal records included). */
export function writeCount(mode: JournalMode): number {
  return writeSequence(mode).length;
}

export interface JournalProblem {
  mode: JournalMode;
  after: number;
  answer: Outcome;
}

/** Seeded "predict the state after recovery" problem. */
export function makeJournalProblem(seed: number): JournalProblem {
  const r = rng(seed * 7919 + 13);
  // cycle the modes so all three show up, then pick a crash point
  const mode = JOURNAL_MODES[(seed + r.int(0, 2)) % 3];
  const after = r.int(0, writeSequence(mode).length);
  return { mode, after, answer: crashAfter(mode, after).outcome };
}

export function gradeJournalProblem(p: JournalProblem, pick: Outcome): boolean {
  return pick === crashAfter(p.mode, p.after).outcome;
}
