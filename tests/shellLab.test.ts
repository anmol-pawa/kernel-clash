import { describe, expect, it } from "vitest";
import {
  SHELL_CHALLENGES, checkShellChallenge, fileToPipe, gradeShellProblem, makeShellProblem, outcomeOf, pipeline, redirect, runShell, shellSource,
} from "@/game/sim/shellLab";

describe("pipelines", () => {
  it("echo | wc counts one line", () => {
    const r = runShell(pipeline("kernel"));
    expect(r.tty).toEqual(["1"]);
    expect(r.hung).toBe(false);
    expect(r.zombiesAtExit).toBe(0);
  });
  it("a write end the shell keeps open hangs the reader", () => {
    const r = runShell(pipeline("kernel", { closeParent: false }));
    expect(r.hung).toBe(true);
    expect(outcomeOf(r)).toBe("hangs forever");
  });
  it("without dup2 the programs talk to the terminal, not the pipe", () => {
    expect(runShell(pipeline("kernel", { dup: false })).tty).toEqual(["kernel", "0"]);
  });
  it("cat < file | wc counts the file's lines", () => {
    expect(runShell(fileToPipe()).tty).toEqual(["3"]);
    expect(runShell(fileToPipe({ dup: false })).tty).toEqual(["0"]);
  });
});

describe("processes", () => {
  it("fork copies the fd table and exec keeps the pid and fds", () => {
    const r = runShell(pipeline("x"));
    const forkStep = r.steps.find((s) => s.what.startsWith("fork()"))!;
    const child = forkStep.procs.find((p) => p.ppid === 1)!;
    expect(child.fds.map(([n]) => n)).toEqual([0, 1, 2, 3, 4]);
    const exec = r.steps.find((s) => s.what.startsWith("exec("))!;
    expect(exec.procs.some((p) => p.pid === exec.pid && p.name.startsWith("echo"))).toBe(true);
  });
  it("an exited child stays a zombie until wait reaps it", () => {
    const r = runShell([{ op: "fork", child: [{ op: "exec", prog: "echo", arg: "a" }] }, { op: "wait" }]);
    expect(r.steps.some((s) => s.procs.some((p) => p.state === "zombie"))).toBe(true);
    expect(r.steps.at(-1)!.procs.some((p) => p.state === "zombie")).toBe(false);
    expect(r.zombiesAtExit).toBe(0);
    expect(runShell([{ op: "fork", child: [{ op: "exec", prog: "echo", arg: "a" }] }]).zombiesAtExit).toBe(1);
  });
  it("redirection sends the output to the file", () => {
    const r = runShell(redirect("ping"));
    expect(r.files["out.txt"]).toBe("ping\n");
    expect(r.tty).toEqual(["done"]);
    expect(runShell(redirect("ping", { dup: false })).tty).toEqual(["ping", "done"]);
  });
  it("writing to a pipe with no reader kills the writer", () => {
    const r = runShell([{ op: "pipe" }, { op: "close", fd: 3 }, { op: "write", fd: 4, text: "x" }]);
    expect(r.steps.at(-1)!.what).toMatch(/SIGPIPE/);
  });
  it("lists source", () => {
    expect(shellSource(pipeline("a"))).toContain("dup2(4, 1);");
  });
});

describe("generated problems", () => {
  it("are deterministic with the answer among distinct options", () => {
    for (let s = 1; s <= 30; s++) {
      const p = makeShellProblem(s);
      expect(makeShellProblem(s)).toEqual(p);
      expect(new Set(p.options).size).toBe(p.options.length);
      expect(p.options).toContain(p.answer);
      expect(p.options.length).toBeGreaterThanOrEqual(3);
      expect(gradeShellProblem(p, p.answer)).toBe(true);
      expect(outcomeOf(runShell(p.ops))).toBe(p.answer);
    }
  });
});

describe("challenges", () => {
  it("each is cleared by exactly its intended fix and not by the buggy program", () => {
    for (const c of SHELL_CHALLENGES) {
      expect(c.check(runShell(c.buggy))).toBe(false);
      c.fixes.forEach((_, i) => expect(checkShellChallenge(c, i)).toBe(i === c.intended));
    }
  });
});
