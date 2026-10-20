/**
 * A tiny fork() simulator. A program is a straight line of `fork()` and
 * `printf()` statements; every process runs it from where it was created, and
 * after a fork both parent and child continue with the next statement.
 */
export type Stmt = "fork" | "print";

export interface ForkRun {
  /** processes that exist at the end, counting the original */
  processes: number;
  /** lines printed in total by all processes */
  prints: number;
}

export function runForks(program: readonly Stmt[]): ForkRun {
  let processes = 1;
  let prints = 0;
  // a work list of processes, each with the statement it runs next
  const pcs = [0];
  while (pcs.length) {
    let pc = pcs.pop()!;
    for (; pc < program.length; pc++) {
      if (program[pc] === "print") prints++;
      else {
        processes++;
        pcs.push(pc + 1); // the child resumes after the fork
      }
    }
  }
  return { processes, prints };
}

/** C source for a program, one statement per line. */
export const forkSource = (program: readonly Stmt[]) => program.map((s) => (s === "fork" ? "fork();" : 'printf("hi\\n");')).join("\n");

/**
 * Programs with branches on fork()'s return value. fork() returns 0 in the
 * child and the child's PID (> 0) in the parent, so `if (fork() == 0) {…}`
 * runs the block only in the new child and `if (fork() > 0) {…}` only in the
 * parent. A `loop` runs its body `n` times (like `for (i = 0; i < n; i++)`).
 */
export type Node =
  | { op: "fork" }
  | { op: "print" }
  | { op: "ifChild"; body: Node[] }
  | { op: "ifParent"; body: Node[] }
  | { op: "loop"; n: number; body: Node[] };

interface Frame {
  list: readonly Node[];
  pc: number;
}

export function runForkTree(program: readonly Node[]): ForkRun {
  let processes = 1;
  let prints = 0;
  // every process is a stack of frames (the blocks it is inside)
  const procs: Frame[][] = [[{ list: program, pc: 0 }]];
  while (procs.length) {
    const stack = procs.pop()!;
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.pc >= top.list.length) {
        stack.pop();
        continue;
      }
      const s = top.list[top.pc++];
      if (s.op === "print") prints++;
      else if (s.op === "loop") stack.push({ list: Array.from({ length: s.n }, () => s.body).flat(), pc: 0 });
      else {
        processes++;
        const child = stack.map((f) => ({ ...f }));
        if (s.op === "ifChild") child.push({ list: s.body, pc: 0 });
        if (s.op === "ifParent") stack.push({ list: s.body, pc: 0 });
        procs.push(child);
      }
    }
  }
  return { processes, prints };
}

/** C source for a program with branches and loops (two-space indents). */
export function forkTreeSource(program: readonly Node[], depth = 0): string {
  const pad = "  ".repeat(depth);
  const block = (head: string, body: readonly Node[]) => `${pad}${head} {\n${forkTreeSource(body, depth + 1)}\n${pad}}`;
  return program
    .map((s) => {
      switch (s.op) {
        case "fork":
          return `${pad}fork();`;
        case "print":
          return `${pad}printf("hi\\n");`;
        case "ifChild":
          return block("if (fork() == 0)", s.body);
        case "ifParent":
          return block("if (fork() > 0)", s.body);
        case "loop":
          return block(`for (int i = 0; i < ${s.n}; i++)`, s.body);
      }
    })
    .join("\n");
}
