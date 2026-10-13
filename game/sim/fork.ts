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
