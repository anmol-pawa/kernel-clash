import { fmt, type Generator, type MultiQ, type NumericQ, type OrderQ } from "@/game/engine/question";
import { BOOT_CHAINS, EVENTS, INSTRUCTIONS, interruptLoad } from "@/game/sim/basics";
import { rng, type Rng } from "@/lib/rng";

/** `n` items with between `lo` and `hi` of them from `yes` (the rest from `no`), shuffled. */
function mix<T>(r: Rng, yes: readonly T[], no: readonly T[], n: number, lo: number, hi: number) {
  const k = r.int(lo, hi);
  return r.shuffle([...r.shuffle(yes).slice(0, k), ...r.shuffle(no).slice(0, n - k)]);
}

const indexesWhere = <T>(items: readonly T[], test: (t: T) => boolean) => items.flatMap((t, i) => (test(t) ? [i] : []));

/** Select the privileged instructions from six. */
export const privilegedPick: Generator = {
  id: "gen-privileged",
  topic: "Which instructions are privileged",
  make(seed): MultiQ {
    const r = rng(seed);
    const items = mix(
      r,
      INSTRUCTIONS.filter((i) => i.privileged),
      INSTRUCTIONS.filter((i) => !i.privileged),
      6,
      2,
      4,
    );
    return {
      kind: "multi",
      id: `${this.id}#${seed}`,
      prompt: "Which of these instructions are privileged (allowed only in kernel mode)? Select all that apply.",
      options: items.map((i) => i.text),
      answers: indexesWhere(items, (i) => i.privileged),
      explain:
        "Anything that could take over the machine or another process is privileged: the timer, interrupts, I/O devices, memory-management registers and the mode bit. Reading the clock, arithmetic and the trap instruction itself are fine in user mode: the trap is how user code asks the kernel for help.",
      move: { name: "Ring Zero", type: "io", power: 34 },
    };
  },
};

/** Sort events into hardware interrupts or traps/exceptions. */
export const interruptOrTrap: Generator = {
  id: "gen-irq-or-trap",
  topic: "Interrupts vs traps",
  make(seed): MultiQ {
    const r = rng(seed);
    const wantIrq = r.next() < 0.5;
    const target = EVENTS.filter((e) => e.interrupt === wantIrq);
    const other = EVENTS.filter((e) => e.interrupt !== wantIrq);
    const items = mix(r, target, other, r.int(5, 6), 2, 3);
    return {
      kind: "multi",
      id: `${this.id}#${seed}`,
      prompt: wantIrq
        ? "Which of these reach the CPU as hardware interrupts (asynchronous, from a device)? Select all that apply."
        : "Which of these are traps or exceptions (synchronous, caused by the running instruction)? Select all that apply.",
      options: items.map((e) => e.text),
      answers: indexesWhere(items, (e) => e.interrupt === wantIrq),
      explain:
        "A device signals a hardware interrupt whenever it needs attention, whatever instruction is running, so it is asynchronous. A trap or exception comes from the instruction itself: a system call, a divide by zero, a page fault or an illegal access, so running the same code again triggers it again.",
      move: { name: "IRQ Jolt", type: "io", power: 32 },
    };
  },
};

/** Put a BIOS or UEFI boot chain (with up to two middle steps left out) in order. */
export const bootOrder: Generator = {
  id: "gen-boot-order",
  topic: "The boot sequence",
  make(seed): OrderQ {
    const r = rng(seed);
    const kind = r.pick(["BIOS", "UEFI"] as const);
    const chain = BOOT_CHAINS[kind];
    // keep power-on and init, drop 0–2 of the middle steps (relative order stays right)
    const drop = new Set(r.shuffle([1, 2, 3, 4]).slice(0, r.int(0, 2)));
    const steps = chain.filter((_, i) => !drop.has(i));
    return {
      kind: "order",
      id: `${this.id}#${seed}`,
      prompt: `Put these steps of booting a ${kind} PC into Linux in order.`,
      steps,
      explain:
        kind === "BIOS"
          ? "Firmware in ROM runs first and tests the hardware, then reads the boot block from the first sector (the MBR). That small boot loader loads the kernel, the kernel sets up the hardware and root file system, and finally starts init as PID 1."
          : "UEFI firmware tests the hardware, then reads a boot-loader file from the FAT-formatted EFI System Partition (no 512-byte boot block). The boot loader loads the kernel, which sets up the hardware and root file system and starts init as PID 1.",
      move: { name: "Bootstrap", type: "io", power: 36 },
    };
  },
};

/** CPU share spent handling a device's interrupts. */
export const interruptLoadQ: Generator = {
  id: "gen-irq-load",
  topic: "Interrupt overhead",
  make(seed): NumericQ {
    const r = rng(seed);
    const device = r.pick(["network card", "disk controller", "sound card", "serial port"]);
    const rate = r.pick([200, 500, 1000, 2000, 4000, 5000, 8000, 10000, 20000]);
    // keep the load at or under 50% so the device is still believable
    const us = r.pick([2, 4, 5, 10, 20, 25, 40, 50].filter((u) => interruptLoad(rate, u) <= 50));
    const answer = interruptLoad(rate, us);
    return {
      kind: "numeric",
      id: `${this.id}#${seed}`,
      prompt: `A ${device} raises ${rate.toLocaleString("en-US")} interrupts per second, and each interrupt handler runs for ${us} µs. What percentage of the CPU's time goes to handling them?`,
      answer,
      unit: "%",
      explain: `Per second the handlers run ${rate.toLocaleString("en-US")} × ${us} µs = ${(rate * us).toLocaleString("en-US")} µs. A second is 1,000,000 µs, so that is ${fmt(answer)}% of the CPU. At very high rates this is why fast devices switch to polling or interrupt coalescing.`,
      move: { name: "IRQ Storm", type: "io", power: 34 },
    };
  },
};

export const BASICS_GENERATORS: Generator[] = [privilegedPick, interruptOrTrap, bootOrder, interruptLoadQ];
