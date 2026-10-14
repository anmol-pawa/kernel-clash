/**
 * OS-basics facts the generators draw from, each tagged with its answer, plus
 * the interrupt-load arithmetic. Sources: Silberschatz, Operating System
 * Concepts ch. 1–2 (privileged instructions, interrupts vs traps, booting).
 */

/** Instructions and whether they are privileged (kernel mode only). */
export const INSTRUCTIONS: readonly { text: string; privileged: boolean }[] = [
  { text: "Set the value of the timer", privileged: true },
  { text: "Turn off interrupts", privileged: true },
  { text: "Clear all of physical memory", privileged: true },
  { text: "Modify the device-status table", privileged: true },
  { text: "Send a command to the disk controller", privileged: true },
  { text: "Load the page-table base register", privileged: true },
  { text: "Set the mode bit to kernel mode", privileged: true },
  { text: "Halt the CPU", privileged: true },
  { text: "Read the clock", privileged: false },
  { text: "Execute the trap (syscall) instruction", privileged: false },
  { text: "Add two registers", privileged: false },
  { text: "Call a function in the same program", privileged: false },
  { text: "Load a word from the program's own memory", privileged: false },
  { text: "Compare two values and branch", privileged: false },
];

/**
 * Events and their source: a hardware interrupt is asynchronous (a device
 * signals the CPU, whatever instruction is running); a trap or exception is
 * synchronous (caused by the instruction the CPU is executing).
 */
export const EVENTS: readonly { text: string; interrupt: boolean }[] = [
  { text: "A key is pressed on the keyboard", interrupt: true },
  { text: "A disk read finishes", interrupt: true },
  { text: "The hardware timer goes off", interrupt: true },
  { text: "A network packet arrives", interrupt: true },
  { text: "The mouse is moved", interrupt: true },
  { text: "A USB stick is plugged in", interrupt: true },
  { text: "The program divides by zero", interrupt: false },
  { text: "The program executes the syscall instruction", interrupt: false },
  { text: "The program touches a page that isn't in memory", interrupt: false },
  { text: "The program runs a privileged instruction in user mode", interrupt: false },
  { text: "The program hits a debugger breakpoint instruction", interrupt: false },
  { text: "The program dereferences an invalid address", interrupt: false },
];

/** The boot chain of a BIOS (legacy MBR) machine and of a UEFI machine, in order. */
export const BOOT_CHAINS = {
  BIOS: [
    "Power on: the CPU starts running firmware from ROM",
    "The BIOS runs the power-on self-test (POST)",
    "The BIOS loads the 512-byte boot block from the disk's MBR",
    "The boot loader (e.g. GRUB) loads the kernel image into memory",
    "The kernel initializes the hardware and mounts the root file system",
    "The kernel starts init (PID 1), the first user-mode process",
  ],
  UEFI: [
    "Power on: the CPU starts running firmware from flash",
    "The UEFI firmware runs the power-on self-test (POST)",
    "UEFI loads the boot loader file from the EFI System Partition",
    "The boot loader loads the kernel image into memory",
    "The kernel initializes the hardware and mounts the root file system",
    "The kernel starts init (PID 1), the first user-mode process",
  ],
} as const;

/**
 * The share of CPU time (in %) spent in interrupt handlers when a device
 * raises `perSecond` interrupts and each handler runs for `handlerUs` µs.
 */
export const interruptLoad = (perSecond: number, handlerUs: number) => (perSecond * handlerUs) / 1e4; // µs per second / 1e6, as a percentage
