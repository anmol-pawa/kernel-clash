/**
 * Virtualization mechanics: Popek-Goldberg trap-and-emulate, two-dimensional
 * page walks and pre-copy live migration.
 *
 * Facts follow Popek & Goldberg (1974), Bhargava et al., "Accelerating
 * Two-Dimensional Page Walks for Virtualized Systems" (ASPLOS 2008) and Clark
 * et al., "Live Migration of Virtual Machines" (NSDI 2005):
 *   - a CPU is classically virtualizable when every sensitive instruction is
 *     also privileged, so each one traps in the deprivileged guest kernel and
 *     the hypervisor can emulate it;
 *   - with `n`-level guest tables and `m`-level nested (EPT/NPT) tables, a TLB
 *     miss reads (n+1)(m+1)-1 memory locations: each of the n guest-table
 *     reads and the final data address needs an m-step nested walk;
 *   - pre-copy migration sends all memory, then the pages dirtied meanwhile,
 *     round after round, and stops the guest only for the last small remainder.
 */

export interface Instr {
  name: string;
  /** traps when executed outside the most privileged mode */
  privileged: boolean;
  /** reads or changes machine state that only the (host) kernel may control */
  sensitive: boolean;
}

/** Popek-Goldberg theorem: virtualizable by trap-and-emulate iff sensitive ⊆ privileged. */
export const leaks = (isa: readonly Instr[]): Instr[] => isa.filter((i) => i.sensitive && !i.privileged);
export const virtualizable = (isa: readonly Instr[]): boolean => leaks(isa).length === 0;

export type Outcome = "native" | "trap" | "leak";

/** What happens to each instruction of a guest kernel running deprivileged. */
export function runGuest(isa: readonly Instr[], program: readonly string[]): { name: string; outcome: Outcome }[] {
  return program.map((name) => {
    const i = isa.find((x) => x.name === name);
    if (!i) throw new Error(`unknown instruction ${name}`);
    return { name, outcome: i.privileged ? "trap" : i.sensitive ? "leak" : "native" };
  });
}

/** A small teaching ISA modelled on x86 before VT-x: POPF is sensitive but silently ignores the interrupt flag in user mode. */
export const OLD_X86: readonly Instr[] = [
  { name: "ADD", privileged: false, sensitive: false },
  { name: "MOV CR3", privileged: true, sensitive: true },
  { name: "HLT", privileged: true, sensitive: true },
  { name: "POPF", privileged: false, sensitive: true },
];
/** The same ISA with VT-x / AMD-V: a guest mode makes every sensitive instruction exit to the hypervisor. */
export const HW_ASSISTED_X86: readonly Instr[] = OLD_X86.map((i) => (i.sensitive ? { ...i, privileged: true } : i));

/** Memory locations read by one TLB miss with n guest levels and m nested levels. */
export const nestedWalkRefs = (guestLevels: number, nestedLevels: number): number => (guestLevels + 1) * (nestedLevels + 1) - 1;

export interface Round {
  sentMB: number;
  seconds: number;
}
export interface Migration {
  rounds: Round[];
  /** MB copied while the guest is paused */
  stopCopyMB: number;
  downtimeSec: number;
  totalSec: number;
  converges: boolean;
}

/** Pre-copy: send everything, then what was dirtied while sending, until the remainder is small enough to pause for. */
export function preCopy(memMB: number, dirtyMBps: number, linkMBps: number, stopMB: number, maxRounds = 30): Migration {
  const rounds: Round[] = [];
  let pending = memMB;
  while (pending > stopMB && rounds.length < maxRounds) {
    const seconds = pending / linkMBps;
    rounds.push({ sentMB: pending, seconds });
    // a page cannot be dirty more than once per round, so the remainder never exceeds memory
    pending = Math.min(memMB, dirtyMBps * seconds);
  }
  const converges = pending <= stopMB;
  const downtimeSec = pending / linkMBps;
  return { rounds, stopCopyMB: pending, downtimeSec, totalSec: rounds.reduce((a, r) => a + r.seconds, 0) + downtimeSec, converges };
}
