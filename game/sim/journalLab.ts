/**
 * Journaling crash simulator. One operation, "append one block to a file", touches
 * three on-disk blocks: the new DATA block, the INODE (size + pointer to the data)
 * and the allocation BITMAP (marks the block used). A crash can land between any two
 * writes. After the crash, recovery replays a journal transaction only if its commit
 * record reached the disk; otherwise the transaction is thrown away.
 *
 * Modes (textbook models, as in ext3/ext4 `data=` options and the OSTEP chapter):
 *  - none:      no journal; writes go straight to their home locations
 *  - writeback: metadata is journaled; data may reach the disk at any time (worst case: last)
 *  - ordered:   metadata is journaled; data is forced to disk BEFORE the metadata commit
 *  - data:      data and metadata are both journaled, then checkpointed
 *
 * Assumptions: each listed step is one durable write (barriers between steps),
 * a commit record is atomic (real systems checksum it), and replay is idempotent.
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

export type Blk = "data" | "inode" | "bitmap";
export const BLOCKS: readonly Blk[] = ["data", "inode", "bitmap"];

export type StepKind = "home" | "journal" | "commit";
export interface JStep {
  kind: StepKind;
  /** blocks written by this step (to the journal for "journal", to their home place for "home") */
  blocks: Blk[];
  label: string;
}

const home = (b: Blk, label: string): JStep => ({ kind: "home", blocks: [b], label });

/** The ordered write sequence for one append under a mode. */
export function writeSequence(mode: JMode): JStep[] {
  switch (mode) {
    case "none":
      return [home("data", "write DATA"), home("bitmap", "write BITMAP"), home("inode", "write INODE")];
    case "writeback":
      return [
        { kind: "journal", blocks: ["inode", "bitmap"], label: "journal INODE + BITMAP" },
        { kind: "commit", blocks: [], label: "journal COMMIT" },
        home("inode", "checkpoint INODE"),
        home("bitmap", "checkpoint BITMAP"),
        home("data", "write DATA (unordered: may land any time, here last)"),
      ];
    case "ordered":
      return [
        home("data", "write DATA first"),
        { kind: "journal", blocks: ["inode", "bitmap"], label: "journal INODE + BITMAP" },
        { kind: "commit", blocks: [], label: "journal COMMIT" },
        home("inode", "checkpoint INODE"),
        home("bitmap", "checkpoint BITMAP"),
      ];
    case "data":
      return [
        { kind: "journal", blocks: ["data", "inode", "bitmap"], label: "journal DATA + INODE + BITMAP" },
        { kind: "commit", blocks: [], label: "journal COMMIT" },
        home("data", "checkpoint DATA"),
        home("inode", "checkpoint INODE"),
        home("bitmap", "checkpoint BITMAP"),
      ];
  }
}

export type Fresh = Record<Blk, boolean>;
const none = (): Fresh => ({ data: false, inode: false, bitmap: false });

export interface CrashResult {
  mode: JMode;
  /** number of steps that completed before the crash (0..steps.length) */
  crashAfter: number;
  /** home blocks holding new content at the moment of the crash */
  onDisk: Fresh;
  /** blocks written into the journal (and not yet replayed) */
  journaled: Fresh;
  committed: boolean;
  /** true when recovery replayed a committed transaction */
  replayed: boolean;
  /** home blocks after recovery */
  after: Fresh;
  outcome: Outcome;
}

/** What the user sees after recovery. */
export type Outcome =
  | "old" // append never happened; file system consistent
  | "new" // append fully happened
  | "garbage" // inode points at a data block that was never written (stale contents exposed)
  | "corrupt" // inode references a block the bitmap says is free (can be handed out twice)
  | "leak"; // bitmap says used but nothing references it (space leaked; fsck can reclaim)

export const OUTCOME_LABEL: Record<Outcome, string> = {
  old: "Old state (append lost, consistent)",
  new: "New state (append complete)",
  garbage: "Inode points to unwritten data (garbage)",
  corrupt: "Inode uses a block the bitmap calls free",
  leak: "Leaked block (bitmap used, no owner)",
};

/** Classify the home state of the three blocks. Data alone (orphan data) is invisible, so it counts as old. */
export function classify(f: Fresh): Outcome {
  if (f.inode) {
    if (!f.bitmap) return "corrupt";
    return f.data ? "new" : "garbage";
  }
  return f.bitmap ? "leak" : "old";
}

/** Crash after `crashAfter` completed steps, then recover. */
export function crash(mode: JMode, crashAfter: number): CrashResult {
  const steps = writeSequence(mode);
  const k = Math.max(0, Math.min(steps.length, Math.trunc(crashAfter)));
  const onDisk = none();
  const journaled = none();
  let committed = false;
  for (const s of steps.slice(0, k)) {
    if (s.kind === "home") for (const b of s.blocks) onDisk[b] = true;
    else if (s.kind === "journal") for (const b of s.blocks) journaled[b] = true;
    else committed = true;
  }
  const after = { ...onDisk };
  const replayed = committed;
  if (replayed) for (const b of BLOCKS) if (journaled[b]) after[b] = true;
  return { mode, crashAfter: k, onDisk, journaled, committed, replayed, after, outcome: classify(after) };
}

/** Every crash point 0..n for a mode. */
export function allCrashes(mode: JMode): CrashResult[] {
  return Array.from({ length: writeSequence(mode).length + 1 }, (_, k) => crash(mode, k));
}

/** The set of outcomes any crash can produce under a mode. */
export function outcomesOf(mode: JMode): Outcome[] {
  return [...new Set(allCrashes(mode).map((r) => r.outcome))];
}

/** A mode is safe if no crash point leaves garbage, corruption or a leak. */
export function isSafe(mode: JMode): boolean {
  return outcomesOf(mode).every((o) => o === "old" || o === "new");
}

// ---- predict-the-state problems ----

export interface JProblem {
  mode: JMode;
  crashAfter: number;
  answer: Outcome;
  options: Outcome[];
}

const ALL_OUTCOMES: readonly Outcome[] = ["old", "new", "garbage", "corrupt", "leak"];

export function makeJProblem(seed: number): JProblem {
  const r = rng(seed * 7919 + 13);
  const mode = JMODES[seed % JMODES.length]!;
  const n = writeSequence(mode).length;
  const crashAfter = r.int(0, n);
  const answer = crash(mode, crashAfter).outcome;
  return { mode, crashAfter, answer, options: ALL_OUTCOMES.slice() };
}

export function gradeJProblem(p: JProblem, picked: Outcome): boolean {
  return crash(p.mode, p.crashAfter).outcome === picked;
}

// ---- challenges ----

export interface JChallenge {
  id: string;
  title: string;
  goal: string;
  /** passes if the picked mode satisfies the goal */
  check: (mode: JMode) => boolean;
}

export const J_CHALLENGES: readonly JChallenge[] = [
  { id: "j1", title: "Never garbage", goal: "Pick a mode where no crash point can leave an inode pointing at unwritten data.", check: (m) => !outcomesOf(m).includes("garbage") && !outcomesOf(m).includes("corrupt") },
  { id: "j2", title: "Fully safe, cheapest", goal: "Pick the mode that is crash-safe for both metadata and data and writes the data only once.", check: (m) => m === "ordered" },
  { id: "j3", title: "Data journaled", goal: "Pick a safe mode where the data block itself is in the journal.", check: (m) => m === "data" },
  { id: "j4", title: "Metadata only, still unsafe", goal: "Pick a mode that journals metadata but can still expose garbage after a crash.", check: (m) => m === "writeback" },
  { id: "j5", title: "Leaks and corruption", goal: "Pick a mode that can leak a block or double-book one.", check: (m) => m === "none" },
];

export function checkJChallenge(c: JChallenge, mode: JMode): boolean {
  return c.check(mode);
}
