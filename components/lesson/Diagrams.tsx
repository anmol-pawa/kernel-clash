import type { ReactNode } from "react";
import { PAGING_TABLE, RACE_THREADS, type DiagramId } from "@/content/lessons";
import { BANKER_EXAMPLE, findCycle, need, safety } from "@/game/sim/deadlock";
import { FIT_EXAMPLE, SEGMENT_EXAMPLE, allocate, effectiveAccessTime, externalFragmentation, invertedLookup, pageTableBytes, pagesFor, splitAddress, translate, translateSegment } from "@/game/sim/memory";
import { BELADY_EXAMPLE, REFERENCE_EXAMPLE, demandPagingEat, faultCount, faultCurve, workingSet } from "@/game/sim/paging";
import { DISK_EXAMPLE, inodeMaxBlocks, raidGuaranteedFailures, raidUsableDisks, scheduleDisk, type DiskPolicy, type RaidLevel } from "@/game/sim/storage";
import { HW_ASSISTED_X86, OLD_X86, nestedWalkRefs, preCopy, runGuest, type Outcome } from "@/game/sim/virt";
import { STORE_BUFFERING, abaScenario, outcomes } from "@/game/sim/atomics";
import { Buddy, FreeListHeap, MMAP_THRESHOLD, SlabCache, centralLockAcquisitions, leafTableBytes, pagesToMap, slabLeftover, tlbReach } from "@/game/sim/allocator";
import { alternatingWrites, coherenceMisses, runFutex, writeTime } from "@/game/sim/contention";
import { Overlay, PidNamespaces, WHITEOUT, cpuMax, memoryMax, type Layer } from "@/game/sim/containers";
import { instrText, runSchedule, runSemaphore } from "@/game/sim/sync";
import { fcfs, mlfq, priority, roundRobin, sjf, srtf, type Job, type Schedule } from "@/game/sim/scheduling";
import { GanttRows } from "./Gantt";

/**
 * Illustrated lesson diagrams, drawn as pixel art in SVG: shaded blocks with
 * a dark outline, a highlight row and a shadow row, pixel arrows and the
 * pixel font. Every diagram uses a 180×112 grid scaled with crisp edges.
 */
const W = 180;
const H = 112;
const INK = "#1a1430";

type Ramp = readonly [dark: string, mid: string, light: string];
const CREAM: Ramp = ["#b9b0a0", "#f8f4e6", "#ffffff"];
const BLUE: Ramp = ["#1f3f6e", "#2f68a8", "#5a9ad8"];
const PURPLE: Ramp = ["#2a1a58", "#4a2f8e", "#7a5ac8"];
const STONE: Ramp = ["#3a3850", "#5e5a78", "#8a86a8"];
const GOLD: Ramp = ["#8a5a10", "#e0a030", "#ffe27a"];
const TEAL: Ramp = ["#0f5a55", "#178f84", "#5eead4"];
const RED: Ramp = ["#7a1a2a", "#c83a4a", "#f87a8a"];
const GREEN: Ramp = ["#1f5a2c", "#3a8a3a", "#7cc24f"];

/** A shaded pixel block: outline, fill, top highlight and bottom shadow. */
function Block({ x, y, w, h, ramp, children }: { x: number; y: number; w: number; h: number; ramp: Ramp; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={INK} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill={ramp[1]} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={1} fill={ramp[2]} />
      <rect x={x + 1} y={y + 1} width={1} height={h - 3} fill={ramp[2]} />
      <rect x={x + 1} y={y + h - 2} width={w - 2} height={1} fill={ramp[0]} />
      {children}
    </g>
  );
}

/** Pixel-font text. Sizes are grid units (one pixel-font glyph is ~`size` wide). */
function Text({ x, y, children, size = 5, fill = INK, anchor = "start" }: { x: number; y: number; children: ReactNode; size?: number; fill?: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} style={{ fontFamily: "var(--font-pixel)" }}>
      {children}
    </text>
  );
}

/** A labelled block with centred text (one or two lines). */
function Card({ x, y, w, h, ramp = CREAM, lines, size = 5, ink = INK }: { x: number; y: number; w: number; h: number; ramp?: Ramp; lines: string[]; size?: number; ink?: string }) {
  const top = y + h / 2 - ((lines.length - 1) * (size + 2)) / 2 + size / 2;
  return (
    <Block x={x} y={y} w={w} h={h} ramp={ramp}>
      {lines.map((l, i) => (
        <Text key={i} x={x + w / 2} y={top + i * (size + 2)} size={size} fill={ink} anchor="middle">
          {l}
        </Text>
      ))}
    </Block>
  );
}

/** A 2-unit-thick axis-aligned pixel arrow with a stepped head. */
function Arrow({ x1, y1, x2, y2, color = "#ffe27a" }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const horiz = y1 === y2;
  const dir = Math.sign(horiz ? x2 - x1 : y2 - y1);
  const len = Math.abs(horiz ? x2 - x1 : y2 - y1);
  const rects: [number, number, number, number][] = [];
  // shaft, stopping short of the head
  if (horiz) rects.push([Math.min(x1, x2 - dir * 3), y1 - 1, len - 3, 2]);
  else rects.push([x1 - 1, Math.min(y1, y2 - dir * 3), 2, len - 3]);
  // head: three steps narrowing towards the tip
  for (let s = 0; s < 3; s++) {
    const half = 3 - s;
    if (horiz) rects.push([x2 - dir * (3 - s) - (dir < 0 ? 0 : 1), y1 - half, 1, half * 2]);
    else rects.push([x1 - half, y2 - dir * (3 - s) - (dir < 0 ? 0 : 1), half * 2, 1]);
  }
  return (
    <g>
      {rects.map(([x, y, w, h], i) => (
        <rect key={`s${i}`} x={x - 0.5} y={y - 0.5} width={w + 1} height={h + 1} fill={INK} />
      ))}
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
      ))}
    </g>
  );
}

/** A band of background with a title tag in its top-left corner. */
function Band({ y, h, ramp, title, tag }: { y: number; h: number; ramp: Ramp; title: string; tag?: string }) {
  return (
    <g>
      <rect x={0} y={y} width={W} height={h} fill={ramp[1]} />
      <rect x={0} y={y} width={W} height={1} fill={ramp[2]} />
      {/* dither row for a little texture */}
      {Array.from({ length: W / 4 }, (_, i) => (
        <rect key={i} x={i * 4 + ((y / 2) % 2) * 2} y={y + h - 2} width={1} height={1} fill={ramp[0]} />
      ))}
      <Text x={3} y={y + 7} size={5} fill="#f8f4e6">
        {title}
      </Text>
      {tag && (
        <g>
          <rect x={W - 30} y={y + 2} width={27} height={7} fill={INK} />
          <Text x={W - 16.5} y={y + 7.5} size={4} fill="#ffe27a" anchor="middle">
            {tag}
          </Text>
        </g>
      )}
    </g>
  );
}

/** User mode above, kernel mode below, a gate in the wall between them. */
function Modes() {
  return (
    <>
      <Band y={0} h={50} ramp={BLUE} title="USER MODE" tag="BIT 1" />
      {["APP", "SHELL", "GAME"].map((l, i) => (
        <Card key={l} x={12 + i * 56} y={14} w={44} h={18} lines={[l]} />
      ))}
      <Text x={3} y={45} size={4} fill="#cfe4ff">
        NO PRIVILEGED OPS
      </Text>
      {/* the wall between the modes, with a gate */}
      <rect x={0} y={50} width={W} height={10} fill={INK} />
      {Array.from({ length: 18 }, (_, i) => (
        <rect key={i} x={i * 10 + (i % 2) * 0} y={51} width={9} height={4} fill={STONE[1]} />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <rect key={i} x={i * 10 + 5} y={55} width={9} height={4} fill={STONE[0]} />
      ))}
      <rect x={78} y={49} width={24} height={12} fill={INK} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={80 + i * 5} y={50} width={1} height={10} fill={GOLD[1]} />
      ))}
      <rect x={79} y={54} width={22} height={1} fill={GOLD[1]} />
      <Band y={60} h={36} ramp={PURPLE} title="KERNEL MODE" tag="BIT 0" />
      <Arrow x1={84} y1={36} x2={84} y2={76} color="#ffe27a" />
      <Text x={80} y={73} size={4} fill="#ffe27a" anchor="end">
        TRAP
      </Text>
      <Arrow x1={96} y1={76} x2={96} y2={36} color="#7cf0c8" />
      <Text x={100} y={73} size={4} fill="#7cf0c8">
        RETURN
      </Text>
      {["SCHED", "MEMORY", "DRIVERS"].map((l, i) => (
        <Card key={l} x={8 + i * 60} y={78} w={44} h={14} lines={[l]} ramp={GOLD} />
      ))}
      <rect x={0} y={96} width={W} height={16} fill={STONE[0]} />
      <rect x={0} y={96} width={W} height={1} fill={STONE[2]} />
      <Text x={90} y={107} size={5} fill="#f8f4e6" anchor="middle">
        HARDWARE · CPU RAM DISK
      </Text>
    </>
  );
}

/** read(): wrapper → trap → system-call table → handler → return. */
function Syscall() {
  const rows = ["0 read", "1 write", "2 open", "3 close"];
  return (
    <>
      <Band y={0} h={46} ramp={BLUE} title="USER SPACE" />
      <Card x={6} y={14} w={66} h={26} lines={["PROGRAM", "read(fd,buf,n)"]} size={4} />
      <Card x={100} y={14} w={74} h={26} lines={["C LIBRARY", "rax=0, args", "in registers"]} size={4} />
      <Arrow x1={73} y1={27} x2={99} y2={27} />
      <rect x={0} y={46} width={W} height={2} fill={INK} />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={i * 6} y={46} width={3} height={2} fill="#ffe27a" />
      ))}
      <Band y={48} h={64} ramp={PURPLE} title="KERNEL" />
      {/* the trap */}
      <Arrow x1={150} y1={41} x2={150} y2={62} />
      <rect x={152} y={46} width={28} height={8} fill={INK} />
      <Text x={166} y={52} size={4} fill="#ffe27a" anchor="middle">
        syscall
      </Text>
      {/* the system-call table */}
      <Block x={108} y={62} w={66} h={46} ramp={CREAM}>
        <Text x={141} y={69} size={4} anchor="middle">
          SYSCALL TABLE
        </Text>
        {rows.map((r, i) => (
          <g key={r}>
            <rect x={111} y={72 + i * 9} width={60} height={8} fill={i === 0 ? "#ffe27a" : "#e8e0cc"} />
            <Text x={114} y={78 + i * 9} size={4}>
              {r}
            </Text>
          </g>
        ))}
      </Block>
      <Arrow x1={107} y1={76} x2={76} y2={76} />
      <Card x={8} y={64} w={66} h={22} lines={["sys_read()", "HANDLER"]} size={4} ramp={GOLD} />
      {/* return from the trap */}
      <Arrow x1={40} y1={63} x2={40} y2={41} color="#7cf0c8" />
      <Text x={44} y={58} size={4} fill="#7cf0c8">
        RETURN
      </Text>
      <Text x={44} y={64} size={3.5} fill="#cfe4ff">
        result in rax
      </Text>
    </>
  );
}

/** Devices raise IRQs; the CPU saves state and jumps through the vector. */
function Interrupt() {
  const devices: [string, Ramp][] = [
    ["DISK", STONE],
    ["KEYBOARD", TEAL],
    ["TIMER", RED],
  ];
  const vec = ["0 DIVIDE ERROR", "14 PAGE FAULT", "· · ·", "n KEYBOARD"];
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#22184a" />
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={(i * 37) % W} y={(i * 23) % H} width={1} height={1} fill="#3a2c6e" />
      ))}
      {devices.map(([d, r], i) => (
        <g key={d}>
          <Card x={4} y={8 + i * 22} w={44} h={16} lines={[d]} size={4} ramp={r} ink="#f8f4e6" />
          <rect x={48} y={15 + i * 22} width={8} height={2} fill="#ffe27a" />
        </g>
      ))}
      <rect x={55} y={15} width={2} height={46} fill="#ffe27a" />
      <Arrow x1={56} y1={39} x2={63} y2={39} />
      <Text x={56} y={9} size={4} fill="#ffe27a" anchor="middle">
        IRQ
      </Text>
      {/* the CPU chip */}
      <Block x={64} y={24} w={34} h={30} ramp={GREEN}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={68 + i * 7} y={21} width={3} height={3} fill={STONE[2]} />
            <rect x={68 + i * 7} y={54} width={3} height={3} fill={STONE[2]} />
          </g>
        ))}
        <Text x={81} y={38} size={5} fill="#f8f4e6" anchor="middle">
          CPU
        </Text>
        <Text x={81} y={46} size={3.5} fill="#e8ffe0" anchor="middle">
          save PC
        </Text>
      </Block>
      {/* interrupt vector */}
      <Block x={110} y={4} w={66} h={52} ramp={CREAM}>
        <Text x={143} y={11} size={4} anchor="middle">
          VECTOR TABLE
        </Text>
        {vec.map((v, i) => (
          <g key={v}>
            <rect x={113} y={14 + i * 9} width={60} height={8} fill={i === 3 ? "#ffe27a" : "#e8e0cc"} />
            <Text x={115} y={20 + i * 9} size={3.5}>
              {v}
            </Text>
          </g>
        ))}
      </Block>
      <Arrow x1={99} y1={39} x2={109} y2={39} />
      <Arrow x1={143} y1={57} x2={143} y2={72} />
      <Card x={110} y={73} w={66} h={18} lines={["KERNEL HANDLER"]} size={4} ramp={GOLD} />
      <Arrow x1={109} y1={82} x2={82} y2={82} color="#7cf0c8" />
      <Card x={6} y={73} w={74} h={18} lines={["RESTORE + RESUME"]} size={4} ramp={TEAL} ink="#f8f4e6" />
      <Text x={90} y={104} size={4} fill="#cfc4ff" anchor="middle">
        TRAPS USE THE SAME TABLE
      </Text>
    </>
  );
}

/** Three kernel designs side by side. */
function Kernels() {
  const col = (x: number, title: string, user: string[], kernel: string[], kh: number) => (
    <g>
      <Text x={x + 28} y={8} size={4.5} fill="#ffe27a" anchor="middle">
        {title}
      </Text>
      <Block x={x} y={12} w={56} h={84 - kh} ramp={BLUE}>
        <Text x={x + 3} y={19} size={3.5} fill="#cfe4ff">
          USER
        </Text>
        {user.map((u, i) => (
          <Card key={u} x={x + 4} y={22 + i * 11} w={48} h={10} lines={[u]} size={3.5} ramp={u === "APPS" ? CREAM : TEAL} ink={u === "APPS" ? INK : "#f8f4e6"} />
        ))}
      </Block>
      <Block x={x} y={96 - kh} w={56} h={kh} ramp={PURPLE}>
        <Text x={x + 3} y={103 - kh} size={3.5} fill="#e0d4ff">
          KERNEL
        </Text>
        {kernel.map((k, i) => (
          <rect key={k} x={x + 4 + (i % 2) * 25} y={105 - kh + Math.floor(i / 2) * 9} width={23} height={8} fill={GOLD[1]} />
        ))}
        {kernel.map((k, i) => (
          <Text key={`t${k}`} x={x + 15.5 + (i % 2) * 25} y={111 - kh + Math.floor(i / 2) * 9} size={3.5} anchor="middle">
            {k}
          </Text>
        ))}
      </Block>
    </g>
  );
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#22184a" />
      {col(2, "MONOLITHIC", ["APPS"], ["SCHED", "MEM", "FS", "DRV", "NET", "IPC"], 40)}
      {col(62, "MICRO", ["APPS", "FS", "DRIVERS", "NET"], ["IPC", "SCHED", "MEM"], 29)}
      {col(122, "HYBRID", ["APPS", "SERVERS"], ["IPC", "SCHED", "MEM", "FS", "DRV"], 37)}
      <rect x={0} y={98} width={W} height={14} fill={STONE[0]} />
      <rect x={0} y={98} width={W} height={1} fill={STONE[2]} />
      <Text x={90} y={107} size={4} fill="#f8f4e6" anchor="middle">
        HARDWARE
      </Text>
    </>
  );
}

/** Power → firmware → boot loader → kernel → init, as rising steps. */
function Boot() {
  const steps: [string, string, Ramp][] = [
    ["FIRMWARE", "UEFI", STONE],
    ["POST", "checks", TEAL],
    ["BOOT", "LOADER", GREEN],
    ["KERNEL", "loads", PURPLE],
    ["INIT", "PID 1", GOLD],
  ];
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#1b1446" />
      <rect x={0} y={70} width={W} height={42} fill="#251a5c" />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={(i * 53) % W} y={(i * 17) % 60} width={1} height={1} fill="#6b5ab0" />
      ))}
      {/* the power button */}
      <Block x={4} y={84} w={18} h={18} ramp={RED}>
        <rect x={12} y={88} width={2} height={6} fill="#f8f4e6" />
        <rect x={9} y={91} width={1} height={6} fill="#f8f4e6" />
        <rect x={16} y={91} width={1} height={6} fill="#f8f4e6" />
        <rect x={10} y={97} width={6} height={1} fill="#f8f4e6" />
      </Block>
      <Text x={13} y={109} size={3.5} fill="#f8a0a8" anchor="middle">
        POWER
      </Text>
      {steps.map(([a, b, r], i) => {
        const x = 26 + i * 31;
        const y = 78 - i * 15;
        const ink = r === GOLD ? INK : "#f8f4e6";
        return (
          <g key={a}>
            <rect x={x} y={y + 22} width={29} height={110 - y - 22} fill={INK} />
            <rect x={x + 1} y={y + 23} width={27} height={110 - y - 24} fill={r[0]} />
            <Card x={x} y={y} w={29} h={22} lines={[a, b]} size={3} ramp={r} ink={ink} />
            <Text x={x + 14.5} y={y + 31} size={5} fill="#ffe27a" anchor="middle">
              {i + 1}
            </Text>
          </g>
        );
      })}
      {steps.slice(1).map((_, i) => (
        <Arrow key={i} x1={26 + i * 31 + 22} y1={74 - i * 15} x2={26 + (i + 1) * 31 + 6} y2={74 - i * 15} />
      ))}
      <Arrow x1={22} y1={93} x2={30} y2={93} />
    </>
  );
}

/** A plain 2-unit pixel segment with an outline (the first leg of an elbow arrow). */
function Seg({ x1, y1, x2, y2, color = "#ffe27a" }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const x = Math.min(x1, x2) - 1;
  const y = Math.min(y1, y2) - 1;
  const w = Math.abs(x2 - x1) + 2;
  const h = Math.abs(y2 - y1) + 2;
  return (
    <g>
      <rect x={x - 0.5} y={y - 0.5} width={w + 1} height={h + 1} fill={INK} />
      <rect x={x} y={y} width={w} height={h} fill={color} />
    </g>
  );
}

/** A starry night backdrop shared by the process diagrams. */
function Night({ seed = 0 }: { seed?: number }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#16303a" />
      {Array.from({ length: 36 }, (_, i) => (
        <rect key={i} x={(i * 41 + seed * 13) % W} y={(i * 29 + seed * 7) % H} width={1} height={1} fill="#2c5a64" />
      ))}
    </>
  );
}

/**
 * The five-state process diagram. A process token (a little gold "P1" chip)
 * walks NEW → READY → RUNNING → WAITING → READY → RUNNING → TERMINATED on a
 * loop (CSS `.ps-token`, still at RUNNING under reduced motion).
 */
function ProcessStates() {
  const states: [string, number, number, number, Ramp, string][] = [
    ["NEW", 4, 6, 40, STONE, "#f8f4e6"],
    ["TERMINATED", 124, 6, 52, RED, "#f8f4e6"],
    ["READY", 6, 44, 46, TEAL, "#f8f4e6"],
    ["RUNNING", 118, 44, 54, GREEN, "#f8f4e6"],
    ["WAITING", 64, 88, 52, PURPLE, "#f8f4e6"],
  ];
  return (
    <>
      <Night />
      {/* admitted */}
      <Arrow x1={24} y1={24} x2={24} y2={43} />
      <Text x={28} y={36} size={3.5} fill="#ffe27a">
        ADMITTED
      </Text>
      {/* dispatch and interrupt */}
      <Arrow x1={53} y1={49} x2={117} y2={49} />
      <Text x={83} y={46} size={3} fill="#ffe27a" anchor="middle">
        SCHEDULER DISPATCH
      </Text>
      <Arrow x1={117} y1={58} x2={53} y2={58} color="#f87a8a" />
      <Text x={85} y={67} size={3.5} fill="#f87a8a" anchor="middle">
        INTERRUPT
      </Text>
      {/* exit */}
      <Arrow x1={150} y1={43} x2={150} y2={24} />
      <Text x={146} y={35} size={3.5} fill="#ffe27a" anchor="end">
        EXIT
      </Text>
      {/* I/O wait: running → waiting */}
      <Seg x1={158} y1={63} x2={158} y2={96} color="#cfc4ff" />
      <Arrow x1={158} y1={96} x2={117} y2={96} color="#cfc4ff" />
      <Text x={161} y={80} size={3.5} fill="#cfc4ff">
        I/O
      </Text>
      <Text x={161} y={85} size={3.5} fill="#cfc4ff">
        WAIT
      </Text>
      {/* I/O done: waiting → ready */}
      <Seg x1={63} y1={96} x2={24} y2={96} color="#7cf0c8" />
      <Arrow x1={24} y1={96} x2={24} y2={63} color="#7cf0c8" />
      <Text x={28} y={80} size={3.5} fill="#7cf0c8">
        I/O DONE
      </Text>
      {states.map(([l, x, y, w, r, ink]) => (
        <Card key={l} x={x} y={y} w={w} h={l === "READY" || l === "RUNNING" ? 19 : 17} lines={[l]} size={4} ramp={r} ink={ink} />
      ))}
      <Text x={90} y={110} size={3.5} fill="#9ad8e0" anchor="middle">
        ONE RUNNING PER CORE
      </Text>
      {/* the walking process token, drawn centred on (0,0) */}
      <g className="ps-token" data-testid="ps-token">
        <rect x={-6} y={-5} width={12} height={10} fill={INK} />
        <rect x={-5} y={-4} width={10} height={8} fill={GOLD[1]} />
        <rect x={-5} y={-4} width={10} height={1} fill={GOLD[2]} />
        <rect x={-5} y={3} width={10} height={1} fill={GOLD[0]} />
        <Text x={0} y={2} size={3.5} anchor="middle">
          P1
        </Text>
      </g>
    </>
  );
}

/** P0 → save PCB0 → reload PCB1 → P1, with time running down the page. */
function ContextSwitch() {
  const lane = (x: number, label: string) => (
    <Text x={x} y={8} size={4.5} fill="#ffe27a" anchor="middle">
      {label}
    </Text>
  );
  /** an executing bar (green) or an idle dotted line */
  const run = (x: number, y: number, h: number) => <Card x={x - 12} y={y} w={24} h={h} lines={["RUN"]} size={3.5} ramp={GREEN} ink="#f8f4e6" />;
  const idle = (x: number, y: number, h: number) => (
    <g>
      {Array.from({ length: Math.floor(h / 4) }, (_, i) => (
        <rect key={i} x={x - 1} y={y + i * 4} width={2} height={2} fill="#5e5a78" />
      ))}
    </g>
  );
  return (
    <>
      <Night seed={2} />
      {lane(22, "P0")}
      {lane(90, "KERNEL")}
      {lane(158, "P1")}
      {/* P0 runs, P1 idles */}
      {run(22, 11, 20)}
      {idle(158, 12, 46)}
      <Arrow x1={35} y1={26} x2={63} y2={26} color="#f87a8a" />
      <Text x={37} y={22} size={3} fill="#f87a8a">
        INTERRUPT
      </Text>
      <Card x={64} y={16} w={52} h={16} lines={["SAVE STATE", "INTO PCB0"]} size={3.5} ramp={GOLD} />
      <Arrow x1={90} y1={33} x2={90} y2={40} />
      <Card x={64} y={41} w={52} h={16} lines={["RELOAD STATE", "FROM PCB1"]} size={3.5} ramp={GOLD} />
      <Arrow x1={117} y1={52} x2={145} y2={52} color="#7cf0c8" />
      {/* P1 runs, P0 idles */}
      {idle(22, 34, 26)}
      {run(158, 57, 20)}
      <Text x={2} y={58} size={3} fill="#9ad8e0">
        WAITS
      </Text>
      {/* the two PCBs */}
      {[
        ["PCB0", 10],
        ["PCB1", 98],
      ].map(([name, x]) => (
        <Block key={name} x={x as number} y={80} w={72} h={30} ramp={CREAM}>
          <rect x={(x as number) + 2} y={82} width={68} height={7} fill={TEAL[1]} />
          <Text x={(x as number) + 36} y={87.5} size={3.5} fill="#f8f4e6" anchor="middle">
            {name}
          </Text>
          {["STATE  PC", "REGISTERS", "PAGE TABLE"].map((f, i) => (
            <Text key={f} x={(x as number) + 4} y={95 + i * 5.5} size={3}>
              {f}
            </Text>
          ))}
        </Block>
      ))}
      <Seg x1={60} y1={30} x2={46} y2={30} color="#e0a030" />
      <Seg x1={46} y1={30} x2={46} y2={78} color="#e0a030" />
      <Seg x1={120} y1={45} x2={134} y2={45} color="#e0a030" />
      <Seg x1={134} y1={45} x2={134} y2={78} color="#e0a030" />
      <Text x={90} y={70} size={3} fill="#ffe27a" anchor="middle">
        TIME ↓
      </Text>
    </>
  );
}

/** Parent → fork() → (parent: wait()) and (child: exec() → exit()) → resumes. */
function ForkExec() {
  return (
    <>
      <Night seed={4} />
      <Card x={4} y={42} w={32} h={22} lines={["PARENT", "pid 100"]} size={3.5} ramp={TEAL} ink="#f8f4e6" />
      <Arrow x1={37} y1={53} x2={45} y2={53} />
      <Card x={46} y={44} w={30} h={18} lines={["fork()"]} size={4} ramp={GOLD} />
      {/* parent branch: fork() returned the child's pid */}
      <Seg x1={61} y1={43} x2={61} y2={21} />
      <Arrow x1={61} y1={21} x2={95} y2={21} />
      <Text x={58} y={31} size={3} fill="#ffe27a" anchor="end">
        RETURNS 101
      </Text>
      <Card x={96} y={12} w={36} h={18} lines={["wait()", "blocks"]} size={3.5} ramp={STONE} ink="#f8f4e6" />
      <Arrow x1={133} y1={21} x2={141} y2={21} />
      <Card x={142} y={12} w={34} h={18} lines={["PARENT", "RESUMES"]} size={3.5} ramp={TEAL} ink="#f8f4e6" />
      {/* child branch: fork() returned 0 */}
      <Seg x1={61} y1={63} x2={61} y2={87} color="#7cf0c8" />
      <Arrow x1={61} y1={87} x2={79} y2={87} color="#7cf0c8" />
      <Text x={58} y={78} size={3} fill="#7cf0c8" anchor="end">
        RETURNS 0
      </Text>
      <Card x={80} y={78} w={30} h={18} lines={["CHILD", "pid 101"]} size={3.5} ramp={GREEN} ink="#f8f4e6" />
      <Arrow x1={111} y1={87} x2={115} y2={87} color="#7cf0c8" />
      <Card x={116} y={78} w={28} h={18} lines={["exec()", "\"ls\""]} size={3.5} ramp={PURPLE} ink="#f8f4e6" />
      <Arrow x1={145} y1={87} x2={149} y2={87} color="#7cf0c8" />
      <Card x={150} y={78} w={26} h={18} lines={["exit()"]} size={3.5} ramp={RED} ink="#f8f4e6" />
      {/* exit wakes the waiting parent */}
      <Arrow x1={163} y1={77} x2={163} y2={31} color="#f87a8a" />
      <Text x={160} y={56} size={3} fill="#f87a8a" anchor="end">
        STATUS
      </Text>
      <Text x={90} y={108} size={3.5} fill="#9ad8e0" anchor="middle">
        exec() REPLACES THE CHILD&apos;S CODE
      </Text>
    </>
  );
}

/** A 2-wide pixel zigzag: one thread of execution. */
function Squiggle({ x, y, h, color = "#ffe27a" }: { x: number; y: number; h: number; color?: string }) {
  return (
    <g>
      {Array.from({ length: Math.floor(h / 3) }, (_, i) => {
        const dx = [0, 1, 2, 1][i % 4];
        return (
          <g key={i}>
            <rect x={x + dx - 0.5} y={y + i * 3 - 0.5} width={3} height={4} fill={INK} />
            <rect x={x + dx} y={y + i * 3} width={2} height={3} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

/** A single-threaded process next to a multithreaded one (shared code/data/files). */
function Threads() {
  const shared = (x: number, w: number, size: number) => {
    const cw = (w - 8) / 3;
    return ["CODE", "DATA", "FILES"].map((l, i) => <Card key={l} x={x + 3 + i * (cw + 1)} y={20} w={cw} h={12} lines={[l]} size={size} ramp={GOLD} />);
  };
  const own = (x: number, cx: number) => (
    <g>
      <Card x={x} y={36} w={22} h={10} lines={["REGS"]} size={3} ramp={CREAM} />
      <Card x={x} y={47} w={22} h={10} lines={["STACK"]} size={3} ramp={CREAM} />
      <Card x={x} y={58} w={22} h={8} lines={["PC"]} size={3} ramp={CREAM} />
      <Squiggle x={cx} y={70} h={24} />
    </g>
  );
  return (
    <>
      <Night seed={6} />
      <Block x={4} y={10} w={50} h={90} ramp={BLUE}>
        <Text x={29} y={17} size={3.5} fill="#cfe4ff" anchor="middle">
          ONE THREAD
        </Text>
      </Block>
      {shared(4, 50, 2.5)}
      {own(18, 28)}
      <Block x={62} y={10} w={114} h={90} ramp={BLUE}>
        <Text x={119} y={17} size={3.5} fill="#cfe4ff" anchor="middle">
          THREE THREADS
        </Text>
      </Block>
      {shared(62, 114, 3)}
      {[0, 1, 2].map((i) => (
        <g key={i}>{own(70 + i * 35, 80 + i * 35)}</g>
      ))}
      <Text x={90} y={108} size={3.5} fill="#ffe27a" anchor="middle">
        GOLD: SHARED · CREAM: PER THREAD
      </Text>
    </>
  );
}

/** Shared memory beside message passing through the kernel. */
function Ipc() {
  const proc = (x: number, y: number, l: string) => <Card x={x} y={y} w={30} h={16} lines={[l]} size={4} ramp={TEAL} ink="#f8f4e6" />;
  return (
    <>
      <Night seed={8} />
      <Text x={44} y={8} size={4} fill="#ffe27a" anchor="middle">
        SHARED MEMORY
      </Text>
      <Text x={136} y={8} size={4} fill="#ffe27a" anchor="middle">
        MESSAGE PASSING
      </Text>
      <rect x={89} y={0} width={2} height={88} fill={INK} />
      {/* shared memory: both map one region; the kernel only sets it up */}
      {proc(4, 14, "A")}
      {proc(54, 14, "B")}
      <Block x={14} y={42} w={60} h={20} ramp={GOLD}>
        <Text x={44} y={50} size={3.5} anchor="middle">
          SHARED REGION
        </Text>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={18 + i * 9} y={54} width={7} height={5} fill={i < 3 ? "#8a5a10" : "#fff4c0"} />
        ))}
      </Block>
      <Arrow x1={19} y1={31} x2={19} y2={41} />
      <Text x={23} y={38} size={3} fill="#ffe27a">
        WRITE
      </Text>
      <Arrow x1={69} y1={41} x2={69} y2={31} color="#7cf0c8" />
      <Text x={66} y={38} size={3} fill="#7cf0c8" anchor="end">
        READ
      </Text>
      {/* message passing: send/receive go through a kernel queue */}
      {proc(96, 14, "A")}
      {proc(146, 14, "B")}
      <Arrow x1={104} y1={31} x2={104} y2={68} />
      <Text x={107} y={42} size={3} fill="#ffe27a">
        send()
      </Text>
      <Arrow x1={170} y1={68} x2={170} y2={31} color="#7cf0c8" />
      <Text x={167} y={56} size={3} fill="#7cf0c8" anchor="end">
        receive()
      </Text>
      <Band y={88} h={24} ramp={PURPLE} title="KERNEL" />
      <Block x={98} y={69} w={78} h={16} ramp={CREAM}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={110 + i * 15} y={72} width={11} height={10} fill={INK} />
            <rect x={111 + i * 15} y={73} width={9} height={8} fill={i === 0 ? "#ffe27a" : "#e8e0cc"} />
            <rect x={111 + i * 15} y={73} width={9} height={1} fill="#b9b0a0" />
            <rect x={112 + i * 15} y={75} width={4} height={1} fill="#b9b0a0" />
          </g>
        ))}
      </Block>
      <Text x={136} y={101} size={3.5} fill="#ffe27a" anchor="middle">
        MESSAGE QUEUE
      </Text>
      <Text x={44} y={101} size={3.5} fill="#cfc4ff" anchor="middle">
        SET UP ONCE (shmget)
      </Text>
      <Text x={44} y={78} size={3} fill="#9ad8e0" anchor="middle">
        NO KERNEL PER ACCESS
      </Text>
    </>
  );
}

/* ---- CPU scheduling: every chart is the simulator's own output ---- */

const jobs = (...js: [string, number, number][]): Job[] => js.map(([name, arrival, burst]) => ({ name, arrival, burst }));
/** an average to at most two decimals, the way the lessons write it */
const avgText = (n: number) => String(Math.round(n * 100) / 100);

/** The charts each scheduling diagram draws, exported so tests can check them. */
export const SCHEDULING_EXAMPLES = {
  convoy: fcfs(jobs(["P1", 0, 24], ["P2", 0, 3], ["P3", 0, 3])),
  shortFirst: fcfs(jobs(["P2", 0, 3], ["P3", 0, 3], ["P1", 0, 24])),
  sjf: sjf(jobs(["P1", 0, 6], ["P2", 0, 8], ["P3", 0, 7], ["P4", 0, 3])),
  srtf: srtf(jobs(["P1", 0, 8], ["P2", 1, 4], ["P3", 2, 9], ["P4", 3, 5])),
  priority: priority([
    { name: "P1", arrival: 0, burst: 10, priority: 3 },
    { name: "P2", arrival: 0, burst: 1, priority: 1 },
    { name: "P3", arrival: 0, burst: 2, priority: 4 },
    { name: "P4", arrival: 0, burst: 1, priority: 5 },
    { name: "P5", arrival: 0, burst: 5, priority: 2 },
  ]),
  starve: priority([
    { name: "H1", arrival: 0, burst: 4, priority: 1 },
    { name: "L", arrival: 0, burst: 2, priority: 5 },
    { name: "H2", arrival: 4, burst: 8, priority: 1 },
  ]),
  aged: priority(
    [
      { name: "H1", arrival: 0, burst: 4, priority: 1 },
      { name: "L", arrival: 0, burst: 2, priority: 5 },
      { name: "H2", arrival: 4, burst: 8, priority: 1 },
    ],
    { aging: 1 },
  ),
  rr4: roundRobin(jobs(["P1", 0, 24], ["P2", 0, 3], ["P3", 0, 3]), 4),
  rrBig: roundRobin(jobs(["P1", 0, 24], ["P2", 0, 3], ["P3", 0, 3]), 30),
  mlfq: mlfq(jobs(["A", 0, 30], ["B", 10, 4], ["C", 12, 20]), [8, 16, Infinity]),
} satisfies Record<string, Schedule>;

/** Number of context switches in a chart: changes from one process to another. */
export const switches = (s: Schedule) => s.gantt.filter((b) => b.name !== null).length - 1;

/** The Clocktower's dusk: a warm brown sky with faint gear-tooth specks. */
function Dusk({ seed = 0 }: { seed?: number }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#2a1c24" />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={(i * 37 + seed * 11) % W} y={(i * 23 + seed * 5) % H} width={1} height={1} fill="#5a3a3a" />
      ))}
    </>
  );
}

/** A captioned chart row: a label above, the chart, and a gold note on the right of the label. */
function ChartRow({ y, label, note, s, ink = "#ffe27a" }: { y: number; label: string; note: string; s: Schedule; ink?: string }) {
  return (
    <>
      <Text x={6} y={y} size={4} fill="#f8f4e6">
        {label}
      </Text>
      <Text x={W - 6} y={y} size={4} fill={ink} anchor="end">
        {note}
      </Text>
      <GanttRows gantt={s.gantt} x={6} y={y + 3} width={W - 12} />
    </>
  );
}

function Fcfs() {
  const { convoy, shortFirst } = SCHEDULING_EXAMPLES;
  return (
    <>
      <Dusk />
      <Text x={W / 2} y={9} size={4.5} fill="#ffe27a" anchor="middle">
        FIRST COME, FIRST SERVED
      </Text>
      <ChartRow y={22} label="P1 FIRST" note={`AVG WAIT ${avgText(convoy.avgWaiting)}`} s={convoy} ink="#f87a8a" />
      <ChartRow y={58} label="P1 LAST" note={`AVG WAIT ${avgText(shortFirst.avgWaiting)}`} s={shortFirst} ink="#7cf0c8" />
      <Text x={W / 2} y={98} size={3.5} fill="#e0a030" anchor="middle">
        CONVOY: SHORT JOBS STUCK
      </Text>
      <Text x={W / 2} y={105} size={3.5} fill="#e0a030" anchor="middle">
        BEHIND ONE LONG JOB
      </Text>
    </>
  );
}

function SjfSrtf() {
  const { sjf: a, srtf: b } = SCHEDULING_EXAMPLES;
  return (
    <>
      <Dusk seed={1} />
      <Text x={W / 2} y={9} size={4.5} fill="#ffe27a" anchor="middle">
        SHORTEST JOB FIRST
      </Text>
      <ChartRow y={22} label="SJF ALL AT 0" note={`AVG WAIT ${avgText(a.avgWaiting)}`} s={a} />
      <ChartRow y={58} label="SRTF ARRIVE 0,1,2,3" note={`AVG WAIT ${avgText(b.avgWaiting)}`} s={b} />
      <Text x={W / 2} y={98} size={3.5} fill="#e0a030" anchor="middle">
        SRTF: A SHORTER ARRIVAL
      </Text>
      <Text x={W / 2} y={105} size={3.5} fill="#e0a030" anchor="middle">
        PREEMPTS THE RUNNING JOB
      </Text>
    </>
  );
}

function Priority() {
  const { priority: p, starve, aged } = SCHEDULING_EXAMPLES;
  return (
    <>
      <Dusk seed={2} />
      <ChartRow y={8} label="PRIORITY (1 = HIGH)" note={`AVG WAIT ${avgText(p.avgWaiting)}`} s={p} />
      <ChartRow y={42} label="NO AGING" note={`L WAITS ${starve.waiting[1]}`} s={starve} ink="#f87a8a" />
      <ChartRow y={76} label="AGING" note={`L WAITS ${aged.waiting[1]}`} s={aged} ink="#7cf0c8" />
      <Text x={W / 2} y={109} size={3.5} fill="#e0a030" anchor="middle">
        WAITING RAISES PRIORITY
      </Text>
    </>
  );
}

function RoundRobin() {
  const { rr4, rrBig } = SCHEDULING_EXAMPLES;
  return (
    <>
      <Dusk seed={3} />
      <Text x={W / 2} y={9} size={4.5} fill="#ffe27a" anchor="middle">
        ROUND ROBIN
      </Text>
      <ChartRow y={22} label="QUANTUM 4" note={`${switches(rr4)} SWITCHES`} s={rr4} />
      <ChartRow y={58} label="QUANTUM 30" note={`${switches(rrBig)} SWITCHES`} s={rrBig} ink="#f87a8a" />
      <Text x={W / 2} y={98} size={3.5} fill="#e0a030" anchor="middle">
        TOO BIG A QUANTUM IS FCFS
      </Text>
      <Text x={W / 2} y={105} size={3.5} fill="#e0a030" anchor="middle">
        TOO SMALL IS ALL SWITCHING
      </Text>
    </>
  );
}

function Mlfq() {
  const queues: [string, string, Ramp][] = [
    ["Q0", "QUANTUM 8", GOLD],
    ["Q1", "QUANTUM 16", TEAL],
    ["Q2", "FCFS", PURPLE],
  ];
  return (
    <>
      <Dusk seed={4} />
      {queues.map(([q, rule, r], i) => (
        <g key={q}>
          <Card x={6 + i * 60} y={4} w={48} h={20} lines={[q, rule]} size={4} ramp={r} ink={i === 0 ? INK : "#f8f4e6"} />
          {i < 2 && <Arrow x1={55 + i * 60} y1={14} x2={65 + i * 60} y2={14} color="#f87a8a" />}
        </g>
      ))}
      <Text x={W / 2} y={33} size={3.5} fill="#f87a8a" anchor="middle">
        USE YOUR WHOLE QUANTUM: DROP A QUEUE
      </Text>
      <ChartRow y={46} label="A 30, B 4 AT 10, C 20 AT 12" note="" s={SCHEDULING_EXAMPLES.mlfq} />
      <Text x={W / 2} y={82} size={3.5} fill="#e0a030" anchor="middle">
        NEW JOBS START IN Q0 AND
      </Text>
      <Text x={W / 2} y={89} size={3.5} fill="#e0a030" anchor="middle">
        PREEMPT LOWER QUEUES
      </Text>
      <Text x={W / 2} y={101} size={3.5} fill="#7cf0c8" anchor="middle">
        SHORT JOBS FINISH FAST
      </Text>
    </>
  );
}

/* ---- synchronization: the Mutex Marsh ---- */

const PINK: Ramp = ["#6a1a52", "#a02a7c", "#e05aa8"];

/** The simulator runs behind the sync diagrams, exported so tests can check them. */
export const SYNC_EXAMPLES = {
  /** Silberschatz §6.1's interleaving T0–T5: counter ends at 4, not 5 */
  race: runSchedule({ counter: 5 }, RACE_THREADS, [0, 0, 1, 1, 0, 1]),
  /** a counting semaphore of 3, five wait()s: three get in, two queue */
  semaphore: runSemaphore(3, ["T1", "T2", "T3", "T4", "T5"].map((who) => ({ op: "wait" as const, who }))),
};

/** The marsh at night: deep plum water with reed-tip specks. */
function Marsh({ seed = 0 }: { seed?: number }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#24142c" />
      {Array.from({ length: 34 }, (_, i) => (
        <rect key={i} x={(i * 43 + seed * 17) % W} y={(i * 31 + seed * 3) % H} width={1} height={i % 3 ? 1 : 2} fill="#4a2a52" />
      ))}
    </>
  );
}

/** A small thread chip (like the process token) in a ramp. */
function Chip({ x, y, label, ramp = GREEN, w = 14 }: { x: number; y: number; label: string; ramp?: Ramp; w?: number }) {
  return <Card x={x} y={y} w={w} h={9} lines={[label]} size={3} ramp={ramp} ink="#f8f4e6" />;
}

/** Two thread lanes and the shared counter between them, one row per machine step. */
function Race() {
  const { steps } = SYNC_EXAMPLES.race;
  const lanes = [
    { x: 2, ramp: TEAL },
    { x: 116, ramp: PURPLE },
  ];
  return (
    <>
      <Marsh />
      {RACE_THREADS.map((t, i) => (
        <Text key={t.name} x={lanes[i].x + 31} y={7} size={4} fill="#ffe27a" anchor="middle">
          {`${t.name} ${t.code[1].op === "add" && t.code[1].k < 0 ? "c--" : "c++"}`}
        </Text>
      ))}
      <Text x={90} y={7} size={4} fill="#f8f4e6" anchor="middle">
        COUNTER
      </Text>
      {steps.map((s, r) => {
        const y = 11 + r * 13;
        const lane = lanes[s.thread];
        const stored = s.instr.op === "store";
        return (
          <g key={r}>
            <Card x={lane.x} y={y} w={62} h={11} lines={[`T${r} ${instrText(s.instr).replace("counter", "cnt")}  {${s.value}}`]} size={3} ramp={lane.ramp} ink="#f8f4e6" />
            <Card x={76} y={y + 1} w={28} h={9} lines={[String(s.shared.counter)]} size={3.5} ramp={stored ? GOLD : STONE} ink={stored ? INK : "#f8f4e6"} />
            {stored && <Arrow x1={s.thread ? 115 : 65} y1={y + 5} x2={s.thread ? 105 : 75} y2={y + 5} color="#ffe27a" />}
          </g>
        );
      })}
      <Text x={90} y={98} size={3.5} fill="#f87a8a" anchor="middle">
        {`EXPECTED 5 · GOT ${SYNC_EXAMPLES.race.shared.counter}`}
      </Text>
      <Text x={90} y={107} size={3} fill="#cfc4ff" anchor="middle">
        THE PRODUCER&apos;S STORE WAS OVERWRITTEN
      </Text>
    </>
  );
}

/** Peterson's entry/exit code for P0 and P1, and the shared flags and turn when both want in. */
function Peterson() {
  const code = (i: number) => {
    const j = 1 - i;
    return [
      [`flag[${i}] = true;`, "#f8f4e6"],
      [`turn = ${j};`, "#f8f4e6"],
      [`while (flag[${j}] &&`, "#cfc4ff"],
      [`turn == ${j});`, "#cfc4ff"],
      ["CRITICAL SECTION", "#ffe27a"],
      [`flag[${i}] = false;`, "#f8f4e6"],
    ] as const;
  };
  return (
    <>
      <Marsh seed={2} />
      {[0, 1].map((i) => {
        const x = 4 + i * 90;
        return (
          <g key={i}>
            <Block x={x} y={3} w={82} h={56} ramp={i ? PURPLE : TEAL}>
              <Text x={x + 41} y={10} size={4} fill="#ffe27a" anchor="middle">
                {`P${i}`}
              </Text>
              {code(i).map(([l, c], k) => (
                <Text key={k} x={x + (k === 3 ? 23 : 5)} y={18 + k * 7} size={3} fill={c}>
                  {l}
                </Text>
              ))}
            </Block>
          </g>
        );
      })}
      {/* the shared variables, as they stand when both want in and P1 wrote turn last */}
      <Text x={90} y={67} size={3.5} fill="#f8f4e6" anchor="middle">
        SHARED · BOTH WANT IN
      </Text>
      <Card x={14} y={71} w={42} h={13} lines={["flag[0] = T"]} size={3} ramp={GOLD} />
      <Card x={69} y={71} w={42} h={13} lines={["flag[1] = T"]} size={3} ramp={GOLD} />
      <Card x={124} y={71} w={42} h={13} lines={["turn = 0"]} size={3} ramp={PINK} ink="#f8f4e6" />
      <Text x={90} y={95} size={3.5} fill="#7cf0c8" anchor="middle">
        P1 WROTE turn LAST, SO P1 WAITS
      </Text>
      <Text x={90} y={104} size={3.5} fill="#ffe27a" anchor="middle">
        P0 ENTERS
      </Text>
    </>
  );
}

/** A counting semaphore as a gate: three threads inside the resource room, two queued outside. */
function Semaphore() {
  const { value, blocked } = SYNC_EXAMPLES.semaphore;
  const inside = ["T1", "T2", "T3", "T4", "T5"].filter((t) => !blocked.includes(t));
  return (
    <>
      <Marsh seed={4} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">
        S STARTS AT 3 · FIVE wait()s
      </Text>
      {/* the queue of blocked threads, left */}
      <Block x={4} y={16} w={50} h={54} ramp={STONE}>
        <Text x={29} y={23} size={3.5} fill="#f8f4e6" anchor="middle">
          S QUEUE
        </Text>
      </Block>
      {blocked.map((t, i) => (
        <Chip key={t} x={10 + i * 20} y={30} label={t} ramp={PURPLE} />
      ))}
      <Text x={29} y={52} size={3} fill="#cfc4ff" anchor="middle">
        ASLEEP, NOT
      </Text>
      <Text x={29} y={58} size={3} fill="#cfc4ff" anchor="middle">
        SPINNING
      </Text>
      {/* the gate and its counter */}
      <rect x={60} y={14} width={8} height={58} fill={INK} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={61} y={16 + i * 9} width={6} height={7} fill={PINK[i % 2 ? 0 : 1]} />
      ))}
      <Card x={73} y={18} w={30} h={20} lines={["S =", String(value)]} size={4} ramp={GOLD} />
      {/* wait(): in while S stays ≥ 0, otherwise asleep on the queue */}
      <Arrow x1={72} y1={51} x2={107} y2={51} color="#7cf0c8" />
      <Text x={88} y={48} size={3} fill="#7cf0c8" anchor="middle">
        S &gt;= 0: IN
      </Text>
      <Arrow x1={104} y1={63} x2={55} y2={63} color="#cfc4ff" />
      <Text x={88} y={70} size={3} fill="#cfc4ff" anchor="middle">
        S &lt; 0: SLEEP
      </Text>
      {/* the resource room, right */}
      <Block x={108} y={16} w={68} h={54} ramp={GREEN}>
        <Text x={142} y={23} size={3.5} fill="#f8f4e6" anchor="middle">
          3 RESOURCES
        </Text>
      </Block>
      {inside.map((t, i) => (
        <Chip key={t} x={113 + i * 20} y={32} label={t} ramp={TEAL} />
      ))}
      <Arrow x1={142} y1={50} x2={142} y2={66} color="#ffe27a" />
      <Text x={146} y={60} size={3} fill="#ffe27a">
        signal()
      </Text>
      <Text x={90} y={84} size={3.5} fill="#f8f4e6" anchor="middle">
        {`S < 0: ${-value} ARE WAITING`}
      </Text>
      <Text x={90} y={94} size={3} fill="#cfc4ff" anchor="middle">
        signal() ADDS 1 AND WAKES ONE WAITER
      </Text>
      <Text x={90} y={104} size={3} fill="#9ad8e0" anchor="middle">
        A MUTEX IS A LOCK WITH AN OWNER
      </Text>
    </>
  );
}

/** A monitor: an entry queue, one active thread inside, and condition-variable queues. */
function Monitor() {
  return (
    <>
      <Marsh seed={6} />
      {/* entry queue */}
      <Text x={20} y={30} size={3} fill="#f8f4e6" anchor="middle">
        ENTRY
      </Text>
      <Text x={20} y={35} size={3} fill="#f8f4e6" anchor="middle">
        QUEUE
      </Text>
      {["T4", "T5", "T6"].map((t, i) => (
        <Chip key={t} x={13} y={40 + i * 11} label={t} ramp={STONE} />
      ))}
      <Arrow x1={30} y1={56} x2={46} y2={56} />
      {/* the monitor */}
      <Block x={46} y={18} w={84} h={80} ramp={PINK}>
        <Text x={88} y={26} size={4} fill="#ffe27a" anchor="middle">
          MONITOR
        </Text>
      </Block>
      <Card x={52} y={30} w={72} h={12} lines={["SHARED DATA"]} size={3.5} ramp={GOLD} />
      <Card x={52} y={45} w={72} h={22} lines={["insert()", "remove()"]} size={3.5} ramp={CREAM} />
      <Chip x={74} y={72} label="T1" ramp={GREEN} w={28} />
      <Text x={88} y={92} size={3} fill="#f8f4e6" anchor="middle">
        ONE ACTIVE INSIDE
      </Text>
      {/* condition queues */}
      {[
        ["x", ["T2"], 20],
        ["y", ["T3"], 58],
      ].map(([name, ts, y]) => (
        <g key={name as string}>
          <Text x={156} y={(y as number) - 3} size={3.5} fill="#cfc4ff" anchor="middle">
            {`COND ${name}`}
          </Text>
          <Block x={136} y={y as number} w={40} h={16} ramp={PURPLE} />
          {(ts as string[]).map((t, i) => (
            <Chip key={t} x={142 + i * 16} y={(y as number) + 4} label={t} ramp={STONE} />
          ))}
        </g>
      ))}
      <Text x={156} y={46} size={3} fill="#7cf0c8" anchor="middle">
        x.wait()
      </Text>
      <Text x={156} y={84} size={3} fill="#7cf0c8" anchor="middle">
        x.signal()
      </Text>
      <Text x={156} y={90} size={3} fill="#7cf0c8" anchor="middle">
        WAKES ONE
      </Text>
      <Text x={90} y={108} size={3.5} fill="#ffe27a" anchor="middle">
        NOBODY WAITING: SIGNAL DOES NOTHING
      </Text>
    </>
  );
}

/** A filled pixel disc of radius r centred on (cx, cy). */
function Disc({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return (
    <g>
      {Array.from({ length: 2 * r + 1 }, (_, k) => {
        const dy = k - r;
        const half = Math.round(Math.sqrt(r * r - dy * dy));
        return <rect key={k} x={cx - half} y={cy + dy} width={half * 2} height={1} fill={fill} />;
      })}
    </g>
  );
}

/** Five philosophers round a table, each holding the left chopstick: a deadlock. */
function Philosophers() {
  const cx = 52;
  const cy = 56;
  const at = (k: number, r: number) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))] as const;
  };
  return (
    <>
      <Marsh seed={8} />
      <Disc cx={cx} cy={cy} r={31} fill={INK} />
      <Disc cx={cx} cy={cy} r={30} fill="#6a3a1a" />
      <Disc cx={cx} cy={cy - 1} r={27} fill="#8a5a2a" />
      {/* the rice bowl */}
      <Disc cx={cx} cy={cy + 1} r={8} fill={INK} />
      <Disc cx={cx} cy={cy + 1} r={7} fill="#c8c0b0" />
      <Disc cx={cx} cy={cy - 1} r={5} fill="#ffffff" />
      {[0, 1, 2, 3, 4].map((k) => {
        const [px, py] = at(k, 42);
        // philosopher k's left chopstick sits between k and k+1 (clockwise); it is drawn next to its holder
        const [sx, sy] = at(k + 0.24, 34);
        return (
          <g key={k}>
            <Block x={px - 7} y={py - 6} w={14} h={12} ramp={k % 2 ? PURPLE : TEAL}>
              <rect x={px - 4} y={py - 2} width={2} height={2} fill={INK} />
              <rect x={px + 2} y={py - 2} width={2} height={2} fill={INK} />
              <rect x={px - 2} y={py + 2} width={4} height={1} fill={INK} />
            </Block>
            <Text x={px} y={py + 11} size={3} fill="#f8f4e6" anchor="middle">
              {`P${k}`}
            </Text>
            <rect x={sx - 1.5} y={sy - 5.5} width={3} height={11} fill={INK} />
            <rect x={sx - 0.5} y={sy - 4.5} width={1} height={9} fill={GOLD[2]} />
          </g>
        );
      })}
      <Text x={52} y={109} size={3} fill="#f87a8a" anchor="middle">
        ALL HOLD LEFT · NONE CAN EAT
      </Text>
      <Text x={141} y={10} size={4} fill="#ffe27a" anchor="middle">
        FIXES
      </Text>
      <Card x={106} y={15} w={70} h={18} lines={["AT MOST FOUR", "AT THE TABLE"]} size={3.5} ramp={GREEN} ink="#f8f4e6" />
      <Card x={106} y={37} w={70} h={18} lines={["BOTH STICKS", "OR NONE"]} size={3.5} ramp={GREEN} ink="#f8f4e6" />
      <Card x={106} y={59} w={70} h={18} lines={["ODD: LEFT FIRST", "EVEN: RIGHT FIRST"]} size={3.5} ramp={GREEN} ink="#f8f4e6" />
      <Text x={141} y={88} size={3} fill="#cfc4ff" anchor="middle">
        NO DEADLOCK, BUT
      </Text>
      <Text x={141} y={94} size={3} fill="#cfc4ff" anchor="middle">
        ONE CAN STILL STARVE
      </Text>
    </>
  );
}

const RAG_EDGES = [["P1", "R1"], ["R1", "P2"], ["P2", "R2"], ["R2", "P1"]] as const;

/** A resource-allocation graph with a cycle (deadlock), beside the four Coffman conditions. */
function Rag() {
  const cycle = findCycle(RAG_EDGES);
  const proc = (cx: number, cy: number, name: string, ramp: Ramp) => (
    <g>
      <Disc cx={cx} cy={cy} r={9} fill={INK} />
      <Disc cx={cx} cy={cy} r={8} fill={ramp[1]} />
      <Disc cx={cx} cy={cy - 1} r={6} fill={ramp[2]} />
      <Text x={cx} y={cy + 2} size={5} fill={INK} anchor="middle">
        {name}
      </Text>
    </g>
  );
  const res = (cx: number, cy: number, name: string) => (
    <Block x={cx - 9} y={cy - 9} w={18} h={18} ramp={GOLD}>
      <Text x={cx} y={cy - 1} size={4} fill={INK} anchor="middle">
        {name}
      </Text>
      <rect x={cx - 3} y={cy + 3} width={2} height={2} fill={INK} />
    </Block>
  );
  return (
    <>
      <Marsh seed={9} />
      {/* P1 -> R1 and P2 -> R2 are requests; R1 -> P2 and R2 -> P1 are assignments */}
      <Arrow x1={32} y1={24} x2={62} y2={24} color="#f87a8a" />
      <Arrow x1={74} y1={36} x2={74} y2={64} color="#7cc24f" />
      <Arrow x1={64} y1={76} x2={34} y2={76} color="#f87a8a" />
      <Arrow x1={22} y1={64} x2={22} y2={36} color="#7cc24f" />
      {proc(22, 24, "P1", TEAL)}
      {res(74, 24, "R1")}
      {proc(74, 76, "P2", PURPLE)}
      {res(22, 76, "R2")}
      <Text x={48} y={20} size={3} fill="#f87a8a" anchor="middle">
        WANTS
      </Text>
      <Text x={48} y={72} size={3} fill="#f87a8a" anchor="middle">
        WANTS
      </Text>
      <Text x={80} y={52} size={3} fill="#7cc24f">
        HELD
      </Text>
      <Text x={17} y={52} size={3} fill="#7cc24f" anchor="end">
        HELD
      </Text>
      <Text x={48} y={98} size={3} fill="#ffe27a" anchor="middle">
        {`CYCLE ${cycle!.slice(0, -1).join(" ")}`}
      </Text>
      <Text x={48} y={105} size={3} fill="#ffe27a" anchor="middle">
        ONE INSTANCE EACH: DEADLOCK
      </Text>
      <Text x={142} y={10} size={4} fill="#ffe27a" anchor="middle">
        ALL FOUR NEEDED
      </Text>
      <Card x={106} y={15} w={72} h={17} lines={["MUTUAL EXCLUSION", "ONE USER AT A TIME"]} size={3} ramp={TEAL} ink="#f8f4e6" />
      <Card x={106} y={36} w={72} h={17} lines={["HOLD AND WAIT", "KEEP ONE, WANT MORE"]} size={3} ramp={PURPLE} ink="#f8f4e6" />
      <Card x={106} y={57} w={72} h={17} lines={["NO PREEMPTION", "ONLY THE HOLDER FREES"]} size={3} ramp={PINK} ink="#f8f4e6" />
      <Card x={106} y={78} w={72} h={17} lines={["CIRCULAR WAIT", "P1 > P2 > ... > P1"]} size={3} ramp={RED} ink="#f8f4e6" />
    </>
  );
}

/** Silberschatz's Banker's example: allocation, max, need and the safe sequence. */
function Banker() {
  const s = BANKER_EXAMPLE;
  const nd = need(s);
  const r = safety(s);
  const cols = [
    ["ALLOC", s.allocation, 52],
    ["MAX", s.max, 86],
    ["NEED", nd, 120],
  ] as const;
  return (
    <>
      <Marsh seed={10} />
      <Text x={4} y={9} size={3.5} fill="#cfc4ff">
        A B C = 10 5 7 INSTANCES
      </Text>
      <Text x={176} y={9} size={3.5} fill="#7cf0c8" anchor="end">
        {`AVAILABLE ${s.available.join(" ")}`}
      </Text>
      {cols.map(([h, , x]) => (
        <Text key={h} x={x + 12} y={19} size={3.5} fill="#ffe27a" anchor="middle">
          {h}
        </Text>
      ))}
      {s.allocation.map((_, i) => (
        <g key={i}>
          <Card x={4} y={22 + i * 11} w={16} h={9} lines={[`P${i}`]} size={3} ramp={i % 2 ? PURPLE : TEAL} ink="#f8f4e6" />
          {cols.map(([h, m, x]) => (
            <Text key={h} x={x} y={29 + i * 11} size={3.5} fill={h === "NEED" ? "#f8f4e6" : "#cfc4ff"}>
              {m[i].join("  ")}
            </Text>
          ))}
        </g>
      ))}
      <Text x={90} y={86} size={3.5} fill="#f8f4e6" anchor="middle">
        SAFE SEQUENCE: FINISHERS FREE THEIR ALLOCATION
      </Text>
      {r.sequence.map((p, k) => (
        <g key={k}>
          <Card x={14 + k * 29} y={90} w={18} h={9} lines={[`P${p}`]} size={3.5} ramp={GREEN} ink="#f8f4e6" />
          {k < r.sequence.length - 1 && <Text x={34 + k * 29} y={97} size={4} fill="#ffe27a">{">"}</Text>}
          <Text x={23 + k * 29} y={106} size={3} fill="#7cf0c8" anchor="middle">
            {r.work[k].join(" ")}
          </Text>
        </g>
      ))}
    </>
  );
}

/* ---- memory management: the Heap Harbor ---- */

/** The harbor at dusk: deep blue water with wave glints. */
function Harbor({ seed = 0 }: { seed?: number }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#10244a" />
      {Array.from({ length: 34 }, (_, i) => (
        <rect key={i} x={(i * 43 + seed * 17) % W} y={(i * 31 + seed * 5) % H} width={i % 3 ? 2 : 3} height={1} fill="#1f3f72" />
      ))}
    </>
  );
}

export const PAGING_EXAMPLE = translate(13, 4, PAGING_TABLE);

const FIT_ROWS = (["first", "best", "worst"] as const).map((fit) => {
  const r = allocate(FIT_EXAMPLE.holes, [FIT_EXAMPLE.requests[0]], fit);
  const hole = r.placements[0].hole!;
  return { fit, hole, left: FIT_EXAMPLE.holes[hole].size - FIT_EXAMPLE.requests[0] };
});

/** Silberschatz's free list and one 212K request placed by first, best and worst fit. */
function Fit() {
  const names = { first: "FIRST FIT: FIRST BIG ENOUGH", best: "BEST FIT: SMALLEST BIG ENOUGH", worst: "WORST FIT: LARGEST HOLE" };
  return (
    <>
      <Harbor seed={11} />
      <Text x={4} y={8} size={4} fill="#ffe27a">
        {`FREE HOLES (K)    REQUEST ${FIT_EXAMPLE.requests[0]}K`}
      </Text>
      {FIT_EXAMPLE.holes.map((h, i) => (
        <Card key={i} x={5 + i * 35} y={11} w={31} h={14} lines={[`${h.size}K`]} size={4} ramp={BLUE} ink="#f8f4e6" />
      ))}
      {FIT_ROWS.map((r, k) => (
        <g key={r.fit}>
          <Text x={4} y={37 + k * 24} size={3.5} fill="#cfe4ff">
            {names[r.fit]}
          </Text>
          <Card x={5 + r.hole * 35} y={40 + k * 24} w={31} h={16} lines={["LEFT", `${r.left}K`]} size={3.5} ramp={GREEN} ink="#f8f4e6" />
        </g>
      ))}
    </>
  );
}

const FRAG_STRIP: [string, number, boolean][] = [["OS", 12, true], ["P1", 30, true], ["", 20, false], ["P2", 24, true], ["", 14, false], ["P3", 22, true], ["", 26, false], ["P4", 20, true]];
const FRAG_HOLES = (() => {
  const holes: { start: number; size: number }[] = [];
  let at = 0;
  for (const [, w, used] of FRAG_STRIP) {
    if (!used) holes.push({ start: at, size: w });
    at += w;
  }
  return holes;
})();
export const FRAG_EXAMPLE = {
  external: externalFragmentation(FRAG_HOLES, 50),
  internal: pagesFor(72766, 2048),
};

/** External fragmentation in a memory strip, and internal fragmentation in a last page. */
function Frag() {
  const ext = FRAG_EXAMPLE.external;
  const int = FRAG_EXAMPLE.internal;
  const usedFrac = int.lastUsed / 2048;
  return (
    <>
      <Harbor seed={12} />
      <Text x={4} y={8} size={4} fill="#ffe27a">
        EXTERNAL: HOLES TOO SMALL
      </Text>
      {FRAG_STRIP.map(([name, w, used], i) => {
        const bx = 6 + FRAG_STRIP.slice(0, i).reduce((a, [, n]) => a + n, 0);
        return used ? (
          <Card key={i} x={bx} y={12} w={w} h={16} lines={[name]} size={3.5} ramp={i % 2 ? PURPLE : TEAL} ink="#f8f4e6" />
        ) : (
          <Card key={i} x={bx} y={12} w={w} h={16} lines={[`${w}K`]} size={3.5} ramp={RED} ink="#f8f4e6" />
        );
      })}
      <Text x={90} y={37} size={3.5} fill="#f8f4e6" anchor="middle">
        {`NEED ${50}K. FREE ${ext.free}K, BUT LARGEST HOLE ${ext.largest}K`}
      </Text>
      <Text x={90} y={44} size={3.5} fill="#f87a8a" anchor="middle">
        {ext.fits ? "FITS" : "CANNOT FIT: COMPACT, OR PAGE"}
      </Text>
      <Text x={4} y={60} size={4} fill="#ffe27a">
        INTERNAL: WASTE IN THE LAST PAGE
      </Text>
      <Card x={6} y={64} w={26} h={16} lines={["PAGE 0", "2048 B"]} size={3} ramp={TEAL} ink="#f8f4e6" />
      <Card x={36} y={64} w={26} h={16} lines={["...", "1-34"]} size={3} ramp={TEAL} ink="#f8f4e6" />
      <Block x={66} y={64} w={50} h={16} ramp={RED}>
        <rect x={67} y={65} width={Math.round(48 * usedFrac)} height={14} fill={TEAL[1]} />
        <rect x={67} y={65} width={Math.round(48 * usedFrac)} height={1} fill={TEAL[2]} />
        <Text x={69} y={74} size={3} fill="#f8f4e6">
          {`PG ${int.pages - 1}`}
        </Text>
      </Block>
      <Text x={120} y={69} size={3} fill="#7cf0c8">
        {`USED ${int.lastUsed} B`}
      </Text>
      <Text x={120} y={77} size={3} fill="#f87a8a">
        {`WASTED ${int.internalFragmentation} B`}
      </Text>
      <Text x={90} y={94} size={3.5} fill="#f8f4e6" anchor="middle">
        {`72,766 B / 2,048 B = ${int.pages} PAGES`}
      </Text>
      <Text x={90} y={102} size={3.5} fill="#cfe4ff" anchor="middle">
        ON AVERAGE HALF A PAGE IS WASTED PER PROCESS
      </Text>
    </>
  );
}

/** Figure 9.10: logical pages, the page table and physical frames; logical 13 → physical 9. */
function Paging() {
  const t = PAGING_EXAMPLE;
  return (
    <>
      <Harbor seed={13} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        LOGICAL
      </Text>
      <Text x={66} y={8} size={3.5} fill="#ffe27a" anchor="middle">
        PAGE TABLE
      </Text>
      <Text x={176} y={8} size={3.5} fill="#ffe27a" anchor="end">
        PHYSICAL MEMORY
      </Text>
      {PAGING_TABLE.map((f, p) => {
        const hot = p === t.page;
        return (
          <g key={p}>
            <Card x={5} y={13 + p * 18} w={34} h={15} lines={[`PAGE ${p}`, `${p * 4}-${p * 4 + 3}`]} size={3} ramp={hot ? GOLD : PURPLE} ink={hot ? INK : "#f8f4e6"} />
            <Card x={52} y={13 + p * 18} w={28} h={15} lines={[`${p} > F${f}`]} size={3.5} ramp={hot ? GOLD : TEAL} ink={hot ? INK : "#f8f4e6"} />
          </g>
        );
      })}
      {Array.from({ length: 8 }, (_, f) => {
        const page = PAGING_TABLE.indexOf(f);
        const hot = f === t.frame;
        return <Card key={f} x={118} y={12 + f * 10} w={58} h={9} lines={[page < 0 ? `F${f}  FREE` : `F${f}  PAGE ${page}`]} size={3} ramp={hot ? GOLD : page < 0 ? STONE : BLUE} ink={hot ? INK : "#f8f4e6"} />;
      })}
      <Arrow x1={40} y1={13 + t.page * 18 + 7} x2={51} y2={13 + t.page * 18 + 7} color="#ffe27a" />
      <Arrow x1={81} y1={13 + t.page * 18 + 7} x2={117} y2={13 + t.page * 18 + 7} color="#ffe27a" />
      <Text x={90} y={98} size={3.5} fill="#f8f4e6" anchor="middle">
        {`LOGICAL 13 = PAGE ${t.page}, OFFSET ${t.offset}. PAGE ${t.page} IS IN FRAME ${t.frame}`}
      </Text>
      <Text x={90} y={106} size={3.5} fill="#7cf0c8" anchor="middle">
        {`PHYSICAL = ${t.frame} x 4 + ${t.offset} = ${t.physical}`}
      </Text>
    </>
  );
}

const PT_SPLIT = splitAddress(32, 4096, 2, 4);
const INVERTED_TABLE = [{ pid: 1, page: 0 }, { pid: 2, page: 5 }, { pid: 1, page: 3 }, { pid: 3, page: 1 }, { pid: 2, page: 0 }, { pid: 1, page: 7 }];
export const PTABLE_EXAMPLE = {
  split: PT_SPLIT,
  flatBytes: pageTableBytes(32, 4096, 4),
  inverted: invertedLookup(INVERTED_TABLE, 1, 3),
};

/** A 10+10+12 two-level split with the walk it drives, and an inverted page table search. */
function PageTables() {
  const bits = PT_SPLIT.levels;
  const unit = 160 / 32;
  const labels = [`P1  ${bits[0]}`, `P2  ${bits[1]}`, `OFFSET  ${PT_SPLIT.offset}`];
  const widths = [bits[0], bits[1], PT_SPLIT.offset];
  const inv = PTABLE_EXAMPLE.inverted;
  return (
    <>
      <Harbor seed={14} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        32-BIT ADDRESS, 4 KB PAGES, 4-BYTE ENTRIES
      </Text>
      {widths.map((w, i) => {
        const bx = 10 + widths.slice(0, i).reduce((a, n) => a + n, 0) * unit;
        return <Card key={i} x={bx} y={11} w={w * unit} h={12} lines={[labels[i]]} size={3.5} ramp={[PURPLE, TEAL, GOLD][i]} ink={i === 2 ? INK : "#f8f4e6"} />;
      })}
      <Card x={8} y={30} w={44} h={16} lines={["OUTER TABLE", `${2 ** bits[0]} ENTRIES`]} size={3} ramp={PURPLE} ink="#f8f4e6" />
      <Arrow x1={53} y1={38} x2={65} y2={38} />
      <Card x={66} y={30} w={44} h={16} lines={["INNER TABLE", `${2 ** bits[1]} ENTRIES`]} size={3} ramp={TEAL} ink="#f8f4e6" />
      <Arrow x1={111} y1={38} x2={123} y2={38} />
      <Card x={124} y={30} w={48} h={16} lines={["FRAME + OFFSET", "= PHYSICAL"]} size={3} ramp={GOLD} />
      <Text x={90} y={55} size={3.5} fill="#f8f4e6" anchor="middle">
        {`ONE LEVEL: 2^${PT_SPLIT.pageNumber} ENTRIES = ${PTABLE_EXAMPLE.flatBytes / 2 ** 20} MB PER PROCESS`}
      </Text>
      <Text x={90} y={62} size={3.5} fill="#7cf0c8" anchor="middle">
        UNUSED INNER TABLES NEED NOT EXIST
      </Text>
      <Text x={4} y={74} size={4} fill="#ffe27a">
        INVERTED TABLE: ONE ENTRY PER FRAME
      </Text>
      {INVERTED_TABLE.map((e, i) => {
        const hot = i === inv.frame;
        return (
          <g key={i}>
            <Text x={20 + i * 28} y={83} size={3} fill={hot ? "#ffe27a" : "#cfe4ff"} anchor="middle">
              {`F${i}`}
            </Text>
            <Card x={6 + i * 28} y={85} w={26} h={11} lines={[`P${e.pid},${e.page}`]} size={3.5} ramp={hot ? GOLD : BLUE} ink={hot ? INK : "#f8f4e6"} />
          </g>
        );
      })}
      <Text x={90} y={106} size={3.5} fill="#f8f4e6" anchor="middle">
        {`SEARCH (PID 1, PAGE 3): FRAME ${inv.frame} AFTER ${inv.probes} PROBES`}
      </Text>
    </>
  );
}

export const TLB_EXAMPLE = {
  slow: effectiveAccessTime(0.8, 20, 100),
  fast: effectiveAccessTime(0.98, 20, 100),
};

/** CPU → TLB; a hit goes straight to memory, a miss reads the page table first. */
function Tlb() {
  return (
    <>
      <Harbor seed={15} />
      <Card x={4} y={28} w={26} h={20} lines={["CPU", "PAGE 3"]} size={3.5} ramp={PURPLE} ink="#f8f4e6" />
      <Arrow x1={31} y1={38} x2={43} y2={38} />
      <Block x={44} y={12} w={36} h={60} ramp={TEAL}>
        <Text x={62} y={20} size={4} fill="#f8f4e6" anchor="middle">
          TLB
        </Text>
        {[["PG", "FR"], ["0", "5"], ["3", "2"], ["7", "4"]].map(([p, f], i) => (
          <g key={i}>
            <Text x={50} y={30 + i * 9} size={3.5} fill={i === 2 ? "#ffe27a" : "#f8f4e6"}>
              {p}
            </Text>
            <Text x={74} y={30 + i * 9} size={3.5} fill={i === 2 ? "#ffe27a" : "#f8f4e6"} anchor="end">
              {f}
            </Text>
          </g>
        ))}
      </Block>
      <Text x={113} y={13} size={3.5} fill="#7cf0c8" anchor="middle">
        HIT: 120 NS
      </Text>
      <Arrow x1={81} y1={22} x2={96} y2={22} color="#7cc24f" />
      <Card x={97} y={15} w={32} h={14} lines={["FRAME 2"]} size={3.5} ramp={GREEN} ink="#f8f4e6" />
      <Arrow x1={130} y1={22} x2={146} y2={22} color="#7cc24f" />
      <Text x={113} y={44} size={3.5} fill="#f87a8a" anchor="middle">
        MISS: 220 NS
      </Text>
      <Arrow x1={81} y1={58} x2={96} y2={58} color="#f87a8a" />
      <Card x={94} y={49} w={38} h={18} lines={["PAGE TABLE", "IN MEMORY"]} size={3} ramp={RED} ink="#f8f4e6" />
      <Arrow x1={130} y1={58} x2={146} y2={58} color="#f87a8a" />
      <Block x={147} y={12} w={28} h={60} ramp={BLUE}>
        <Text x={161} y={44} size={4} fill="#f8f4e6" anchor="middle">
          RAM
        </Text>
      </Block>
      <Text x={90} y={84} size={3.5} fill="#f8f4e6" anchor="middle">
        EAT = H x 120 + (1 - H) x 220
      </Text>
      <Text x={90} y={93} size={3.5} fill="#ffe27a" anchor="middle">
        {`H = 80%: ${TLB_EXAMPLE.slow} NS      H = 98%: ${TLB_EXAMPLE.fast} NS`}
      </Text>
      <Text x={90} y={102} size={3} fill="#cfe4ff" anchor="middle">
        HIT = 20 + 100, MISS = 20 + 100 + 100
      </Text>
    </>
  );
}

export const SEGMENT_TRACES = [[2, 53], [3, 852], [0, 1222]].map(([s, d]) => ({ s, d, r: translateSegment(SEGMENT_EXAMPLE, s, d) }));

/** Figure 9.8's segment table and three (segment, offset) translations, one trapping. */
function Segments() {
  return (
    <>
      <Harbor seed={16} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        SEGMENT TABLE
      </Text>
      {["SEG", "LIMIT", "BASE"].map((h, i) => (
        <Text key={h} x={[17, 40, 66][i]} y={17} size={3} fill="#cfe4ff" anchor="middle">
          {h}
        </Text>
      ))}
      {SEGMENT_EXAMPLE.map((s, i) => {
        const hot = SEGMENT_TRACES.some((t) => t.s === i);
        return (
          <g key={i}>
            <Card x={5} y={20 + i * 12} w={24} h={10} lines={[`${i}`]} size={3.5} ramp={PURPLE} ink="#f8f4e6" />
            <Card x={30} y={20 + i * 12} w={20} h={10} lines={[`${s.limit}`]} size={3.5} ramp={hot ? TEAL : STONE} ink="#f8f4e6" />
            <Card x={51} y={20 + i * 12} w={26} h={10} lines={[`${s.base}`]} size={3.5} ramp={hot ? TEAL : STONE} ink="#f8f4e6" />
          </g>
        );
      })}
      {SEGMENT_TRACES.map(({ s, d, r }, i) => (
        <g key={i}>
          <Card x={86} y={14 + i * 24} w={90} h={21} lines={[`(${s}, ${d})`, r.ok ? `${d}<${SEGMENT_EXAMPLE[s].limit}: ${SEGMENT_EXAMPLE[s].base}+${d}=${r.physical}` : `${d}>=${SEGMENT_EXAMPLE[s].limit}: TRAP TO OS`]} size={3.5} ramp={r.ok ? GREEN : RED} ink="#f8f4e6" />
        </g>
      ))}
      <Text x={90} y={94} size={3.5} fill="#f8f4e6" anchor="middle">
        OFFSET MUST BE BELOW THE LIMIT
      </Text>
      <Text x={90} y={102} size={3.5} fill="#7cf0c8" anchor="middle">
        PHYSICAL = BASE + OFFSET
      </Text>
    </>
  );
}

/* ---- virtual memory: the Swapwood ---- */

/** Twilight woods: deep violet with drifting spores. */
function Wood({ seed = 0 }: { seed?: number }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#1c1236" />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={(i * 47 + seed * 19) % W} y={(i * 23 + seed * 11) % H} width={i % 3 ? 1 : 2} height={i % 3 ? 1 : 2} fill="#3a2a68" />
      ))}
    </>
  );
}

const DEMAND_STEPS = ["1 PAGE NOT IN RAM", "2 TRAP TO THE OS", "3 FIND IT ON DISK", "4 READ INTO A FREE FRAME", "5 SET THE VALID BIT", "6 RESTART INSTRUCTION"];
/** Silberschatz §10.2.2: 200 ns memory, 8 ms fault service, one fault in 1,000 accesses. */
export const DEMAND_EXAMPLE = { eat: demandPagingEat(0.001, 200, 8_000_000), faultNs: 8_000_000 };

/** The six steps of servicing a page fault. */
function Demand() {
  return (
    <>
      <Wood seed={3} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        SERVICING A PAGE FAULT
      </Text>
      {DEMAND_STEPS.map((t, i) => {
        const x = 4 + (i % 2) * 88;
        const y = 13 + Math.floor(i / 2) * 22;
        const [n, ...rest] = t.split(" ");
        return <Card key={i} x={x} y={y} w={84} h={18} lines={[n, rest.join(" ")]} size={3.5} ramp={i === 3 ? TEAL : i === 1 ? RED : i === 5 ? GREEN : PURPLE} ink="#f8f4e6" />;
      })}
      <Text x={90} y={86} size={3.5} fill="#f8f4e6" anchor="middle">
        EAT = (1 - P) x 200 + P x 8,000,000 NS
      </Text>
      <Text x={90} y={95} size={3.5} fill="#ffe27a" anchor="middle">
        {`P = 1/1000: EAT = ${DEMAND_EXAMPLE.eat} NS`}
      </Text>
      <Text x={90} y={104} size={3} fill="#cfe4ff" anchor="middle">
        THE FAULT IS 40,000 TIMES SLOWER THAN A HIT
      </Text>
    </>
  );
}

const POLICY_ROWS = [
  { policy: "fifo" as const, label: "FIFO", ramp: RED },
  { policy: "lru" as const, label: "LRU", ramp: TEAL },
  { policy: "opt" as const, label: "OPTIMAL", ramp: GOLD },
];
/** Silberschatz Figure 10.12's string in 3 frames. */
export const REPLACE_EXAMPLE = { faults: Object.fromEntries(POLICY_ROWS.map((r) => [r.policy, faultCount(REFERENCE_EXAMPLE, 3, r.policy)])) as Record<"fifo" | "lru" | "opt", number> };

/** The textbook reference string through FIFO, LRU and Optimal with three frames. */
function Replace() {
  return (
    <>
      <Wood seed={5} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        3 FRAMES, 20 REFERENCES
      </Text>
      <Text x={4} y={16} size={3.5} fill="#cfe4ff">
        {REFERENCE_EXAMPLE.join(" ")}
      </Text>
      {POLICY_ROWS.map((r, i) => {
        const n = REPLACE_EXAMPLE.faults[r.policy];
        return (
          <g key={r.policy}>
            <Text x={4} y={32 + i * 20} size={3.5} fill="#f8f4e6">
              {r.label}
            </Text>
            <Block x={40} y={25 + i * 20} w={n * 5} h={11} ramp={r.ramp} />
            <Text x={40 + n * 5 + 4} y={33 + i * 20} size={4} fill="#ffe27a">
              {`${n} FAULTS`}
            </Text>
          </g>
        );
      })}
      <Text x={90} y={93} size={3.5} fill="#f8f4e6" anchor="middle">
        OPTIMAL EVICTS THE PAGE USED FURTHEST AHEAD
      </Text>
      <Text x={90} y={101} size={3.5} fill="#7cf0c8" anchor="middle">
        LRU GUESSES THE FUTURE FROM THE PAST
      </Text>
    </>
  );
}

const BELADY_FRAMES = 5;
export const BELADY_CURVES = { fifo: faultCurve(BELADY_EXAMPLE, "fifo", BELADY_FRAMES), lru: faultCurve(BELADY_EXAMPLE, "lru", BELADY_FRAMES) };

/** Fault counts against frame count for FIFO and LRU on the anomaly string. */
function Belady() {
  const base = 78;
  const unit = 5;
  return (
    <>
      <Wood seed={8} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        1 2 3 4 1 2 5 1 2 3 4 5
      </Text>
      {(["fifo", "lru"] as const).map((k, row) =>
        BELADY_CURVES[k].map((n, i) => {
          const x = 10 + row * 84 + i * 15;
          const rise = k === "fifo" && i === 3;
          return (
            <g key={`${k}${i}`}>
              <Block x={x} y={base - n * unit} w={11} h={n * unit} ramp={rise ? RED : k === "fifo" ? PURPLE : TEAL} />
              <Text x={x + 5.5} y={base - n * unit - 2} size={3.5} fill={rise ? "#f87a8a" : "#f8f4e6"} anchor="middle">
                {n}
              </Text>
              <Text x={x + 5.5} y={base + 6} size={3} fill="#cfe4ff" anchor="middle">
                {i + 1}
              </Text>
            </g>
          );
        }),
      )}
      <Text x={45} y={93} size={3.5} fill="#f8f4e6" anchor="middle">
        FIFO: 9 THEN 10
      </Text>
      <Text x={129} y={93} size={3.5} fill="#f8f4e6" anchor="middle">
        LRU NEVER RISES
      </Text>
      <Text x={90} y={103} size={3.5} fill="#f87a8a" anchor="middle">
        BELADY: MORE FRAMES, MORE FAULTS
      </Text>
    </>
  );
}

/** CPU utilisation against the degree of multiprogramming, collapsing past the peak. */
const THRASH_CURVE = [10, 26, 42, 56, 66, 70, 52, 26, 12, 8];

function Thrash() {
  const base = 80;
  return (
    <>
      <Wood seed={11} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        CPU UTILISATION
      </Text>
      {THRASH_CURVE.map((v, i) => (
        <Block key={i} x={10 + i * 12} y={base - v} w={10} h={v} ramp={i < 6 ? TEAL : RED} />
      ))}
      <Text x={10 + 5 * 12 + 5} y={base - 73} size={3.5} fill="#7cf0c8" anchor="middle">
        PEAK
      </Text>
      <Text x={152} y={base - 52} size={3.5} fill="#f87a8a" anchor="middle">
        THRASHING
      </Text>
      <Text x={65} y={base + 7} size={3} fill="#cfe4ff" anchor="middle">
        DEGREE OF MULTIPROGRAMMING
      </Text>
      <Text x={90} y={97} size={3.5} fill="#f8f4e6" anchor="middle">
        TOO FEW FRAMES: PAGES EVICTED ARE NEEDED AGAIN
      </Text>
      <Text x={90} y={105} size={3.5} fill="#ffe27a" anchor="middle">
        THE OS ADDS MORE PROCESSES AND IT GETS WORSE
      </Text>
    </>
  );
}

/** Silberschatz Figure 10.16's reference string; Δ = 10. */
export const WSS_REFS = [2, 6, 1, 5, 7, 7, 7, 7, 5, 1, 6, 2, 3, 4, 1, 2, 3, 4, 4, 4, 3, 4, 3, 4, 4, 4, 1, 3, 2, 3, 4, 4, 4, 3, 4, 4, 4];
export const WSS_WINDOW = 10;
export const WSS_T1 = 9;
export const WSS_T2 = 25;
export const WSS_EXAMPLE = { t1: workingSet(WSS_REFS, WSS_T1, WSS_WINDOW), t2: workingSet(WSS_REFS, WSS_T2, WSS_WINDOW) };

/** A window of the last 10 references at two moments in a program's life. */
function Wss() {
  const cell = 12;
  const rows = [
    { t: WSS_T1, set: WSS_EXAMPLE.t1, label: "T1" },
    { t: WSS_T2, set: WSS_EXAMPLE.t2, label: "T2" },
  ];
  return (
    <>
      <Wood seed={14} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        WORKING SET WITH WINDOW = 10
      </Text>
      {rows.map((r, row) => {
        const y = 14 + row * 34;
        const lo = Math.max(0, r.t - WSS_WINDOW + 1);
        return (
          <g key={r.label}>
            {WSS_REFS.slice(lo, r.t + 1).map((p, i) => (
              <Card key={i} x={22 + i * (cell + 0.4)} y={y} w={cell} h={9} lines={[`${p}`]} size={3.5} ramp={TEAL} ink="#f8f4e6" />
            ))}
            <Text x={4} y={y + 6.5} size={4} fill="#ffe27a">
              {r.label}
            </Text>
            <Text x={22} y={y + 19} size={3.5} fill="#f8f4e6">
              {`WS = { ${r.set.join(", ")} }`}
            </Text>
            <Text x={176} y={y + 19} size={4} fill="#7cf0c8" anchor="end">
              {`SIZE ${r.set.length}`}
            </Text>
          </g>
        );
      })}
      <Text x={90} y={85} size={3.5} fill="#f8f4e6" anchor="middle">
        D = SUM OF WORKING-SET SIZES
      </Text>
      <Text x={90} y={94} size={3.5} fill="#f87a8a" anchor="middle">
        D MORE THAN THE FRAMES: SUSPEND A PROCESS
      </Text>
      <Text x={90} y={103} size={3} fill="#cfe4ff" anchor="middle">
        LOCALITY: A PROGRAM MOVES FROM ONE SET OF PAGES TO ANOTHER
      </Text>
    </>
  );
}

/* ---- storage and file systems: the Disk Docks ---- */

/** Harbour night: dark teal water with a few lamp glints. */
function Dock({ seed = 0 }: { seed?: number }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#0f2a2a" />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={(i * 41 + seed * 17) % W} y={(i * 29 + seed * 13) % H} width={i % 3 ? 1 : 2} height={1} fill="#1f4a46" />
      ))}
    </>
  );
}

/** Where the file's blocks sit for the three allocation methods, and the reads to reach block 9. */
export const ALLOC_ROWS = [
  { label: "CONTIGUOUS", note: "RUN OF BLOCKS: FAST, BUT FRAGMENTS", reads: 1 },
  { label: "LINKED", note: "EACH BLOCK POINTS TO THE NEXT", reads: 10 },
  { label: "INDEXED", note: "ONE INDEX BLOCK LISTS THEM ALL", reads: 2 },
] as const;

function Alloc() {
  return (
    <>
      <Dock seed={1} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        WHERE ARE BLOCK 0 TO 4 OF THE FILE?
      </Text>
      {ALLOC_ROWS.map((r, i) => {
        const y = 14 + i * 29;
        return (
          <g key={r.label}>
            <Text x={4} y={y + 9} size={3.5} fill="#f8f4e6">
              {r.label}
            </Text>
            {i === 0 && [0, 1, 2, 3, 4].map((k) => <Block key={k} x={50 + k * 11} y={y + 2} w={11} h={11} ramp={GOLD} />)}
            {i === 1 &&
              [0, 1, 2, 3, 4].map((k) => (
                <g key={k}>
                  <Block x={50 + k * 26} y={y + 2} w={11} h={11} ramp={PURPLE} />
                  {k < 4 && <Arrow x1={61 + k * 26} y1={y + 7} x2={75 + k * 26} y2={y + 7} />}
                </g>
              ))}
            {i === 2 && (
              <>
                <Block x={50} y={y + 2} w={16} h={11} ramp={TEAL} />
                {[0, 1, 2, 3].map((k) => (
                  <Block key={k} x={82 + k * 24} y={y + 2} w={11} h={11} ramp={GOLD} />
                ))}
              </>
            )}
            <Text x={4} y={y + 22} size={3} fill="#cfe4ff">
              {`${r.note} - BLOCK 9: ${r.reads} ${r.reads === 1 ? "READ" : "READS"}`}
            </Text>
          </g>
        );
      })}
    </>
  );
}

/** A Unix inode with 1 KB blocks and 4-byte pointers: 256 pointers per block. */
export const INODE_EXAMPLE = { per: 256, blocks: inodeMaxBlocks(1024, 4), parts: [12, 256, 256 ** 2, 256 ** 3] };
const fmt = (n: number) => n.toLocaleString("en-US");

function Inode() {
  const rows = [
    { t: "12 DIRECT", ramp: GOLD },
    { t: "SINGLE INDIRECT", ramp: GREEN },
    { t: "DOUBLE INDIRECT", ramp: TEAL },
    { t: "TRIPLE INDIRECT", ramp: PURPLE },
  ];
  return (
    <>
      <Dock seed={2} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        INODE: 1 KB BLOCKS, 4-BYTE POINTERS
      </Text>
      {rows.map((r, i) => (
        <g key={r.t}>
          <Card x={4} y={14 + i * 17} w={62} h={14} ramp={r.ramp} lines={[r.t]} size={3.5} ink="#f8f4e6" />
          <Text x={72} y={24 + i * 17} size={3.5} fill="#f8f4e6">
            {i === 0 ? "12 BLOCKS" : i === 1 ? "256 BLOCKS" : i === 2 ? `256 X 256 = ${fmt(256 ** 2)}` : `256 CUBED = ${fmt(256 ** 3)}`}
          </Text>
        </g>
      ))}
      <Text x={90} y={90} size={3.5} fill="#7cf0c8" anchor="middle">
        {`TOTAL = ${fmt(INODE_EXAMPLE.blocks)} BLOCKS`}
      </Text>
      <Text x={90} y={99} size={3.5} fill="#ffe27a" anchor="middle">
        ABOUT 16 GIB: THE TRIPLE LEVEL DOMINATES
      </Text>
    </>
  );
}

const JOURNAL_STEPS = ["1 LOG THE CHANGES", "2 WRITE COMMIT RECORD", "3 CHECKPOINT TO DISK", "4 FREE THE LOG ENTRY", "CRASH BEFORE 2", "CRASH AFTER 2"];

/** The life of a journaled transaction and what recovery does at each crash point. */
function Journal() {
  return (
    <>
      <Dock seed={3} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        A JOURNALED TRANSACTION
      </Text>
      {JOURNAL_STEPS.map((t, i) => {
        const x = 4 + (i % 2) * 88;
        const y = 13 + Math.floor(i / 2) * 22;
        const [n, ...rest] = t.split(" ");
        return <Card key={i} x={x} y={y} w={84} h={18} lines={[n, rest.join(" ")]} size={3.5} ramp={i === 4 ? RED : i === 5 ? GREEN : i === 1 ? GOLD : TEAL} ink="#f8f4e6" />;
      })}
      <Text x={90} y={86} size={3.5} fill="#f8f4e6" anchor="middle">
        BEFORE THE COMMIT: THROW THE LOG AWAY
      </Text>
      <Text x={90} y={95} size={3.5} fill="#7cf0c8" anchor="middle">
        AFTER THE COMMIT: REPLAY (REDO) THE LOG
      </Text>
      <Text x={90} y={104} size={3} fill="#cfe4ff" anchor="middle">
        THE FILE SYSTEM IS NEVER HALF-UPDATED
      </Text>
    </>
  );
}

const RAID_LEVELS: RaidLevel[] = [0, 1, 5, 6, 10];
/** Usable disks and guaranteed failure tolerance for four equal disks. */
export const RAID_EXAMPLE = RAID_LEVELS.map((level) => ({ level, usable: raidUsableDisks(level, 4), survives: raidGuaranteedFailures(level) }));

function Raid() {
  return (
    <>
      <Dock seed={4} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        FOUR DISKS: HOW MUCH IS USABLE?
      </Text>
      {RAID_EXAMPLE.map((r, i) => {
        const y = 13 + i * 17;
        return (
          <g key={r.level}>
            <Text x={4} y={y + 9} size={3.5} fill="#f8f4e6">
              {`RAID ${r.level}`}
            </Text>
            <Block x={40} y={y} w={r.usable * 16} h={12} ramp={r.survives === 0 ? RED : r.survives === 1 ? TEAL : GREEN} />
            <Text x={40 + r.usable * 16 + 4} y={y + 8} size={3.5} fill="#ffe27a">
              {`${r.usable} OF 4, SURVIVES ${r.survives}`}
            </Text>
          </g>
        );
      })}
      <Text x={90} y={103} size={3} fill="#cfe4ff" anchor="middle">
        RAID 5 SPREADS ONE DISK OF PARITY ACROSS ALL
      </Text>
    </>
  );
}

const DISK_ROWS: { policy: DiskPolicy; label: string }[] = [
  { policy: "fcfs", label: "FCFS" },
  { policy: "sstf", label: "SSTF" },
  { policy: "scan", label: "SCAN" },
  { policy: "cscan", label: "C-SCAN" },
  { policy: "look", label: "LOOK" },
  { policy: "clook", label: "C-LOOK" },
];
/** Silberschatz Figure 11.4 (head at 53, heading up): cylinders moved by each policy. */
export const DISK_BARS = Object.fromEntries(DISK_ROWS.map((r) => [r.policy, scheduleDisk(DISK_EXAMPLE.queue, DISK_EXAMPLE.head, r.policy, DISK_EXAMPLE.cylinders, "up").movement])) as Record<DiskPolicy, number>;

function DiskSched() {
  return (
    <>
      <Dock seed={5} />
      <Text x={4} y={8} size={3.5} fill="#ffe27a">
        HEAD AT 53, QUEUE 98 183 37 122 14 124 65 67
      </Text>
      {DISK_ROWS.map((r, i) => {
        const n = DISK_BARS[r.policy];
        const y = 13 + i * 14;
        return (
          <g key={r.policy}>
            <Text x={4} y={y + 8} size={3.5} fill="#f8f4e6">
              {r.label}
            </Text>
            <Block x={34} y={y} w={Math.round(n / 6)} h={10} ramp={r.policy === "fcfs" ? RED : r.policy === "sstf" || r.policy === "look" ? TEAL : GOLD} />
            <Text x={34 + Math.round(n / 6) + 4} y={y + 8} size={3.5} fill="#ffe27a">
              {`${n} CYL`}
            </Text>
          </g>
        );
      })}
      <Text x={90} y={102} size={3} fill="#cfe4ff" anchor="middle">
        SCAN GOES TO THE END, LOOK TURNS AT THE LAST REQUEST
      </Text>
    </>
  );
}

/* ---- containers: the Linux toolkit under Docker ---- */

/** The namespaces diagram's processes: two host daemons, then container A's init and shell, and B's init. */
export const NAMESPACE_EXAMPLE = (() => {
  const ns = new PidNamespaces();
  ns.fork(0);
  ns.fork(0);
  const a = ns.create(0);
  const b = ns.create(0);
  return { a: [ns.fork(a), ns.fork(a)], b: [ns.fork(b)], aId: a, bId: b };
})();
const NS_KINDS = [["MNT", "MOUNTS"], ["PID", "PROCS"], ["NET", "NICS"], ["UTS", "HOST"], ["IPC", "QUEUES"], ["USER", "UIDS"]];

function Namespaces() {
  const { a, b, aId, bId } = NAMESPACE_EXAMPLE;
  const proc = (pids: Map<number, number>, ns: number, name: string) => `${pids.get(ns)} ${name} = HOST ${pids.get(0)}`;
  return (
    <>
      <Night seed={21} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">
        ONE KERNEL, A PRIVATE VIEW PER CONTAINER
      </Text>
      <Block x={4} y={12} w={172} h={50} ramp={STONE}>
        <Text x={8} y={19} size={3.5} fill="#f8f4e6">
          HOST: PID NAMESPACE 0 SEES EVERY PROCESS
        </Text>
      </Block>
      <Card x={10} y={23} w={78} h={34} ramp={BLUE} ink="#f8f4e6" size={3.5} lines={["CONTAINER A", proc(a[0], aId, "INIT"), proc(a[1], aId, "SH")]} />
      <Card x={92} y={23} w={78} h={34} ramp={TEAL} ink="#f8f4e6" size={3.5} lines={["CONTAINER B", proc(b[0], bId, "INIT")]} />
      {NS_KINDS.map(([k, what], i) => (
        <Card key={k} x={4 + i * 29} y={68} w={28} h={16} ramp={i === 1 ? GOLD : CREAM} size={3.5} lines={[k, what]} />
      ))}
      <Text x={90} y={94} size={3.5} fill="#f8f4e6" anchor="middle">
        clone(CLONE_NEWPID | CLONE_NEWNET | ...)
      </Text>
      <Text x={90} y={103} size={3.5} fill="#7cf0c8" anchor="middle">
        A NAMESPACE CHANGES WHAT A PROCESS CAN SEE
      </Text>
    </>
  );
}

const CG_THREADS = [4, 1];
const CG_MEM = { limit: 512, fits: memoryMax(512, [{ name: "app", anonMB: 400 }], 300), over: memoryMax(512, [{ name: "web", anonMB: 200 }, { name: "leak", anonMB: 450 }], 50) };
export const CGROUP_EXAMPLE = { throttle: CG_THREADS.map((t) => cpuMax(50000, 100000, t, 8)), mem: CG_MEM };

function Cgroups() {
  const bar = 100;
  const scale = 120 / 650;
  return (
    <>
      <Night seed={23} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">
        CGROUP V2 LIMITS
      </Text>
      <Text x={4} y={17} size={3.5} fill="#f8f4e6">
        cpu.max = 50000 100000 (HALF A CPU)
      </Text>
      {CGROUP_EXAMPLE.throttle.map((t, i) => {
        const y = 20 + i * 12;
        const run = (t.runUs / 100000) * bar;
        return (
          <g key={i}>
            <Text x={4} y={y + 6} size={3.5} fill="#cfe4ff">{`${CG_THREADS[i]} BUSY`}</Text>
            <Block x={44} y={y} w={Math.max(run, 3)} h={9} ramp={GREEN} />
            <Block x={44 + run} y={y} w={bar - run} h={9} ramp={RED} />
            <Text x={174} y={y + 6} size={3.5} fill="#ffe27a" anchor="end">{`${t.runUs / 1000}MS`}</Text>
          </g>
        );
      })}
      <Text x={44} y={46} size={3} fill="#7cc24f">RUN</Text>
      <Text x={60} y={46} size={3} fill="#f87a8a">THROTTLED UNTIL THE PERIOD ENDS</Text>
      <Text x={4} y={56} size={3.5} fill="#f8f4e6">
        memory.max = 512M
      </Text>
      {[
        { label: "CACHE", parts: [[400, BLUE], [CG_MEM.fits.reclaimedMB === 0 ? 0 : 300, GOLD]] as [number, Ramp][] },
        { label: "LEAK", parts: [[200, BLUE], [450, RED], [50, GOLD]] as [number, Ramp][] },
      ].map((row, i) => {
        const y = 60 + i * 12;
        let x = 30;
        return (
          <g key={row.label}>
            <Text x={4} y={y + 6} size={3.5} fill="#cfe4ff">{row.label}</Text>
            {row.parts.map(([mb, ramp], j) => {
              const w = Math.max(mb * scale, mb ? 2 : 0);
              const r = (
                <g key={j}>{mb > 0 && <Block x={x} y={y} w={w} h={9} ramp={ramp} />}</g>
              );
              x += w;
              return r;
            })}
          </g>
        );
      })}
      <rect x={30 + CG_MEM.limit * scale - 0.5} y={59} width={1} height={26} fill="#ffe27a" />
      <Text x={30 + CG_MEM.limit * scale} y={90} size={3} fill="#ffe27a" anchor="middle">LIMIT</Text>
      <Text x={90} y={99} size={3.5} fill="#f8f4e6" anchor="middle">
        OVER: DROP CACHE (GOLD), THEN OOM-KILL THE BIGGEST
      </Text>
      <Text x={90} y={107} size={3} fill="#7cf0c8" anchor="middle">
        CPU IS THROTTLED; MEMORY IS KILLED
      </Text>
    </>
  );
}

/** The overlay diagram: an image of two layers, then a write to the 100 MB database file and a delete of the app binary. */
const ovLayer = (files: Record<string, number>): Layer => new Map(Object.entries(files).map(([k, mb]) => [k, { data: "v1", sizeMB: mb }]));
const OV_BASE = ovLayer({ "/bin/sh": 1, "/db/data": 100, "/etc/motd": 0 });
const OV_APP = ovLayer({ "/app/run": 5 });
export const OVERLAY_EXAMPLE = (() => {
  const o = new Overlay([OV_APP, OV_BASE]);
  o.write("/db/data", "v2");
  o.remove("/app/run");
  const merged = ["/app/run", "/bin/sh", "/db/data", "/etc/motd"].filter((p) => o.read(p));
  return { overlay: o, merged };
})();

function OverlayFs() {
  const { overlay, merged } = OVERLAY_EXAMPLE;
  const base = (p: string) => p.slice(p.lastIndexOf("/") + 1).toUpperCase();
  const size = (p: string, l: Layer) => {
    const e = l.get(p);
    return e && e !== WHITEOUT && e.sizeMB > 0 ? ` ${e.sizeMB}M` : "";
  };
  const rows: { label: string; layer: Layer; ramp: Ramp }[] = [
    { label: "UPPER RW", layer: overlay.upper, ramp: GOLD },
    { label: "APP LAYER", layer: OV_APP, ramp: BLUE },
    { label: "BASE LAYER", layer: OV_BASE, ramp: STONE },
  ];
  return (
    <>
      <Night seed={25} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">
        OVERLAYFS: LAYERS MERGED INTO ONE VIEW
      </Text>
      {rows.map((r, i) => {
        const y = 12 + i * 18;
        return (
          <g key={r.label}>
            <Text x={4} y={y + 9} size={3.5} fill="#cfe4ff">{r.label}</Text>
            {[...r.layer.keys()].sort().map((p, j) => {
              const whiteout = r.layer.get(p) === WHITEOUT;
              return <Card key={p} x={42 + j * 45} y={y} w={43} h={14} ramp={whiteout ? RED : r.ramp} ink="#f8f4e6" size={3.5} lines={[whiteout ? `X ${base(p)}` : base(p) + size(p, r.layer)]} />;
            })}
          </g>
        );
      })}
      <Text x={4} y={72} size={3.5} fill="#7cf0c8">MERGED</Text>
      {merged.map((p, j) => (
        <Card key={p} x={42 + j * 33} y={66} w={31} h={10} ramp={GREEN} ink="#f8f4e6" size={3} lines={[base(p)]} />
      ))}
      <Text x={90} y={88} size={3.5} fill="#f8f4e6" anchor="middle">
        {`FIRST WRITE COPIES THE WHOLE FILE UP: ${overlay.copiedUpMB}M`}
      </Text>
      <Text x={90} y={96} size={3.5} fill="#f8f4e6" anchor="middle">
        RM LEAVES A WHITEOUT (X) IN THE UPPER LAYER
      </Text>
      <Text x={90} y={105} size={3} fill="#7cf0c8" anchor="middle">
        LOWER LAYERS ARE NEVER CHANGED, SO IMAGES ARE SHARED
      </Text>
    </>
  );
}

function VmCompare() {
  return (
    <>
      <Night seed={27} />
      <Text x={46} y={9} size={4} fill="#ffe27a" anchor="middle">CONTAINERS</Text>
      <Text x={134} y={9} size={4} fill="#ffe27a" anchor="middle">VIRTUAL MACHINES</Text>
      {["APP A", "APP B", "APP C"].map((a, i) => (
        <Card key={a} x={4 + i * 29} y={13} w={26} h={16} ramp={TEAL} ink="#f8f4e6" size={3} lines={[a]} />
      ))}
      <Card x={4} y={32} w={84} h={14} ramp={PURPLE} ink="#f8f4e6" size={3.5} lines={["ONE SHARED HOST KERNEL"]} />
      <Card x={4} y={49} w={84} h={12} ramp={STONE} ink="#f8f4e6" size={3.5} lines={["HARDWARE"]} />
      {["APP A", "APP B"].map((a, i) => (
        <g key={a}>
          <Card x={92 + i * 43} y={13} w={41} h={9} ramp={TEAL} ink="#f8f4e6" size={3} lines={[a]} />
          <Card x={92 + i * 43} y={23} w={41} h={11} ramp={PURPLE} ink="#f8f4e6" size={3} lines={["GUEST KERNEL"]} />
        </g>
      ))}
      <Card x={92} y={37} w={84} h={10} ramp={GOLD} size={3.5} lines={["HYPERVISOR"]} />
      <Card x={92} y={50} w={84} h={11} ramp={STONE} ink="#f8f4e6" size={3.5} lines={["HARDWARE (VT-X, EPT)"]} />
      {[
        ["START: MILLISECONDS", "START: SECONDS (BOOT)"],
        ["MEMORY: NO GUEST OS", "MEMORY: A KERNEL EACH"],
        ["BOUNDARY: SYSCALLS", "BOUNDARY: HARDWARE"],
        ["KERNEL BUG = ESCAPE", "ESCAPE NEEDS HYPERVISOR BUG"],
      ].map(([l, r], i) => (
        <g key={l}>
          <Text x={4} y={72 + i * 8} size={3} fill="#f8f4e6">{l}</Text>
          <Text x={92} y={72 + i * 8} size={3} fill="#cfe4ff">{r}</Text>
        </g>
      ))}
      <Text x={90} y={108} size={3} fill="#7cf0c8" anchor="middle">SHARED KERNEL: FAST AND DENSE; OWN KERNEL: STRONGER WALL</Text>
    </>
  );
}

export const DOCKER_RUN_STEPS = [
  ["1 OVERLAYFS", "IMAGE + RW LAYER"],
  ["2 CLONE", "CLONE_NEW* NAMESPACES"],
  ["3 CGROUP", "WRITE LIMITS, JOIN IT"],
  ["4 PIVOT_ROOT", "OVERLAY BECOMES /"],
  ["5 DROP PRIVILEGES", "CAPABILITIES, SECCOMP"],
  ["6 EXECVE", "ENTRYPOINT IS PID 1"],
] as const;

function DockerRun() {
  return (
    <>
      <Night seed={29} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">WHAT DOCKER RUN ASKS THE KERNEL TO DO</Text>
      {DOCKER_RUN_STEPS.map(([a, b], i) => (
        <Card key={a} x={4 + Math.floor(i / 3) * 88} y={14 + (i % 3) * 22} w={84} h={18} ramp={i % 3 === 1 ? PURPLE : BLUE} ink="#f8f4e6" size={3.5} lines={[a, b]} />
      ))}
      <Text x={90} y={86} size={3.5} fill="#f8f4e6" anchor="middle">STEPS 1-3 BUILD THE BOX, 4-5 LOCK IT DOWN</Text>
      <Text x={90} y={95} size={3.5} fill="#f8f4e6" anchor="middle">STEP 6 REPLACES RUNC WITH YOUR PROGRAM</Text>
      <Text x={90} y={105} size={3} fill="#7cf0c8" anchor="middle">NO VM: ONE PROCESS WITH NAMESPACES, CGROUPS, A ROOT</Text>
    </>
  );
}

const GUEST_PROGRAM = ["ADD", "MOV CR3", "POPF", "HLT"];
export const TRAP_EXAMPLE = { old: runGuest(OLD_X86, GUEST_PROGRAM), hw: runGuest(HW_ASSISTED_X86, GUEST_PROGRAM) };
const OUTCOME_LOOK: Record<Outcome, { ramp: Ramp; label: string }> = {
  native: { ramp: GREEN, label: "RUNS NATIVELY" },
  trap: { ramp: GOLD, label: "TRAPS, EMULATED" },
  leak: { ramp: RED, label: "NO TRAP: WRONG" },
};

function TrapEmulate() {
  return (
    <>
      <Night seed={31} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">GUEST KERNEL RUNS DEPRIVILEGED</Text>
      <Text x={62} y={17} size={3.5} fill="#cfe4ff" anchor="middle">BEFORE VT-X</Text>
      <Text x={143} y={17} size={3.5} fill="#cfe4ff" anchor="middle">WITH VT-X / AMD-V</Text>
      {TRAP_EXAMPLE.old.map((r, i) => {
        const y = 20 + i * 14;
        const hw = TRAP_EXAMPLE.hw[i];
        return (
          <g key={r.name}>
            <Card x={2} y={y} w={30} h={11} ramp={STONE} ink="#f8f4e6" size={3.5} lines={[r.name]} />
            <Card x={34} y={y} w={56} h={11} ramp={OUTCOME_LOOK[r.outcome].ramp} ink={r.outcome === "trap" ? undefined : "#f8f4e6"} size={3} lines={[OUTCOME_LOOK[r.outcome].label]} />
            <Card x={108} y={y} w={70} h={11} ramp={OUTCOME_LOOK[hw.outcome].ramp} ink={hw.outcome === "trap" ? undefined : "#f8f4e6"} size={3} lines={[OUTCOME_LOOK[hw.outcome].label]} />
          </g>
        );
      })}
      <Text x={90} y={82} size={3.5} fill="#f8f4e6" anchor="middle">TRAP: HYPERVISOR EMULATES ON THE VIRTUAL CPU</Text>
      <Text x={90} y={91} size={3.5} fill="#f8f4e6" anchor="middle">POPF SILENTLY DROPS IRQ FLAG IN USER MODE</Text>
      <Text x={90} y={100} size={3} fill="#7cf0c8" anchor="middle">POPEK-GOLDBERG: EVERY SENSITIVE INSTRUCTION MUST TRAP</Text>
      <Text x={90} y={108} size={3} fill="#7cf0c8" anchor="middle">VT-X ADDS A GUEST MODE WHERE THEY ALL DO</Text>
    </>
  );
}

export const NESTED_WALK = nestedWalkRefs(4, 4);

function NestedPt() {
  // 5 rows (guest levels 4..1, then the data address) x 5 columns (4 nested reads, then the guest entry itself)
  const cells: { n: number; row: number; col: number }[] = [];
  let n = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) if (!(row === 4 && col === 4)) cells.push({ n: ++n, row, col });
  return (
    <>
      <Night seed={33} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">NESTED PAGING: ONE TLB MISS, 2-D WALK</Text>
      {cells.map((c) => (
        <Card key={c.n} x={4 + c.col * 13} y={12 + c.row * 11} w={12} h={10} ramp={c.col === 4 ? PURPLE : BLUE} ink="#f8f4e6" size={3.5} lines={[String(c.n)]} />
      ))}
      <Text x={72} y={21} size={3} fill="#cfe4ff">BLUE: NESTED (EPT)</Text>
      <Text x={72} y={27} size={3} fill="#cfe4ff">TABLE READS</Text>
      <Text x={72} y={37} size={3} fill="#c8b8ff">PURPLE: THE GUEST</Text>
      <Text x={72} y={43} size={3} fill="#c8b8ff">ENTRY ITSELF</Text>
      <Text x={72} y={55} size={3.5} fill="#f8f4e6">{`4 GUEST LEVELS X 4 NESTED`}</Text>
      <Text x={72} y={62} size={3.5} fill="#ffe27a">{`= ${NESTED_WALK} READS PER MISS`}</Text>
      <Text x={72} y={69} size={3.5} fill="#f8f4e6">NATIVE: 4 READS</Text>
      <Text x={90} y={88} size={3.5} fill="#f8f4e6" anchor="middle">SHADOW TABLES: NATIVE-SPEED MISS,</Text>
      <Text x={90} y={95} size={3.5} fill="#f8f4e6" anchor="middle">BUT EVERY GUEST PT WRITE IS A VM EXIT</Text>
      <Text x={90} y={105} size={3} fill="#7cf0c8" anchor="middle">NESTED: NO EXITS; BIG TLBS HIDE THE LONG WALK</Text>
    </>
  );
}

export const MIGRATION_EXAMPLE = preCopy(8192, 250, 1000, 64);

function Migration() {
  const m = MIGRATION_EXAMPLE;
  const bar = (mb: number) => Math.max(2, (mb / 8192) * 100);
  const rows = [...m.rounds.map((r, i) => ({ label: `ROUND ${i + 1}`, mb: r.sentMB, ramp: BLUE })), { label: "PAUSED", mb: m.stopCopyMB, ramp: RED }];
  return (
    <>
      <Night seed={35} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">PRE-COPY LIVE MIGRATION OF AN 8 GB VM</Text>
      {rows.map((r, i) => (
        <g key={r.label}>
          <Text x={4} y={21 + i * 11} size={3.5} fill="#cfe4ff">{r.label}</Text>
          <Card x={40} y={14 + i * 11} w={bar(r.mb)} h={9} ramp={r.ramp} ink="#f8f4e6" size={3} lines={[]} />
          <Text x={44 + bar(r.mb)} y={21 + i * 11} size={3.5} fill="#f8f4e6">{`${r.mb} MB`}</Text>
        </g>
      ))}
      <Text x={90} y={78} size={3.5} fill="#f8f4e6" anchor="middle">LINK 1000 MB/S, DIRTY 250 MB/S: ROUNDS SHRINK 4X</Text>
      <Text x={90} y={86} size={3.5} fill="#f8f4e6" anchor="middle">{`GUEST PAUSED FOR ${Math.round(m.downtimeSec * 1000)} MS, THEN RESUMES ON THE TARGET`}</Text>
      <Text x={90} y={96} size={3} fill="#7cf0c8" anchor="middle">DIRTY RATE ABOVE LINK SPEED: NEVER CONVERGES</Text>
      <Text x={90} y={104} size={3} fill="#7cf0c8" anchor="middle">THROTTLE THE GUEST OR USE POST-COPY</Text>
    </>
  );
}

export const ABA_EXAMPLE = { untagged: abaScenario(false), tagged: abaScenario(true) };
export const SB_EXAMPLE = { sc: outcomes(STORE_BUFFERING, "sc", ["x", "y"]), tso: outcomes(STORE_BUFFERING, "tso", ["x", "y"]) };

function Cas() {
  const { untagged, tagged } = ABA_EXAMPLE;
  const chain = (y: number, names: string[], ramps: Ramp[]) =>
    names.map((n, i) => <Card key={n + i} x={74 + i * 22} y={y} w={16} h={11} ramp={ramps[i]} ink="#f8f4e6" size={4} lines={[n]} />);
  return (
    <>
      <Night seed={36} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">ABA: A STALE CAS THAT STILL SUCCEEDS</Text>
      <Text x={3} y={24} size={3.5} fill="#cfe4ff">START</Text>
      {chain(17, ["A", "B", "C"], [BLUE, BLUE, BLUE])}
      <Text x={3} y={39} size={3.5} fill="#cfe4ff">T2: POP A,</Text>
      <Text x={3} y={45} size={3.5} fill="#cfe4ff">POP B, PUSH A</Text>
      {chain(36, ["A", "C"], [BLUE, BLUE])}
      <Card x={122} y={36} w={40} h={11} ramp={RED} ink="#f8f4e6" size={3} lines={["B FREED"]} />
      <Text x={3} y={68} size={3.5} fill="#cfe4ff">T1: CAS(HEAD, A, B)</Text>
      <Card x={2} y={72} w={86} h={13} ramp={RED} ink="#f8f4e6" size={3} lines={[untagged.casSucceeded ? `NO TAG: HEAD = ${untagged.head} (FREED)` : "NO TAG: FAILS"]} />
      <Card x={92} y={72} w={86} h={13} ramp={GREEN} ink="#f8f4e6" size={3} lines={[tagged.casSucceeded ? "TAGGED: OK" : "TAG 0 != 3: CAS FAILS"]} />
      <Text x={90} y={96} size={3} fill="#7cf0c8" anchor="middle">FIX: VERSION TAG NEXT TO THE POINTER, OR</Text>
      <Text x={90} y={104} size={3} fill="#7cf0c8" anchor="middle">HAZARD POINTERS / EPOCHS FOR SAFE RECLAMATION</Text>
    </>
  );
}

function Ordering() {
  const row = (label: string, list: string[], y: number, ramp: Ramp) => (
    <g>
      <Text x={3} y={y + 6} size={3.5} fill="#cfe4ff">{label}</Text>
      {["r1=0 r2=0", "r1=0 r2=1", "r1=1 r2=0", "r1=1 r2=1"].map((o, i) => {
        const has = list.includes(o);
        return <Card key={o} x={44 + i * 34} y={y} w={32} h={10} ramp={has ? (o === "r1=0 r2=0" ? RED : ramp) : STONE} ink="#f8f4e6" size={3} lines={[has ? o.replace("r1=", "").replace(" r2=", ",") : "NEVER"]} />;
      })}
    </g>
  );
  return (
    <>
      <Night seed={37} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">STORE BUFFERING: (R1, R2) RESULTS</Text>
      <Text x={90} y={17} size={3.5} fill="#f8f4e6" anchor="middle">T0: X=1; R1=Y    T1: Y=1; R2=X</Text>
      <Text x={44} y={28} size={3} fill="#cfe4ff">0,0</Text>
      <Text x={78} y={28} size={3} fill="#cfe4ff">0,1</Text>
      <Text x={112} y={28} size={3} fill="#cfe4ff">1,0</Text>
      <Text x={146} y={28} size={3} fill="#cfe4ff">1,1</Text>
      {row("SEQ CST", SB_EXAMPLE.sc, 31, GREEN)}
      {row("X86-TSO", SB_EXAMPLE.tso, 45, GREEN)}
      {row("WITH FENCE", SB_EXAMPLE.sc, 59, GREEN)}
      <Text x={90} y={80} size={3.5} fill="#f8f4e6" anchor="middle">THE STORE WAITS IN A BUFFER; THE LOAD RUNS FIRST</Text>
      <Text x={90} y={90} size={3} fill="#7cf0c8" anchor="middle">RELEASE STORE + ACQUIRE LOAD: DATA BEFORE THE FLAG</Text>
      <Text x={90} y={98} size={3} fill="#7cf0c8" anchor="middle">VOLATILE IN C: NO ATOMICITY, NO CPU ORDERING</Text>
    </>
  );
}

export const FALSE_SHARING_EXAMPLE = (() => {
  const shared = coherenceMisses(alternatingWrites(0, 8, 500));
  const padded = coherenceMisses(alternatingWrites(0, 64, 500));
  return { shared, padded, sharedNs: writeTime(shared, 1000, 1, 60), paddedNs: writeTime(padded, 1000, 1, 60) };
})();
export const FUTEX_EXAMPLE = runFutex([
  { t: "A", op: "lock" },
  { t: "B", op: "lock" },
  { t: "A", op: "unlock" },
]);

function FalseShare() {
  const f = FALSE_SHARING_EXAMPLE;
  const lineBox = (x: number, y: number, cells: string[], ramp: Ramp) => (
    <g>
      <Block x={x} y={y} w={72} h={13} ramp={STONE} />
      {cells.map((c, i) => (
        <Card key={i} x={x + 3 + i * 17} y={y + 3} w={15} h={7} ramp={ramp} ink="#f8f4e6" size={3} lines={[c]} />
      ))}
    </g>
  );
  return (
    <>
      <Night seed={38} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">FALSE SHARING: ONE 64-BYTE LINE, TWO CORES</Text>
      <Card x={8} y={14} w={30} h={10} ramp={BLUE} ink="#f8f4e6" size={3.5} lines={["CORE 0"]} />
      <Card x={142} y={14} w={30} h={10} ramp={PURPLE} ink="#f8f4e6" size={3.5} lines={["CORE 1"]} />
      <Arrow x1={40} y1={19} x2={70} y2={19} />
      <Arrow x1={140} y1={19} x2={110} y2={19} color="#f87a8a" />
      <Text x={90} y={17} size={3} fill="#cfe4ff" anchor="middle">LINE MOVES</Text>
      <Text x={90} y={26} size={3} fill="#cfe4ff" anchor="middle">EVERY WRITE</Text>
      <Text x={3} y={36} size={3.5} fill="#cfe4ff">SAME LINE: CTR0 AT 0, CTR1 AT 8</Text>
      {lineBox(54, 38, ["C0", "C1", "..", ".."], RED)}
      <Text x={90} y={58} size={3.5} fill="#f87a8a" anchor="middle">{`${f.shared} MISSES, ${f.sharedNs / 1000} US`}</Text>
      <Text x={3} y={67} size={3.5} fill="#cfe4ff">PADDED: CTR1 AT 64</Text>
      {lineBox(16, 70, ["C0", "..", "..", ".."], GREEN)}
      {lineBox(92, 70, ["C1", "..", "..", ".."], GREEN)}
      <Text x={90} y={90} size={3.5} fill="#7cf0c8" anchor="middle">{`${f.padded} MISSES, ${(f.paddedNs / 1000).toFixed(1)} US`}</Text>
      <Text x={90} y={100} size={3} fill="#7cf0c8" anchor="middle">1000 WRITES, HIT 1 NS, MISS 60 NS: 54X SLOWER</Text>
    </>
  );
}

function Futex() {
  const f = FUTEX_EXAMPLE;
  const steps = [
    { who: "A LOCK", note: "CAS 0>1", sys: false },
    { who: "B LOCK", note: "WORD=2, WAIT", sys: true },
    { who: "A UNLOCK", note: "SAW 2, WAKE", sys: true },
  ];
  return (
    <>
      <Night seed={39} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">FUTEX: KERNEL ONLY ON CONTENTION</Text>
      {steps.map((s, i) => (
        <g key={s.who}>
          <Card x={4} y={15 + i * 17} w={40} h={12} ramp={BLUE} ink="#f8f4e6" size={3.5} lines={[s.who]} />
          <Card x={48} y={15 + i * 17} w={50} h={12} ramp={STONE} ink="#f8f4e6" size={3} lines={[s.note]} />
          <Card x={102} y={15 + i * 17} w={22} h={12} ramp={GOLD} lines={[`W=${f.states[i]}`]} size={3.5} />
          <Card x={128} y={15 + i * 17} w={48} h={12} ramp={s.sys ? RED : GREEN} ink="#f8f4e6" size={3} lines={[s.sys ? "SYSCALL" : "USER SPACE"]} />
        </g>
      ))}
      <Text x={90} y={72} size={3.5} fill="#f8f4e6" anchor="middle">{`${f.waits} WAIT + ${f.wakes} WAKE = ${f.waits + f.wakes} SYSTEM CALLS`}</Text>
      <Text x={90} y={82} size={3} fill="#cfe4ff" anchor="middle">W = WORD: 0 FREE, 1 LOCKED, 2 SLEEPERS</Text>
      <Text x={90} y={94} size={3} fill="#7cf0c8" anchor="middle">SPINLOCK: BURNS A CORE, NO SYSCALL. SHORT HOLDS ONLY</Text>
      <Text x={90} y={102} size={3} fill="#7cf0c8" anchor="middle">SLEEP + WAKE COSTS MICROSECONDS: LONG HOLDS</Text>
    </>
  );
}

export const HEAP_EXAMPLE = (() => {
  const h = new FreeListHeap(100);
  for (const id of ["A", "B", "C"]) h.malloc(id, 30);
  const before = h.chunks.map((c) => ({ ...c }));
  h.free("A");
  h.free("C");
  return { before, after: h.chunks.map((c) => ({ ...c })), free: h.freeBytes, largest: h.largestHole, fits50: h.malloc("D", 50) !== null };
})();
export const BUDDY_EXAMPLE = (() => {
  const b = new Buddy(256);
  const grant = b.alloc("A", 21)!;
  return { grant, free: b.freeBlocks() };
})();

function FreeList() {
  const e = HEAP_EXAMPLE;
  const strip = (y: number, chunks: { size: number; id: string | null }[]) =>
    chunks.map((c, i) => {
      const x = 10 + chunks.slice(0, i).reduce((a, k) => a + k.size, 0) * 1.6;
      return <Card key={i} x={x} y={y} w={c.size * 1.6 - 1} h={14} ramp={c.id ? BLUE : RED} ink="#f8f4e6" size={3.5} lines={[c.id ? `${c.id} ${c.size}` : c.size < 20 ? `${c.size}` : `FREE ${c.size}`]} />;
    });
  return (
    <>
      <Night seed={40} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">FREE LIST: SPLIT AND COALESCE</Text>
      <Text x={10} y={20} size={3.5} fill="#cfe4ff">THREE 30-BYTE BLOCKS IN A 100-BYTE HEAP</Text>
      {strip(23, e.before)}
      <Text x={10} y={45} size={3.5} fill="#cfe4ff">FREE A AND C: THE END HOLE MERGES WITH C</Text>
      {strip(48, e.after)}
      <Text x={90} y={72} size={3.5} fill="#f8f4e6" anchor="middle">{`${e.free} FREE, LARGEST HOLE ${e.largest}`}</Text>
      <Text x={90} y={79} size={3.5} fill="#f87a8a" anchor="middle">{e.fits50 ? "50 FITS" : "MALLOC(50) FAILS: EXTERNAL FRAGMENTATION"}</Text>
      <Card x={10} y={86} w={76} h={14} ramp={GREEN} ink="#f8f4e6" size={3} lines={[`UNDER ${MMAP_THRESHOLD / 1024}K: BRK HEAP`]} />
      <Card x={94} y={86} w={76} h={14} ramp={PURPLE} ink="#f8f4e6" size={3} lines={[`${MMAP_THRESHOLD / 1024}K UP: OWN MMAP`]} />
    </>
  );
}

function BuddyDiagram() {
  const g = BUDDY_EXAMPLE.grant;
  const k = 160 / 256;
  const rows: { size: number; used?: boolean }[][] = [
    [{ size: 256 }],
    [{ size: 128 }, { size: 128 }],
    [{ size: 64 }, { size: 64 }, { size: 128 }],
    [{ size: 32, used: true }, { size: 32 }, { size: 64 }, { size: 128 }],
  ];
  return (
    <>
      <Night seed={41} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">BUDDY SYSTEM: 21 KB IN A 256 KB SEGMENT</Text>
      {rows.map((row, r) =>
        row.map((c, i) => {
          const x = 10 + row.slice(0, i).reduce((a, q) => a + q.size, 0) * k;
          const last = r === rows.length - 1;
          return <Card key={`${r}-${i}`} x={x} y={13 + r * 13} w={c.size * k - 1} h={11} ramp={c.used ? GOLD : last ? GREEN : STONE} ink={c.used ? undefined : "#f8f4e6"} size={3.5} lines={[`${c.size}K`]} />;
        }),
      )}
      <Text x={10} y={72} size={3.5} fill="#cfe4ff">SPLIT 256, 128, 64: THREE HALVINGS</Text>
      <Text x={90} y={82} size={3.5} fill="#ffe27a" anchor="middle">{`GRANT ${g.block}K FOR 21K: ${g.wasted}K WASTED INSIDE`}</Text>
      <Text x={90} y={91} size={3} fill="#7cf0c8" anchor="middle">BUDDY OF BLOCK AT A, SIZE S, IS AT A XOR S</Text>
      <Text x={90} y={99} size={3} fill="#7cf0c8" anchor="middle">FREE BOTH HALVES AND THEY MERGE UPWARD</Text>
    </>
  );
}

export const SLAB_EXAMPLE = (() => {
  const c = new SlabCache(4096, 1024);
  const slots = Array.from({ length: 6 }, () => c.alloc());
  c.free(0);
  c.free(0);
  return { slabs: [...c.slabs], states: c.states, perSlab: c.perSlab, ctor: c.constructorCalls, leftover192: slabLeftover(4096, 192), locks: [centralLockAcquisitions(1000, null), centralLockAcquisitions(1000, 32)], slots };
})();
export const HUGE_EXAMPLE = (() => {
  const GiB = 1024 ** 3;
  const MiB2 = 2 * 1024 ** 2;
  return { reachSmall: tlbReach(64, 4096), reachHuge: tlbReach(64, MiB2), pagesSmall: pagesToMap(GiB, 4096), pagesHuge: pagesToMap(GiB, MiB2), tableSmall: leafTableBytes(GiB, 4096), tableHuge: leafTableBytes(GiB, MiB2) };
})();

function Slab() {
  const e = SLAB_EXAMPLE;
  return (
    <>
      <Night seed={42} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">SLAB CACHE: 1 KB OBJECTS, 4 PER SLAB</Text>
      {e.slabs.map((used, s) => (
        <g key={s}>
          <Text x={10} y={24 + s * 17} size={3.5} fill="#cfe4ff">{`SLAB ${s}`}</Text>
          {Array.from({ length: e.perSlab }, (_, i) => (
            <Card key={i} x={44 + i * 30} y={17 + s * 17} w={28} h={12} ramp={i < used ? BLUE : GREEN} ink="#f8f4e6" size={3.5} lines={[i < used ? "USED" : "FREE"]} />
          ))}
        </g>
      ))}
      <Text x={90} y={56} size={3.5} fill="#f8f4e6" anchor="middle">{`${e.ctor} CONSTRUCTOR CALLS, ALL AT SLAB CREATION`}</Text>
      <Text x={90} y={64} size={3.5} fill="#7cf0c8" anchor="middle">ALLOC: PARTIAL SLAB, THEN EMPTY, THEN GROW</Text>
      <Card x={10} y={71} w={76} h={16} ramp={RED} ink="#f8f4e6" size={3} lines={["192 B IN 256 B BLOCK", "64 B LOST EACH"]} />
      <Card x={94} y={71} w={76} h={16} ramp={GREEN} ink="#f8f4e6" size={3} lines={["21 PER 4 KB SLAB", `${e.leftover192} B LOST IN ALL`]} />
      <Text x={90} y={95} size={3} fill="#cfe4ff" anchor="middle">TCACHE: 1000 ALLOCS, BATCH 32 = 32 LOCKS</Text>
    </>
  );
}

function HugePages() {
  const e = HUGE_EXAMPLE;
  const kb = (b: number) => (b >= 1024 ** 2 ? `${b / 1024 ** 2} MB` : `${b / 1024} KB`);
  return (
    <>
      <Night seed={43} />
      <Text x={90} y={8} size={4} fill="#ffe27a" anchor="middle">TLB REACH: 64 ENTRIES</Text>
      <Card x={10} y={16} w={76} h={24} ramp={RED} ink="#f8f4e6" size={3.5} lines={["4 KB PAGES", `REACH ${kb(e.reachSmall)}`, `1 GB = ${e.pagesSmall} PAGES`]} />
      <Card x={94} y={16} w={76} h={24} ramp={GREEN} ink="#f8f4e6" size={3.5} lines={["2 MB PAGES", `REACH ${e.reachHuge / 1024 ** 2} MB`, `1 GB = ${e.pagesHuge} PAGES`]} />
      <Text x={90} y={52} size={3.5} fill="#f8f4e6" anchor="middle">{`LEAF TABLES FOR 1 GB: ${kb(e.tableSmall)} VS ${kb(e.tableHuge)}`}</Text>
      <Text x={90} y={64} size={3.5} fill="#7cf0c8" anchor="middle">FEWER TLB MISSES, SHORTER PAGE WALKS</Text>
      <Text x={90} y={76} size={3.5} fill="#f87a8a" anchor="middle">NEEDS 2 MB OF CONTIGUOUS PHYSICAL MEMORY</Text>
      <Text x={90} y={88} size={3.5} fill="#cfe4ff" anchor="middle">LINUX: HUGETLBFS AND TRANSPARENT HUGE PAGES</Text>
    </>
  );
}

const DIAGRAMS: Record<DiagramId, { title: string; draw: () => ReactNode }> = {
  modes: {
    title: "User mode and kernel mode, separated by the mode bit",
    draw: Modes,
  },
  syscall: { title: "The path of a read() system call", draw: Syscall },
  interrupt: {
    title: "Devices raise interrupts; the CPU jumps through the vector table",
    draw: Interrupt,
  },
  kernels: { title: "Monolithic, micro and hybrid kernels", draw: Kernels },
  boot: { title: "The boot chain from power-on to init", draw: Boot },
  pstates: { title: "The five process states and the transitions between them", draw: ProcessStates },
  context: { title: "A context switch from P0 to P1 through their PCBs", draw: ContextSwitch },
  fork: { title: "fork() splits a process; the child calls exec() while the parent waits", draw: ForkExec },
  threads: { title: "A single-threaded and a multithreaded process", draw: Threads },
  ipc: { title: "Shared memory beside message passing", draw: Ipc },
  fcfs: { title: "FCFS Gantt charts: a long job first makes a convoy", draw: Fcfs },
  sjf: { title: "SJF and SRTF Gantt charts", draw: SjfSrtf },
  priority: { title: "Priority scheduling, and aging stopping starvation", draw: Priority },
  rr: { title: "Round Robin with a small and a huge quantum", draw: RoundRobin },
  mlfq: { title: "A three-queue MLFQ and its Gantt chart", draw: Mlfq },
  race: { title: "A producer's counter++ and a consumer's counter-- interleaved: an update is lost", draw: Race },
  peterson: { title: "Peterson's solution: two flags and a turn", draw: Peterson },
  semaphore: { title: "A counting semaphore: three threads in, two asleep on its queue", draw: Semaphore },
  monitor: { title: "A monitor with an entry queue and condition-variable queues", draw: Monitor },
  philosophers: { title: "Five dining philosophers, each holding one chopstick: deadlock", draw: Philosophers },
  rag: { title: "A resource-allocation graph with a cycle, and the four Coffman conditions", draw: Rag },
  banker: { title: "The Banker's algorithm: allocation, max, need and a safe sequence", draw: Banker },
  fit: { title: "One 212K request placed by first fit, best fit and worst fit", draw: Fit },
  frag: { title: "External fragmentation in a memory strip and internal fragmentation in a last page", draw: Frag },
  paging: { title: "Pages mapped to frames through a page table: logical 13 becomes physical 9", draw: Paging },
  ptable: { title: "A two-level page-table address split and an inverted page table search", draw: PageTables },
  tlb: { title: "The TLB: a hit goes straight to memory, a miss reads the page table first", draw: Tlb },
  segments: { title: "A segment table and three (segment, offset) translations, one of which traps", draw: Segments },
  demand: { title: "The six steps of servicing a page fault and the demand-paging effective access time", draw: Demand },
  replace: { title: "FIFO, LRU and Optimal fault counts on the textbook reference string with three frames", draw: Replace },
  belady: { title: "Belady's anomaly: FIFO faults rise from 9 to 10 when a frame is added", draw: Belady },
  thrash: { title: "CPU utilisation collapses when too many processes thrash", draw: Thrash },
  wss: { title: "The working set at two moments of a program, with a window of ten references", draw: Wss },
  alloc: { title: "Contiguous, linked and indexed file allocation, and the reads to reach block 9", draw: Alloc },
  inode: { title: "A Unix inode with direct, single, double and triple indirect pointers", draw: Inode },
  journal: { title: "The four steps of a journaled transaction and what recovery does after a crash", draw: Journal },
  raid: { title: "Usable disks and failure tolerance for RAID 0, 1, 5, 6 and 10 on four disks", draw: Raid },
  disk: { title: "Head movement of six disk-scheduling policies on the textbook queue", draw: DiskSched },
  namespaces: { title: "Two containers and the host each see their own PIDs, with the six namespace kinds", draw: Namespaces },
  cgroups: { title: "cpu.max throttling for four busy threads and one, and memory.max reclaiming cache or OOM-killing", draw: Cgroups },
  overlay: { title: "Overlayfs: a write copies a 100 MB file up, a delete leaves a whiteout, the container sees the merged view", draw: OverlayFs },
  vmcompare: { title: "Containers share one host kernel; virtual machines each run a guest kernel on a hypervisor", draw: VmCompare },
  trapemul: { title: "Trap-and-emulate: ADD runs natively, privileged instructions trap, POPF leaks without hardware support", draw: TrapEmulate },
  nestedpt: { title: "A TLB miss under nested paging reads 24 locations on a 5 by 5 grid", draw: NestedPt },
  migration: { title: "Pre-copy live migration: shrinking rounds of dirty pages, then a short pause", draw: Migration },
  cas: { title: "ABA on a lock-free stack: the stale CAS succeeds without a version tag and fails with one", draw: Cas },
  ordering: { title: "Store buffering: x86-TSO allows the 0,0 result that sequential consistency and a fence forbid", draw: Ordering },
  falseshare: { title: "False sharing: two counters in one cache line bounce between cores, padding removes the misses", draw: FalseShare },
  futex: { title: "A futex mutex: lock and unlock in user space, system calls only to wait and wake", draw: Futex },
  freelist: { title: "A free-list heap: split on malloc, coalesce on free, and the fragmentation that remains", draw: FreeList },
  buddy: { title: "The buddy system: halving a 256 KB segment for a 21 KB request", draw: BuddyDiagram },
  slab: { title: "A slab cache: equal slots in slabs, constructed once, filled partial-first", draw: Slab },
  hugepages: { title: "Huge pages: the same 64 TLB entries reach 128 MB instead of 256 KB", draw: HugePages },
  dockerrun: { title: "The six steps of docker run: overlayfs, clone, cgroup, pivot_root, drop privileges, execve", draw: DockerRun },
};

export const DIAGRAM_IDS = Object.keys(DIAGRAMS) as DiagramId[];

export function Diagram({ id, className = "" }: { id: DiagramId; className?: string }) {
  const d = DIAGRAMS[id];
  return (
    <svg role="img" aria-label={d.title} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" className={`block h-auto w-full ${className}`} data-testid={`diagram-${id}`}>
      {d.draw()}
    </svg>
  );
}
