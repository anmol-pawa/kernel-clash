/**
 * Atomics and memory models: the CAS-based lock-free stack with the ABA
 * problem, and store-buffer litmus tests under sequential consistency, x86-TSO
 * and a relaxed (ARM-like) model.
 *
 * Facts follow Michael & Scott / Treiber (lock-free stack and ABA, fixed by a
 * version tag next to the pointer), Sewell et al., "x86-TSO" (2010: each core
 * has a FIFO store buffer, so a later load can pass an earlier store to a
 * different address) and the C11/C++11 acquire-release rules (a release store
 * publishes every write before it to a thread whose acquire load reads it).
 */

export interface StackNode {
  name: string;
  next: string | null;
}

export interface AbaResult {
  /** did thread 1's stale compare-and-swap succeed */
  casSucceeded: boolean;
  head: string | null;
  /** names reachable from head afterwards */
  stack: string[];
  /** the head is a node that was popped and freed */
  corrupt: boolean;
}

/**
 * Treiber stack A -> B -> C. Thread 1 starts pop: reads head = A and A.next = B,
 * then stalls. Thread 2 pops A, pops B (freeing it), then pushes A back, so the
 * stack is A -> C. Thread 1 resumes with CAS(head, A, B). Without a version tag
 * the head is A again and the CAS succeeds, making the freed B the head.
 */
export function abaScenario(tagged: boolean): AbaResult {
  const nodes = new Map<string, StackNode>([
    ["A", { name: "A", next: "B" }],
    ["B", { name: "B", next: "C" }],
    ["C", { name: "C", next: null }],
  ]);
  const freed = new Set<string>();
  let head: string | null = "A";
  let tag = 0;
  // thread 1 reads, then is preempted
  const seenHead = head;
  const seenTag = tag;
  const seenNext = nodes.get(seenHead!)!.next;
  // thread 2: pop A, pop B, push A
  const popTop = () => {
    const h = head!;
    head = nodes.get(h)!.next;
    tag++;
    return h;
  };
  popTop();
  freed.add(popTop());
  nodes.get("A")!.next = head;
  head = "A";
  tag++;
  // thread 1: CAS(head, seenHead, seenNext) compares the tag too when tagged
  const casSucceeded = head === seenHead && (!tagged || tag === seenTag);
  if (casSucceeded) head = seenNext;
  const stack: string[] = [];
  for (let n = head; n !== null && stack.length < 10; n = nodes.get(n)?.next ?? null) stack.push(n);
  return { casSucceeded, head, stack, corrupt: head !== null && freed.has(head) };
}

export type Op =
  | { op: "store"; v: string; val: number }
  /** store that first drains this thread's earlier stores (a C11 release store) */
  | { op: "release"; v: string; val: number }
  | { op: "load"; v: string; reg: string }
  | { op: "fence" };
export type Model = "sc" | "tso" | "relaxed";

interface State {
  pc: number[];
  mem: Record<string, number>;
  buf: { v: string; val: number }[][];
  regs: Record<string, number>;
}

/** Every final register assignment, as sorted "r1=0 r2=1" strings, over all schedules of the model. */
export function outcomes(threads: readonly (readonly Op[])[], model: Model, vars: readonly string[]): string[] {
  const init: State = { pc: threads.map(() => 0), mem: Object.fromEntries(vars.map((v) => [v, 0])), buf: threads.map(() => []), regs: {} };
  const seen = new Set<string>();
  const finals = new Set<string>();
  const clone = (s: State): State => ({ pc: [...s.pc], mem: { ...s.mem }, buf: s.buf.map((b) => b.map((e) => ({ ...e }))), regs: { ...s.regs } });
  const visit = (s: State) => {
    const key = JSON.stringify(s);
    if (seen.has(key)) return;
    seen.add(key);
    const done = s.pc.every((p, t) => p === threads[t].length);
    if (done) {
      // buffers drain eventually; registers are already fixed
      finals.add(
        Object.keys(s.regs)
          .sort()
          .map((r) => `${r}=${s.regs[r]}`)
          .join(" "),
      );
    }
    for (let t = 0; t < threads.length; t++) {
      // flush a buffered store to memory: the oldest, or any whose variable has no older buffered store (relaxed)
      const b = s.buf[t];
      const flushable = model === "relaxed" ? b.map((e, i) => i).filter((i) => b.slice(0, i).every((o) => o.v !== b[i].v)) : b.length ? [0] : [];
      for (const i of flushable) {
        const n = clone(s);
        const [e] = n.buf[t].splice(i, 1);
        n.mem[e.v] = e.val;
        visit(n);
      }
      const op = threads[t][s.pc[t]];
      if (!op) continue;
      const n = clone(s);
      n.pc[t]++;
      if (op.op === "store" || op.op === "release") {
        if (op.op === "release" && n.buf[t].length) continue; // must drain first
        if (model === "sc") n.mem[op.v] = op.val;
        else n.buf[t].push({ v: op.v, val: op.val });
      } else if (op.op === "load") {
        const mine = [...n.buf[t]].reverse().find((e) => e.v === op.v);
        n.regs[op.reg] = mine ? mine.val : n.mem[op.v];
      } else if (n.buf[t].length) continue; // a fence waits for the buffer to drain
      visit(n);
    }
  };
  visit(init);
  return [...finals].sort();
}

/** Store buffering: both threads store then load the other's variable. */
export const STORE_BUFFERING: readonly (readonly Op[])[] = [
  [
    { op: "store", v: "x", val: 1 },
    { op: "load", v: "y", reg: "r1" },
  ],
  [
    { op: "store", v: "y", val: 1 },
    { op: "load", v: "x", reg: "r2" },
  ],
];
/** The same with a full fence between each store and load. */
export const STORE_BUFFERING_FENCED: readonly (readonly Op[])[] = STORE_BUFFERING.map((t) => [t[0], { op: "fence" } as Op, t[1]]);

/** Message passing: write data then raise a flag; the reader checks the flag then reads data. */
export const MESSAGE_PASSING: readonly (readonly Op[])[] = [
  [
    { op: "store", v: "data", val: 1 },
    { op: "store", v: "flag", val: 1 },
  ],
  [
    { op: "load", v: "flag", reg: "r1" },
    { op: "load", v: "data", reg: "r2" },
  ],
];
/** The flag store is a release store. */
export const MESSAGE_PASSING_RELEASE: readonly (readonly Op[])[] = [[MESSAGE_PASSING[0][0], { op: "release", v: "flag", val: 1 }], MESSAGE_PASSING[1]];
