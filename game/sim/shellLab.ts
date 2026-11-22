/**
 * Shell and process lab engine. A tiny deterministic model of the Unix
 * process API: fork, pipe, dup2, close, open, exec, wait, with a process table
 * and per-process file-descriptor tables. Pipes use real reference counting,
 * so an unclosed write end makes the reader wait forever (the classic hang).
 *
 * Conventions (a model, not a kernel): after fork the child runs first and
 * keeps the CPU until it blocks or exits; descriptors are inherited by exec
 * (no close-on-exec); the terminal is fd 0, 1 and 2 of the first process.
 */
import { rng } from "@/lib/rng";

export type Prog = "echo" | "cat" | "wc";

export type Op =
  | { op: "pipe" }
  | { op: "dup2"; from: number; to: number }
  | { op: "close"; fd: number }
  | { op: "open"; path: string; mode: "r" | "w" }
  | { op: "write"; fd: number; text: string }
  | { op: "fork"; child: Op[] }
  | { op: "exec"; prog: Prog; arg?: string }
  | { op: "wait" };

type Obj = { kind: "tty" } | { kind: "file"; name: string } | { kind: "pipe"; id: number; end: "r" | "w" };

export interface ProcView {
  pid: number;
  ppid: number;
  state: "running" | "blocked" | "zombie";
  name: string;
  fds: [number, string][];
}

export interface Step {
  pid: number;
  what: string;
  procs: ProcView[];
  tty: string[];
}

export interface RunResult {
  steps: Step[];
  tty: string[];
  files: Record<string, string>;
  /** processes that were zombies at the moment the first process ended */
  zombiesAtExit: number;
  hung: boolean;
}

const label = (o: Obj) => (o.kind === "tty" ? "tty" : o.kind === "file" ? `file:${o.name}` : `pipe${o.id}:${o.end}`);
const same = (a: Obj, b: Obj) => label(a) === label(b);

interface Proc {
  pid: number;
  ppid: number;
  ops: Op[];
  pc: number;
  fds: Map<number, Obj>;
  state: "run" | "zombie" | "gone";
  name: string;
  image: { prog: Prog; arg?: string } | null;
}

export const INPUT_FILES: Record<string, string> = { "in.txt": "alpha\nbeta\ngamma\n" };

/** Run a program as pid 1 ("sh"). */
export function runShell(program: readonly Op[], maxSteps = 300): RunResult {
  const procs: Proc[] = [];
  const pipes = new Map<number, string>();
  const files: Record<string, string> = { ...INPUT_FILES };
  const tty: string[] = [];
  const steps: Step[] = [];
  let nextPid = 1;
  let nextPipe = 0;
  let zombiesAtExit = -1;
  const tt: Obj = { kind: "tty" };
  const mk = (ppid: number, ops: Op[], fds: Map<number, Obj>, name: string): Proc => {
    const p: Proc = { pid: nextPid++, ppid, ops, pc: 0, fds, state: "run", name, image: null };
    procs.push(p);
    return p;
  };
  mk(0, [...program], new Map([[0, tt], [1, tt], [2, tt]]), "sh");

  const live = () => procs.filter((p) => p.state !== "gone");
  const refs = (id: number, end: "r" | "w") => procs.filter((p) => p.state === "run").reduce((n, p) => n + [...p.fds.values()].filter((o) => o.kind === "pipe" && o.id === id && o.end === end).length, 0);
  const lowest = (p: Proc) => { let i = 0; while (p.fds.has(i)) i++; return i; };
  const children = (p: Proc) => procs.filter((c) => c.ppid === p.pid && c.state !== "gone");
  const blockedWhy = (p: Proc): boolean => {
    if (p.image) {
      if (p.image.prog === "echo") return false;
      const in0 = p.fds.get(0);
      return !!in0 && in0.kind === "pipe" && refs(in0.id, "w") > 0;
    }
    const s = p.ops[p.pc];
    if (s?.op === "wait") return children(p).some((c) => c.state === "run") && !children(p).some((c) => c.state === "zombie");
    return false;
  };
  const view = (): ProcView[] =>
    live().map((p) => ({
      pid: p.pid, ppid: p.ppid, name: p.name,
      state: p.state === "zombie" ? "zombie" : blockedWhy(p) ? "blocked" : "running",
      fds: p.state === "zombie" ? [] : [...p.fds.entries()].sort((a, b) => a[0] - b[0]).map(([n, o]) => [n, label(o)] as [number, string]),
    }));
  const snap = (p: Proc, what: string) => steps.push({ pid: p.pid, what, procs: view(), tty: [...tty] });
  const emit = (p: Proc, fd: number, text: string): string => {
    const o = p.fds.get(fd);
    if (!o || (o.kind === "pipe" && o.end === "r")) return "EBADF";
    if (o.kind === "tty") tty.push(...text.split("\n").filter((l, i, a) => l !== "" || i < a.length - 1));
    else if (o.kind === "file") files[o.name] = (files[o.name] ?? "") + text;
    else {
      if (refs(o.id, "r") === 0) return "SIGPIPE";
      pipes.set(o.id, (pipes.get(o.id) ?? "") + text);
    }
    return "";
  };
  const finish = (p: Proc, why: string) => {
    if (p.pid === 1 && zombiesAtExit < 0) zombiesAtExit = children(p).filter((c) => c.state === "zombie").length;
    p.fds.clear();
    const parent = procs.find((x) => x.pid === p.ppid);
    p.state = !parent || parent.state !== "run" ? "gone" : "zombie";
    snap(p, why);
  };

  let cur = procs[0]!;
  for (let n = 0; n < maxSteps; n++) {
    const run = procs.filter((p) => p.state === "run" && !blockedWhy(p));
    if (!run.length) break;
    const p = run.includes(cur) ? cur : run[0]!;
    cur = p;
    if (p.image) {
      const { prog, arg } = p.image;
      const in0 = p.fds.get(0);
      const input = in0?.kind === "pipe" ? (pipes.get(in0.id) ?? "") : in0?.kind === "file" ? (files[in0.name] ?? "") : "";
      const out = prog === "echo" ? `${arg ?? ""}\n` : prog === "cat" ? input : `${input.split("\n").length - 1}\n`;
      const err = emit(p, 1, out);
      finish(p, err === "SIGPIPE" ? `${prog} killed by SIGPIPE (no reader)` : `${prog} wrote ${JSON.stringify(out)} and exited`);
      continue;
    }
    const s = p.ops[p.pc];
    if (!s) {
      finish(p, "exit()");
      continue;
    }
    p.pc++;
    if (s.op === "pipe") {
      const id = nextPipe++;
      pipes.set(id, "");
      const r = lowest(p);
      p.fds.set(r, { kind: "pipe", id, end: "r" });
      const w = lowest(p);
      p.fds.set(w, { kind: "pipe", id, end: "w" });
      snap(p, `pipe() -> read fd ${r}, write fd ${w}`);
    } else if (s.op === "dup2") {
      const o = p.fds.get(s.from);
      if (o) p.fds.set(s.to, o);
      snap(p, `dup2(${s.from}, ${s.to}): fd ${s.to} now points where fd ${s.from} does`);
    } else if (s.op === "close") {
      p.fds.delete(s.fd);
      snap(p, `close(${s.fd})`);
    } else if (s.op === "open") {
      if (s.mode === "w") files[s.path] = "";
      const fd = lowest(p);
      p.fds.set(fd, { kind: "file", name: s.path });
      snap(p, `open("${s.path}", ${s.mode === "w" ? "O_WRONLY|O_TRUNC" : "O_RDONLY"}) -> fd ${fd}`);
    } else if (s.op === "write") {
      const err = emit(p, s.fd, s.text);
      if (err === "SIGPIPE") finish(p, `write(${s.fd}) -> SIGPIPE, process dies`);
      else snap(p, err ? `write(${s.fd}) fails: ${err}` : `write(${s.fd}, ${JSON.stringify(s.text)})`);
    } else if (s.op === "fork") {
      const c = mk(p.pid, s.child, new Map(p.fds), p.name);
      cur = c;
      snap(p, `fork() -> child ${c.pid} (fd table copied)`);
    } else if (s.op === "exec") {
      p.image = { prog: s.prog, arg: s.arg };
      p.name = s.prog === "echo" ? `echo ${s.arg ?? ""}`.trim() : s.prog;
      snap(p, `exec(${p.name}): same pid, same fds, new program`);
    } else {
      const z = children(p).find((c) => c.state === "zombie");
      if (z) {
        z.state = "gone";
        snap(p, `wait() reaps zombie ${z.pid}`);
      } else snap(p, "wait(): no children");
    }
  }
  const hung = procs.some((p) => p.state === "run");
  if (zombiesAtExit < 0) zombiesAtExit = 0;
  return { steps, tty, files, zombiesAtExit, hung };
}

/** The outcome as one comparable string. */
export function outcomeOf(r: RunResult): string {
  if (r.hung) return "hangs forever";
  return r.tty.length ? r.tty.join(" / ") : "prints nothing";
}

// ---- programs -------------------------------------------------------------

/** `echo T | cat | wc -l`-style pipeline: producer, optional middle `cat`, consumer. */
export function pipeline(text: string, opts: { closeParent?: boolean; dup?: boolean; consumer?: Prog; waits?: boolean } = {}): Op[] {
  const { closeParent = true, dup = true, consumer = "wc", waits = true } = opts;
  const ops: Op[] = [{ op: "pipe" }];
  ops.push({ op: "fork", child: [...(dup ? [{ op: "dup2", from: 4, to: 1 } as Op] : []), { op: "close", fd: 3 }, { op: "close", fd: 4 }, { op: "exec", prog: "echo", arg: text }] });
  ops.push({ op: "fork", child: [...(dup ? [{ op: "dup2", from: 3, to: 0 } as Op] : []), { op: "close", fd: 3 }, { op: "close", fd: 4 }, { op: "exec", prog: consumer }] });
  if (closeParent) ops.push({ op: "close", fd: 3 }, { op: "close", fd: 4 });
  if (waits) ops.push({ op: "wait" }, { op: "wait" });
  return ops;
}

/** `echo T > out.txt` as the child, then the shell prints a line itself. */
export function redirect(text: string, opts: { dup?: boolean } = {}): Op[] {
  const { dup = true } = opts;
  return [
    { op: "fork", child: [{ op: "open", path: "out.txt", mode: "w" }, ...(dup ? [{ op: "dup2", from: 3, to: 1 } as Op, { op: "close", fd: 3 } as Op] : []), { op: "exec", prog: "echo", arg: text }] },
    { op: "wait" },
    { op: "write", fd: 1, text: "done\n" },
  ];
}

/** `cat < in.txt | wc -l` where the shell does the plumbing. */
export function fileToPipe(opts: { dup?: boolean } = {}): Op[] {
  const { dup = true } = opts;
  return [
    { op: "pipe" },
    { op: "fork", child: [{ op: "open", path: "in.txt", mode: "r" }, ...(dup ? [{ op: "dup2", from: 5, to: 0 } as Op] : []), { op: "dup2", from: 4, to: 1 }, { op: "close", fd: 3 }, { op: "close", fd: 4 }, { op: "exec", prog: "cat" }] },
    { op: "fork", child: [{ op: "dup2", from: 3, to: 0 }, { op: "close", fd: 3 }, { op: "close", fd: 4 }, { op: "exec", prog: "wc" }] },
    { op: "close", fd: 3 }, { op: "close", fd: 4 },
    { op: "wait" }, { op: "wait" },
  ];
}

/** Source listing in C-like pseudo-code (indented). */
export function shellSource(ops: readonly Op[], depth = 0): string {
  const pad = "  ".repeat(depth);
  return ops
    .map((s) => {
      switch (s.op) {
        case "pipe": return `${pad}pipe(fds);`;
        case "dup2": return `${pad}dup2(${s.from}, ${s.to});`;
        case "close": return `${pad}close(${s.fd});`;
        case "open": return `${pad}open("${s.path}", ${s.mode === "w" ? "O_WRONLY|O_TRUNC" : "O_RDONLY"});`;
        case "write": return `${pad}write(${s.fd}, ${JSON.stringify(s.text)});`;
        case "wait": return `${pad}wait(NULL);`;
        case "exec": return `${pad}exec("${s.prog}"${s.arg ? `, "${s.arg}"` : ""});`;
        case "fork": return `${pad}if (fork() == 0) {\n${shellSource(s.child, depth + 1)}\n${pad}}`;
      }
    })
    .join("\n");
}

// ---- seeded "what happens" problems ---------------------------------------

export interface ShellProblem {
  id: string;
  ops: Op[];
  answer: string;
  options: string[];
  /** the idea the learner should have used */
  why: string;
}

const WORDS = ["ping", "pong", "kernel", "inode", "mutex", "fault"];

export function makeShellProblem(seed: number): ShellProblem {
  const r = rng(seed * 7919 + 13);
  const w = r.pick(WORDS);
  const kind = seed % 3;
  let base: Op[];
  let mutants: Op[][];
  let why: string;
  if (kind === 0) {
    base = pipeline(w);
    mutants = [pipeline(w, { closeParent: false }), pipeline(w, { dup: false }), pipeline(w, { consumer: "cat" })];
    why = "A reader sees end-of-file only when every copy of the write end is closed, including the shell's. dup2 is what connects a program's stdin and stdout to the pipe.";
  } else if (kind === 1) {
    base = redirect(w);
    mutants = [redirect(w, { dup: false })];
    why = "Redirection is dup2 before exec: the child's fd 1 points at the file, so its output never reaches the terminal. Without dup2 the program still writes to fd 1, the terminal.";
  } else {
    base = fileToPipe();
    mutants = [fileToPipe({ dup: false })];
    why = "cat reads fd 0, so the shell must make fd 0 the file with dup2. Without that cat reads the terminal (nothing here) and wc counts zero lines.";
  }
  const answer = outcomeOf(runShell(base));
  const opts = [answer];
  for (const m of mutants) {
    const o = outcomeOf(runShell(m));
    if (!opts.includes(o)) opts.push(o);
  }
  for (const extra of ["hangs forever", "prints nothing", `${w}`, "1", "3", "0", `${w} / done`]) {
    if (opts.length >= 4) break;
    if (!opts.includes(extra)) opts.push(extra);
  }
  return { id: `shell-${seed}`, ops: base, answer, options: r.shuffle(opts), why };
}

export const gradeShellProblem = (p: ShellProblem, choice: string) => choice === p.answer;

// ---- fix-the-bug challenges ------------------------------------------------

export interface ShellChallenge {
  id: string;
  title: string;
  goal: string;
  buggy: Op[];
  fixes: { label: string; program: Op[] }[];
  check: (r: RunResult) => boolean;
  /** index of the intended fix */
  intended: number;
}

export const SHELL_CHALLENGES: ShellChallenge[] = [
  {
    id: "sh-hang",
    title: "The hung pipeline",
    goal: "`echo kernel | wc` never finishes. Pick the fix so it prints 1.",
    buggy: pipeline("kernel", { closeParent: false }),
    fixes: [
      { label: "Add a third wait()", program: [...pipeline("kernel", { closeParent: false }), { op: "wait" }] },
      { label: "Close the pipe's two ends in the shell after forking", program: pipeline("kernel") },
      { label: "Swap the order of the two forks", program: (() => { const b = pipeline("kernel", { closeParent: false }); return [b[0]!, b[2]!, b[1]!, ...b.slice(3)]; })() },
    ],
    check: (r) => !r.hung && r.tty.join("/") === "1",
    intended: 1,
  },
  {
    id: "sh-redirect",
    title: "Output goes to the wrong place",
    goal: "`echo ping > out.txt` should leave the file holding ping and the terminal showing only done.",
    buggy: redirect("ping", { dup: false }),
    fixes: [
      { label: "dup2(3, 1) then close(3) in the child before exec", program: redirect("ping") },
      { label: "Close fd 1 in the shell", program: [{ op: "close", fd: 1 }, ...redirect("ping", { dup: false })] },
      { label: "wait() twice", program: [...redirect("ping", { dup: false }), { op: "wait" }] },
    ],
    check: (r) => r.files["out.txt"] === "ping\n" && r.tty.join("/") === "done",
    intended: 0,
  },
  {
    id: "sh-zombie",
    title: "Zombie factory",
    goal: "The shell forks one child that exits at once and never waits. Make the shell end with no zombies.",
    buggy: [{ op: "fork", child: [{ op: "exec", prog: "echo", arg: "bye" }] }],
    fixes: [
      { label: "Call wait() in the shell", program: [{ op: "fork", child: [{ op: "exec", prog: "echo", arg: "bye" }] }, { op: "wait" }] },
      { label: "Call close(1) in the child", program: [{ op: "fork", child: [{ op: "close", fd: 1 }, { op: "exec", prog: "echo", arg: "bye" }] }] },
      { label: "Fork a second child", program: [{ op: "fork", child: [{ op: "exec", prog: "echo", arg: "bye" }] }, { op: "fork", child: [{ op: "exec", prog: "echo", arg: "bye" }] }] },
    ],
    check: (r) => r.zombiesAtExit === 0 && !r.hung,
    intended: 0,
  },
  {
    id: "sh-stdin",
    title: "cat reads the wrong thing",
    goal: "`cat < in.txt | wc` should print 3 (the file has 3 lines). Pick the fix.",
    buggy: fileToPipe({ dup: false }),
    fixes: [
      { label: "In the first child, dup2(5, 0) so fd 0 is the file", program: fileToPipe() },
      { label: "In the shell, dup2(3, 0)", program: [{ op: "dup2", from: 3, to: 0 }, ...fileToPipe({ dup: false })] },
      { label: "Remove the wc child", program: fileToPipe({ dup: false }).filter((_, i) => i !== 2) },
    ],
    check: (r) => !r.hung && r.tty.join("/") === "3",
    intended: 0,
  },
];

export const checkShellChallenge = (c: ShellChallenge, fix: number) => {
  const f = c.fixes[fix];
  return !!f && c.check(runShell(f.program));
};
