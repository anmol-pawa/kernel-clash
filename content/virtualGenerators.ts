import type { Generator, McqQ, NumericQ } from "@/game/engine/question";
import { demandPagingEat, maxFaultRate, replacePages, thrashing, workingSet, type Replacement } from "@/game/sim/paging";
import { rng, type Rng } from "@/lib/rng";

const vm = (name: string, power: number) => ({ name, type: "memory" as const, power });
const POLICIES: Record<Replacement, string> = { fifo: "FIFO", lru: "LRU", opt: "Optimal", clock: "Clock (second chance)" };
const ALL: Replacement[] = ["fifo", "lru", "opt", "clock"];

/** A reference string over pages 0–6 with some repeats (so hits and faults both happen). */
function refString(r: Rng, length: number): number[] {
  const refs: number[] = [];
  while (refs.length < length) refs.push(refs.length > 3 && r.int(0, 2) === 0 ? refs[refs.length - 1 - r.int(1, 3)] : r.int(0, 6));
  return refs;
}

/** How many page faults does this policy take on this string? */
export const faultCountGen: Generator = {
  id: "gen-vm-faults",
  topic: "Page replacement: count the faults",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xfa17);
    const policy = r.pick(ALL);
    const frames = r.pick([3, 3, 4]);
    let refs: number[] = [];
    for (let tries = 0; tries < 200; tries++) {
      refs = refString(r, r.int(12, 16));
      // a good problem: the policies don't all agree, and it isn't all faults
      const counts = new Set(ALL.map((p) => replacePages(refs, frames, p).faults));
      if (counts.size >= 2 && counts.size <= 4 && !ALL.some((p) => replacePages(refs, frames, p).faults === refs.length)) break;
    }
    const res = replacePages(refs, frames, policy);
    const trace = res.steps.map((s) => `${s.page}${s.fault ? "F" : "·"}`).join(" ");
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `${frames} frames start empty. How many page faults does ${POLICIES[policy]} take on the reference string ${refs.join(" ")}?`,
      answer: res.faults,
      explain: `Trace under ${POLICIES[policy]} (F = fault, · = hit): ${trace}. That is ${res.faults} faults in ${refs.length} references. The first ${Math.min(frames, new Set(refs).size)} distinct pages always fault into empty frames.`,
      move: vm("Fault Line", 32),
    };
  },
};

/** Index of the first resident page used furthest ahead, if exactly one is (so Optimal's pick isn't a tie). */
const uniqueFurthest = (resident: readonly number[], future: readonly number[]): number | null => {
  const dist = resident.map((p) => (future.indexOf(p) < 0 ? Infinity : future.indexOf(p)));
  const max = Math.max(...dist);
  return dist.filter((d) => d === max).length === 1 ? dist.indexOf(max) : null;
};

/** Which resident page does a policy evict at one reference, when the policies disagree? */
export const victimChoice: Generator = {
  id: "gen-vm-victim",
  topic: "Page replacement: which page is the victim?",
  make(seed): McqQ {
    const r = rng(seed ^ 0x71c7);
    const frames = 4;
    const policies = ["fifo", "lru", "opt"] as Replacement[];
    for (let tries = 0; ; tries++) {
      const policy = r.pick(policies);
      const past = refString(r, r.int(8, 11));
      const future = policy === "opt" ? refString(r, r.int(4, 6)) : [];
      const refs = [...past, ...future];
      const at = past.length - 1;
      const steps = replacePages(refs, frames, policy).steps;
      const victim = steps[at].victim;
      if (victim === null || steps[at - 1].frames.includes(null)) continue;
      const resident = steps[at - 1].frames as number[];
      // Optimal needs one clear furthest page; the others should name a different victim than this policy
      if (policy === "opt" && uniqueFurthest(resident, future) === null) continue;
      const others = policies.filter((p) => p !== policy).map((p) => replacePages(refs, frames, p).steps[at].victim);
      if (tries < 400 && !others.some((v) => v !== victim)) continue;
      const options = [...resident].sort((a, b) => a - b);
      const why =
        policy === "fifo"
          ? "the page that has been resident longest"
          : policy === "lru"
            ? "the page whose last use is furthest in the past"
            : "the page whose next use is furthest in the future (or never)";
      return {
        id: `${this.id}#${seed}`,
        prompt: `${frames} frames hold pages ${options.join(", ")} after the references ${past.slice(0, -1).join(" ")}. Page ${past[at]} is referenced next${future.length ? `, and then ${future.join(" ")}` : ""}. Which page does ${POLICIES[policy]} evict?`,
        options: options.map((p) => `Page ${p}`),
        answer: options.indexOf(victim),
        explain: `${POLICIES[policy]} evicts ${why}: page ${victim}. Full reference string: ${past.join(" ")}${future.length ? ` | ${future.join(" ")}` : ""}.`,
        move: vm("Queue Evict", 32),
      };
    }
  },
};

/** Effective access time with a page-fault rate. */
export const faultEat: Generator = {
  id: "gen-vm-eat",
  topic: "Demand paging: effective access time",
  make(seed): NumericQ {
    const r = rng(seed ^ 0xe47);
    const memNs = r.pick([100, 200, 250]);
    const faultMs = r.pick([5, 8, 10]);
    const denom = r.pick([1000, 2000, 5000, 10000]);
    const p = 1 / denom;
    const eat = demandPagingEat(p, memNs, faultMs * 1e6);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A memory access takes ${memNs} ns and servicing a page fault takes ${faultMs} ms. One access in ${denom.toLocaleString("en-US")} faults. What is the effective access time?`,
      answer: Math.round(eat * 100) / 100,
      unit: "ns",
      explain: `EAT = (1 − p) × memory + p × fault time, with p = 1/${denom.toLocaleString("en-US")} and ${faultMs} ms = ${(faultMs * 1e6).toLocaleString("en-US")} ns. EAT = ${1 - p} × ${memNs} + ${p} × ${(faultMs * 1e6).toLocaleString("en-US")} = ${Math.round(eat * 100) / 100} ns. The fault term dominates, which is why faults must be rare.`,
      move: vm("Swap Sting", 34),
    };
  },
};

/** The highest fault rate that keeps the slowdown acceptable. */
export const maxRate: Generator = {
  id: "gen-vm-maxrate",
  topic: "Demand paging: tolerable fault rate",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x4a7e);
    const memNs = r.pick([100, 200, 250]);
    const slow = r.pick([0.05, 0.1, 0.2]);
    const rate = maxFaultRate(memNs, 8e6, slow);
    const perMillion = Math.round(rate * 1e6 * 100) / 100;
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A memory access takes ${memNs} ns and a page fault takes 8 ms to service. To slow the program by at most ${Math.round(slow * 100)}%, how many faults per million accesses can you tolerate?`,
      answer: perMillion,
      unit: "faults",
      explain: `Allow EAT ≤ ${memNs} × ${1 + slow} = ${Math.round(memNs * (1 + slow) * 100) / 100} ns. With EAT = ${memNs} + p × (8,000,000 − ${memNs}), p ≤ ${Math.round(memNs * slow * 100) / 100} / ${(8e6 - memNs).toLocaleString("en-US")} ≈ ${perMillion} per million accesses (Silberschatz §10.2.1).`,
      move: vm("Swap Sting", 34),
    };
  },
};

/** The size of a working set. */
export const workingSetSize: Generator = {
  id: "gen-vm-wss",
  topic: "Working sets: size of WS(t)",
  make(seed): NumericQ {
    const r = rng(seed ^ 0x55e7);
    const refs = refString(r, r.int(10, 14));
    const window = r.pick([3, 4, 5]);
    const t = r.int(window, refs.length - 1);
    const ws = workingSet(refs, t, window);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `The reference string is ${refs.join(" ")} and the working-set window is Δ = ${window}. How many pages are in the working set after reference number ${t + 1} (counting from 1)?`,
      answer: ws.length,
      unit: "pages",
      explain: `The working set is the distinct pages among the last Δ = ${window} references up to that point: ${refs.slice(t - window + 1, t + 1).join(" ")}. That is {${ws.join(", ")}}, so ${ws.length} pages.`,
      move: vm("Window Watch", 32),
    };
  },
};

/** Is the system thrashing? */
export const thrashCheck: Generator = {
  id: "gen-vm-thrash",
  topic: "Thrashing: total demand vs frames",
  make(seed): McqQ {
    const r = rng(seed ^ 0x7a5);
    const sizes = Array.from({ length: r.int(3, 4) }, () => r.int(3, 20));
    const total = sizes.reduce((a, b) => a + b, 0);
    const frames = Math.max(8, total + r.pick([-12, -6, -2, 3, 8, 15]));
    const yes = thrashing(sizes, frames);
    return {
      id: `${this.id}#${seed}`,
      prompt: `The processes have working sets of ${sizes.join(", ")} pages and the machine has ${frames} frames. What does the working-set model say?`,
      options: [
        `D = ${total} exceeds ${frames} frames: thrashing, so suspend a process`,
        `D = ${total} fits in ${frames} frames: no thrashing, and another process could be started`,
        `Thrashing, because the sum of the working sets is below ${frames}`,
        `Not enough information: it depends on the TLB hit ratio`,
      ],
      answer: yes ? 0 : 1,
      explain: `Total demand D = ${sizes.join(" + ")} = ${total}. ${yes ? `D > ${frames}, so processes steal each other's pages and thrash. The OS should suspend one and give its frames to the rest.` : `D ≤ ${frames}, so every working set fits.${frames - total > 0 ? ` ${frames - total} frames are spare, so a new process could be admitted.` : ""}`}`,
      move: vm("Thrash Storm", 34),
    };
  },
};

export const VIRTUAL_GENERATORS: Generator[] = [faultCountGen, victimChoice, faultEat, maxRate, workingSetSize, thrashCheck];
